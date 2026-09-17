import os
import sys
import json
import time
import logging
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent

if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from scripts.cpcb_history_store import insert_readings
from fetchers.sources import CPCBSource, OpenAQSource, WAQISource, LastKnownGoodSource

DATA_DIR = BASE_DIR / "data"
LIVE_DIR = DATA_DIR / "live"
CACHE_DIR = DATA_DIR / "cache"
STATION_LOOKUP_FILE = DATA_DIR / "cpcb_stations.csv"
LIVE_FILE = LIVE_DIR / "cpcb_live.csv"
CACHE_FILE = CACHE_DIR / "cpcb_cache.csv"
META_FILE = LIVE_DIR / "fetch_cpcb.meta.json"
LOG_FILE = LIVE_DIR / "ingestion.log"

def ensure_dir(d):
    d.mkdir(parents=True, exist_ok=True)

def load_station_lookup():
    if not STATION_LOOKUP_FILE.exists():
        logger.error(f"Station lookup file not found: {STATION_LOOKUP_FILE}")
        return pd.DataFrame()
    df = pd.read_csv(STATION_LOOKUP_FILE)
    df['clean_key'] = df['clean_name'].fillna('') + "_" + df['city'].fillna('').str.lower()
    return df

def map_stations(records, lookup_df):
    if not records:
        return pd.DataFrame()
        
    df = pd.DataFrame(records)
    
    # If station_id already exists (e.g. from LKG source), just return
    if 'station_id' in df.columns and not df['station_id'].isna().all():
        if 'station_name' not in df.columns and 'station' in df.columns:
            df['station_name'] = df['station']
        return df

    # Map station_id
    lookup_df['station_name_lower'] = lookup_df['station_name'].str.lower()
    df['station_lower'] = df.get('station', '').str.lower()
    
    merged = pd.merge(df, lookup_df[['station_name_lower', 'station_id', 'city']], 
                      left_on='station_lower', right_on='station_name_lower', how='left')
                      
    missing_mask = merged['station_id'].isna()
    if missing_mask.any():
        df_missing = df[missing_mask].copy()
        df_missing['clean_name'] = df_missing.get('station', '').str.split(',').str[0].str.strip().str.lower()
        city_series = df_missing['city'] if 'city' in df_missing.columns else pd.Series([''] * len(df_missing), index=df_missing.index)
        df_missing['api_clean_key'] = df_missing['clean_name'] + "_" + city_series.str.lower()
        
        fuzzy_merged = pd.merge(df_missing, lookup_df[['clean_key', 'station_id', 'city']], 
                                left_on='api_clean_key', right_on='clean_key', how='inner')
                                
        for _, row in fuzzy_merged.iterrows():
            idx = merged[merged['station'] == row['station']].index
            merged.loc[idx, 'station_id'] = row['station_id']
            # update city if missing
            if pd.isna(merged.loc[idx, 'city_x']).all():
                merged.loc[idx, 'city_x'] = row['city_y']

    still_missing = merged[merged['station_id'].isna()]
    if not still_missing.empty:
        unmatched = still_missing['station'].unique()
        logger.warning(f"Dropping {len(still_missing)} rows. Unmatched stations: {', '.join(unmatched[:10])}...")
        merged = merged.dropna(subset=['station_id'])

    merged['station_name'] = merged['station']
    if 'city_x' in merged.columns and 'city_y' in merged.columns:
        merged['city'] = merged['city_x'].fillna(merged['city_y'])
    elif 'city_x' in merged.columns:
        merged['city'] = merged['city_x']
    elif 'city_y' in merged.columns:
        merged['city'] = merged['city_y']
    
    pollutant_cols = ['pm25', 'pm10', 'no2', 'o3', 'co', 'so2']
    for c in pollutant_cols:
        if c not in merged.columns:
            merged[c] = None
        else:
            merged[c] = pd.to_numeric(merged[c], errors='coerce').clip(lower=0.0)

    final_cols = ['timestamp', 'station_id', 'pm25', 'pm10', 'no2', 'o3', 'co', 'so2', 'station_name', 'data_source', 'quality', 'confidence']
    for c in ['data_source', 'quality', 'confidence']:
        if c not in merged.columns:
            if c == 'data_source': merged[c] = merged.get('source', 'unknown')
            else: merged[c] = 'unknown'

    # Filter to only final columns
    existing_cols = [c for c in final_cols if c in merged.columns]
    final_df = merged[existing_cols]
    
    return final_df

def write_ingestion_log(metrics):
    log_line = f"[{datetime.now().strftime('%H:%M:%S')}] Air Quality ingestion started\n"
    for m in metrics:
        src = m['source']
        if m['success']:
            log_line += f"{src:<10} SUCCESS latency={m['latency']:.1f}s received={m['received']} fresh={m['fresh']} stale={m['stale']} invalid={m['invalid']}\n"
        else:
            log_line += f"{src:<10} FAIL    latency={m['latency']:.1f}s error={m['error']}\n"
            
    if metrics:
        successful = [m for m in metrics if m['success']]
        if successful:
            winner = successful[0]
            log_line += f"Selected  {winner['source']}\n"
            log_line += f"Quality   {winner.get('quality', 'unknown')}\n"
            log_line += f"Confidence {winner.get('confidence', 'unknown')}\n"
            
    with open(LOG_FILE, "a") as f:
        f.write(log_line + "\n")
    logger.info(f"Structured logs written to {LOG_FILE}")

def main():
    load_dotenv(BASE_DIR.parent / ".env")
    cpcb_api_key = os.getenv("CPCB_API_KEY")
    openaq_api_key = os.getenv("OPENAQ_API_KEY")
    waqi_api_key = os.getenv("WAQI_API_KEY")

    ensure_dir(LIVE_DIR)
    ensure_dir(CACHE_DIR)

    lookup_df = load_station_lookup()
    if lookup_df.empty:
        return

    SOURCES = [
        CPCBSource(cpcb_api_key),
        OpenAQSource(openaq_api_key),
        WAQISource(waqi_api_key),
        LastKnownGoodSource(str(CACHE_FILE))
    ]

    final_records = []
    source_used = None
    log_metrics = []
    
    for source in SOURCES:
        start_time = time.time()
        metric = {"source": source.name, "success": False, "latency": 0.0, "received": 0, "fresh": 0, "stale": 0, "invalid": 0, "error": ""}
        
        try:
            logger.info(f"Attempting to fetch from {source.name}...")
            raw_data = source.fetch()
            valid_records, val_metrics = source.validate_and_filter(raw_data)
            
            metric["received"] = val_metrics["received"]
            metric["fresh"] = val_metrics["fresh"]
            metric["stale"] = val_metrics["stale"]
            metric["invalid"] = val_metrics["invalid"]
            
            if valid_records and (len(valid_records) >= 15 or source.name == "LKG"):
                final_records = valid_records
                source_used = source.name
                metric["success"] = True
                metric["quality"] = valid_records[0].get("quality", "unknown")
                metric["confidence"] = valid_records[0].get("confidence", "unknown")
                metric["latency"] = time.time() - start_time
                log_metrics.append(metric)
                logger.info(f"{source.name} fetch successful. Found {len(valid_records)} valid records.")
                break
            else:
                metric["error"] = "No valid records" if not valid_records else f"Too few records ({len(valid_records)} < 15)"
                logger.warning(f"{source.name} returned {len(valid_records)} records, considered failed.")
                
        except Exception as e:
            metric["error"] = str(e)
            logger.error(f"{source.name} fetch failed: {e}")
            
        metric["latency"] = time.time() - start_time
        log_metrics.append(metric)

    write_ingestion_log(log_metrics)

    if not final_records:
        # All sources failed — write a degraded meta so the API can surface a stale warning
        old_meta = {}
        if META_FILE.exists():
            try:
                with open(META_FILE) as f:
                    old_meta = json.load(f)
            except Exception:
                pass
        degraded_meta = {
            "last_successful_fetch_utc": old_meta.get("last_successful_fetch_utc"),
            "source": "none",
            "row_count": 0,
            "quality": "degraded",
            "confidence": "none",
            "data_confidence": "Low (all sources degraded — CPCB, OpenAQ, WAQI all failed)",
            "all_sources_failed_at": datetime.now(timezone.utc).isoformat(),
        }
        with open(META_FILE, "w") as f:
            json.dump(degraded_meta, f)
        logger.error("All fetch attempts failed. Meta written with degraded status.")
        sys.exit(1)

    final_df = map_stations(final_records, lookup_df)
    
    if final_df.empty:
        logger.error("Data mapping failed, resulting dataframe is empty.")
        sys.exit(1)

    # Atomic write to live
    tmp_live = LIVE_DIR / ".cpcb_live.csv.tmp"
    final_df.to_csv(tmp_live, index=False)
    os.replace(tmp_live, LIVE_FILE)

    # Write copy to cache if it's not LKG
    if source_used != "LKG":
        tmp_cache = CACHE_DIR / ".cpcb_cache.csv.tmp"
        final_df.to_csv(tmp_cache, index=False)
        os.replace(tmp_cache, CACHE_FILE)

    # [Phase 0] Save to Persistent History DB
    if source_used != "LKG":
        try:
            logger.info(f"Saving {len(final_df)} rows to historical SQLite DB...")
            insert_readings(final_df)
        except Exception as db_err:
            logger.error(f"Failed to write to history DB: {db_err}")

    # Write freshness metadata
    try:
        fetch_utc = final_df['timestamp'].max()
    except:
        fetch_utc = datetime.now(timezone.utc).isoformat()
        
    meta = {
        "last_successful_fetch_utc": fetch_utc,
        "source": source_used,
        "row_count": len(final_df),
        "quality": final_records[0].get("quality", "unknown"),
        "confidence": final_records[0].get("confidence", "unknown"),
        "source_breakdown": {source_used: len(final_df)},
        "data_confidence": "Low (LKG stale fallback \u2014 all live sources failed)" if source_used == "LKG" else "High",
    }
    with open(META_FILE, "w") as f:
        json.dump(meta, f)
        
    logger.info(f"Successfully processed and saved {len(final_df)} rows to {LIVE_FILE} (Source: {source_used})")

    # Trigger Nowcast Generation
    logger.info("Triggering Nowcast Grid Generator...")
    import subprocess
    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")
    nowcast_script = os.path.join(scripts_dir, "generate_nowcast_grid.py")
    out_json = LIVE_DIR / "nowcast_grid.json"
    if os.path.exists(nowcast_script):
        try:
            subprocess.run([sys.executable, nowcast_script, "--cpcb", str(LIVE_FILE), "--out", str(out_json)], check=True)
            logger.info("Nowcast grid generation completed successfully.")
        except subprocess.CalledProcessError as e:
            logger.error(f"Nowcast grid generation failed with exit code {e.returncode}.")

if __name__ == "__main__":
    main()
