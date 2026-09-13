import os
import json
import time
import logging
import requests
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Constants
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LIVE_DIR = DATA_DIR / "live"
CACHE_DIR = DATA_DIR / "cache"
STATION_LOOKUP_FILE = DATA_DIR / "cpcb_stations.csv"
LIVE_FILE = LIVE_DIR / "cpcb_live.csv"
CACHE_FILE = CACHE_DIR / "cpcb_cache.csv"
META_FILE = LIVE_DIR / "fetch_cpcb.meta.json"

TARGET_CITIES = ['Delhi', 'Gurugram', 'Faridabad', 'Noida', 'Ghaziabad']
TARGET_STATES = ['Delhi', 'Haryana', 'Uttar Pradesh']

def ensure_dir(d):
    d.mkdir(parents=True, exist_ok=True)

def load_station_lookup():
    if not STATION_LOOKUP_FILE.exists():
        logger.error(f"Station lookup file not found: {STATION_LOOKUP_FILE}")
        return pd.DataFrame()
    df = pd.read_csv(STATION_LOOKUP_FILE)
    # Create a composite key for fuzzy fallback (clean_name + city)
    df['clean_key'] = df['clean_name'].fillna('') + "_" + df['city'].fillna('').str.lower()
    return df

# LIVE PATH UNTESTED as of 2026-09-13 — data.gov.in has returned
# 502/timeout on every attempt. Fallback-to-OpenAQ/cache path IS tested
# and confirmed working. See tests/test_cpcb_fixture.py for offline
# validation of the parsing logic itself.
def fetch_state_data(state, api_key):
    url_base = "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
    limit = 2000
    offset = 0
    records = []
    
    while True:
        url = f"{url_base}?api-key={api_key}&format=json&limit={limit}&offset={offset}&filters[state]={state}"
        logger.info(f"Fetching CPCB data for {state} (offset={offset})...")
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        


# Constants
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LIVE_DIR = DATA_DIR / "live"
CACHE_DIR = DATA_DIR / "cache"
STATION_LOOKUP_FILE = DATA_DIR / "cpcb_stations.csv"
LIVE_FILE = LIVE_DIR / "cpcb_live.csv"
CACHE_FILE = CACHE_DIR / "cpcb_cache.csv"
META_FILE = LIVE_DIR / "fetch_cpcb.meta.json"

TARGET_CITIES = ['Delhi', 'Gurugram', 'Faridabad', 'Noida', 'Ghaziabad']
TARGET_STATES = ['Delhi', 'Haryana', 'Uttar Pradesh']

def ensure_dir(d):
    d.mkdir(parents=True, exist_ok=True)

def load_station_lookup():
    if not STATION_LOOKUP_FILE.exists():
        logger.error(f"Station lookup file not found: {STATION_LOOKUP_FILE}")
        return pd.DataFrame()
    df = pd.read_csv(STATION_LOOKUP_FILE)
    # Create a composite key for fuzzy fallback (clean_name + city)
    df['clean_key'] = df['clean_name'].fillna('') + "_" + df['city'].fillna('').str.lower()
    return df

# LIVE PATH UNTESTED as of 2026-09-13 — data.gov.in has returned
# 502/timeout on every attempt. Fallback-to-OpenAQ/cache path IS tested
# and confirmed working. See tests/test_cpcb_fixture.py for offline
# validation of the parsing logic itself.
def fetch_state_data(state, api_key):
    url_base = "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
    limit = 2000
    offset = 0
    records = []
    
    while True:
        url = f"{url_base}?api-key={api_key}&format=json&limit={limit}&offset={offset}&filters[state]={state}"
        logger.info(f"Fetching CPCB data for {state} (offset={offset})...")
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        
        # data.gov.in sometimes returns HTML 502/503 even with 200 OK headers
        try:
            data = response.json()
        except ValueError:
            raise ValueError(f"Invalid JSON received from data.gov.in for {state}")
            
        batch = data.get('records', [])
        for r in batch:
            r['data_source'] = 'cpcb'
        records.extend(batch)
        
        total = int(data.get('total', 0))
        if offset + limit >= total or len(batch) == 0:
            break
        offset += limit
        
    return records

def fetch_openaq_data(api_key):
    import concurrent.futures
    import datetime
    from datetime import timezone
    logger.info("Triggering OpenAQ Fallback Fetcher (V3 API)...")
    if not api_key or "your_" in api_key:
        raise ValueError("OpenAQ API Key is missing or invalid.")
        
    url = "https://api.openaq.org/v3/locations"
    headers = {"X-API-Key": api_key}
    
    params = {
        "coordinates": "28.6,77.2",
        "radius": 25000, 
        "limit": 1000
    }
    
    response = requests.get(url, headers=headers, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()
    
    locations = data.get('results', [])
    if not locations:
        return []
        
    # 1. Build sensor lookup map: sensorId -> (parameter_name, location_name)
    sensor_map = {}
    for loc in locations:
        city_data = loc.get('city')
        city = city_data.get('name', 'Delhi') if isinstance(city_data, dict) else (city_data or 'Delhi')
        station = loc.get('name', 'Unknown')
        for sensor in loc.get('sensors', []):
            param = sensor.get('parameter', {}).get('name', '').upper()
            if param == 'O3': param = 'OZONE'
            if param == 'PM25': param = 'PM2.5'
            sensor_map[sensor['id']] = {
                'city': city,
                'station': station,
                'pollutant_id': param
            }
            
    # 2. Fetch latest data concurrently
    records = []
    
    def fetch_latest(loc):
        try:
            r = requests.get(f"https://api.openaq.org/v3/locations/{loc['id']}/latest", headers=headers, timeout=10)
            return r.json().get('results', [])
        except Exception:
            return []
            
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(fetch_latest, locations))
        
    # 3. Process results
    now = datetime.datetime.now(timezone.utc)
    for loc_results in results:
        for reading in loc_results:
            sensor_id = reading.get('sensorsId')
            val = reading.get('value')
            dt_str = reading.get('datetime', {}).get('utc')
            
            if not sensor_id or val is None or not dt_str: continue
            if sensor_id not in sensor_map: continue
            
            # ponytail: 72h stale-data threshold rationale:
            # OpenAQ's India network polls most CPCB-equivalent sensors every 1–6h,
            # but some low-priority sensors only report once every 12–24h. During
            # extended CPCB outages (commonly 24–48h on data.gov.in), OpenAQ becomes
            # the sole data source, so we need headroom above the outage window.
            # 72h covers a full weekend outage (Fri evening → Mon morning) without
            # accepting truly stale readings. Verified against OpenAQ V3
            # /locations/{id}/latest timestamps across Delhi stations (Sep 2026).
            # Upgrade path: make this configurable via env var if sensor update
            # intervals change.
            STALE_THRESHOLD_HOURS = 72
            try:
                dt = datetime.datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
                if (now - dt).total_seconds() > STALE_THRESHOLD_HOURS * 3600:
                    continue
            except:
                continue
                
            meta = sensor_map[sensor_id]
            records.append({
                'country': 'India',
                'state': 'Delhi',
                'city': meta['city'],
                'station': meta['station'],
                'last_update': dt_str,
                'pollutant_id': meta['pollutant_id'],
                'pollutant_avg': val,
                'data_source': 'openaq'
            })
            
    return records

def process_and_pivot(raw_records, lookup_df):
    if not raw_records:
        return pd.DataFrame()
        
    df = pd.DataFrame(raw_records)
    
    # Filter by target cities
    if 'city' in df.columns:
        df = df[df['city'].str.contains('|'.join(TARGET_CITIES), case=False, na=False)]
    else:
        logger.warning("No 'city' column found in response. Proceeding without city filter.")
        
    if df.empty:
        return pd.DataFrame()

    # Pivot logic
    # Expected columns: country, state, city, station, last_update, pollutant_id, pollutant_avg
    if 'pollutant_avg' not in df.columns or 'pollutant_id' not in df.columns:
        logger.error("Missing required pollutant columns in API response.")
        return pd.DataFrame()
        
    # Drop rows without an average
    df = df.dropna(subset=['pollutant_avg'])
    
    # Ensure values are numeric
    df['pollutant_avg'] = pd.to_numeric(df['pollutant_avg'], errors='coerce')
    
    if 'data_source' not in df.columns:
        df['data_source'] = 'cpcb'
        
    pivoted = df.pivot_table(
        index=['last_update', 'station', 'city', 'data_source'], 
        columns='pollutant_id', 
        values='pollutant_avg',
        aggfunc='first'
    ).reset_index()

    # Rename map
    RENAME_MAP = {
        "PM2.5": "pm25", 
        "PM10": "pm10", 
        "NO2": "no2",
        "OZONE": "o3", 
        "CO": "co", 
        "SO2": "so2"
    }
    pivoted = pivoted.rename(columns=RENAME_MAP)
    
    # Reindex to force exact target columns (will add NaNs for missing ones)
    target_pollutants = ["pm25", "pm10", "no2", "o3", "co", "so2"]
    
    # We must keep last_update, station, city, data_source for joining later
    existing_meta_cols = ['last_update', 'station', 'city', 'data_source']
    all_target_cols = existing_meta_cols + target_pollutants
    
    # Only keep meta columns + reindexed target pollutants
    pivoted = pivoted.reindex(columns=all_target_cols)

    # Date format fix (DD-MM-YYYY HH:MM:SS is typical for Indian Govt APIs)
    # E.g., '12-09-2026 10:00:00'
    # Use coerce to catch any weird formats without crashing
    pivoted['timestamp'] = pd.to_datetime(pivoted['last_update'], format='%d-%m-%Y %H:%M:%S', errors='coerce')
    # If explicit parsing failed for everything, it might be a different format. Fallback:
    if pivoted['timestamp'].isna().all():
        logger.warning("Primary date format failed. Trying fallback inference.")
        pivoted['timestamp'] = pd.to_datetime(pivoted['last_update'], dayfirst=True, errors='coerce')
        
    # Convert to standard string
    pivoted['timestamp'] = pivoted['timestamp'].dt.strftime('%Y-%m-%dT%H:%M:%S')

    # Join with lookup to get station_id
    # Strategy 1: Exact match on station_name
    lookup_df['station_name_lower'] = lookup_df['station_name'].str.lower()
    pivoted['station_lower'] = pivoted['station'].str.lower()
    
    merged = pd.merge(pivoted, lookup_df[['station_name_lower', 'station_id']], 
                      left_on='station_lower', right_on='station_name_lower', how='left')
    
    # Strategy 2: Fuzzy match on missing rows using clean_key
    missing_mask = merged['station_id'].isna()
    if missing_mask.any():
        pivoted_missing = pivoted[missing_mask].copy()
        # Clean name from API: grab text before comma
        pivoted_missing['clean_name'] = pivoted_missing['station'].str.split(',').str[0].str.strip().str.lower()
        pivoted_missing['api_clean_key'] = pivoted_missing['clean_name'] + "_" + pivoted_missing['city'].str.lower()
        
        # Join on clean_key
        fuzzy_merged = pd.merge(pivoted_missing, lookup_df[['clean_key', 'station_id']], 
                                left_on='api_clean_key', right_on='clean_key', how='inner')
                                
        # Update original merged df with found IDs
        for _, row in fuzzy_merged.iterrows():
            idx = merged[merged['station'] == row['station']].index
            merged.loc[idx, 'station_id'] = row['station_id']
            
    # Drop unmatched rows and log warning
    still_missing = merged[merged['station_id'].isna()]
    if not still_missing.empty:
        unmatched = still_missing['station'].unique()
        logger.warning(f"Dropping {len(still_missing)} rows. Unmatched stations: {', '.join(unmatched[:10])}...")
        merged = merged.dropna(subset=['station_id'])

    # Final Schema Selection
    merged['station_name'] = merged['station'] # Downstream expects station_name
    final_cols = ['timestamp', 'station_id', 'pm25', 'pm10', 'no2', 'o3', 'co', 'so2', 'station_name', 'data_source']
    
    # Reindex one last time just to be absolutely sure of the order
    final_df = merged.reindex(columns=final_cols)
    
    # Clamp negative sensor values (defensive against calibration drift)
    pollutant_cols = ['pm25', 'pm10', 'no2', 'o3', 'co', 'so2']
    final_df[pollutant_cols] = final_df[pollutant_cols].clip(lower=0.0)
    
    return final_df

def main():
    load_dotenv(BASE_DIR.parent / ".env")
    cpcb_api_key = os.getenv("CPCB_API_KEY")
    openaq_api_key = os.getenv("OPENAQ_API_KEY")
    
    if not cpcb_api_key or "your_" in cpcb_api_key:
        logger.error("CPCB_API_KEY is not set in .env")
        return

    ensure_dir(LIVE_DIR)
    ensure_dir(CACHE_DIR)

    lookup_df = load_station_lookup()
    if lookup_df.empty:
        return

    max_retries = 3
    success = False
    all_raw_records = []
    source_used = "None"

    # 1. Primary Source: data.gov.in
    for attempt in range(max_retries):
        try:
            for state in TARGET_STATES:
                records = fetch_state_data(state, cpcb_api_key)
                all_raw_records.extend(records)
                
            if all_raw_records:
                success = True
                source_used = "data.gov.in"
                break
            else:
                logger.warning(f"data.gov.in Attempt {attempt+1}: No records fetched.")
        except Exception as e:
            logger.warning(f"data.gov.in Attempt {attempt+1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                
    # 2. Fallback Source: OpenAQ
    if not success:
        logger.info("data.gov.in failed. Triggering OpenAQ Fallback...")
        try:
            all_raw_records = fetch_openaq_data(openaq_api_key)
            if all_raw_records:
                success = True
                source_used = "OpenAQ"
                logger.info("OpenAQ fallback successful.")
        except Exception as e:
            logger.error(f"OpenAQ fallback failed: {e}")

    if not success:
        logger.error("All fetch attempts (Primary + Fallback) failed. Please check network/APIs.")
        return
        
    final_df = process_and_pivot(all_raw_records, lookup_df)
    
    if final_df.empty:
        logger.warning("Resulting dataframe is empty after processing.")
        return
        
    # Atomic write to live
    tmp_live = LIVE_DIR / ".cpcb_live.csv.tmp"
    final_df.to_csv(tmp_live, index=False)
    os.replace(tmp_live, LIVE_FILE)
    
    # Write copy to cache
    tmp_cache = CACHE_DIR / ".cpcb_cache.csv.tmp"
    final_df.to_csv(tmp_cache, index=False)
    os.replace(tmp_cache, CACHE_FILE)
    
    # Write freshness metadata
    source_counts = final_df['data_source'].value_counts().to_dict() if 'data_source' in final_df.columns else {"cpcb": len(final_df)}
    
    # Use the actual latest timestamp from the data itself to avoid "stale but showing fresh" confusion
    if not final_df['timestamp'].empty:
        try:
            # We already converted timestamp to string format '%Y-%m-%dT%H:%M:%S', so max() string comparison works
            data_time_str = final_df['timestamp'].max()
            fetch_utc = data_time_str + "Z" # Append Z to denote UTC or pseudo-UTC for frontend
        except:
            fetch_utc = datetime.now(timezone.utc).isoformat()
    else:
        fetch_utc = datetime.now(timezone.utc).isoformat()
        
    meta = {
        "last_successful_fetch_utc": fetch_utc,
        "source": source_used,
        "row_count": len(final_df),
        "source_breakdown": source_counts
    }
    with open(META_FILE, "w") as f:
        json.dump(meta, f)
        
    logger.info(f"Successfully processed and saved {len(final_df)} rows to {LIVE_FILE}")
    # 5. Trigger Nowcast Generation
    logger.info("Triggering Nowcast Grid Generator...")
    import subprocess
    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")
    nowcast_script = os.path.join(scripts_dir, "generate_nowcast_grid.py")
    out_json = LIVE_DIR / "nowcast_grid.json"
    if os.path.exists(nowcast_script):
        try:
            # We must use sys.executable to ensure it runs with the same python environment
            import sys
            subprocess.run([sys.executable, nowcast_script, "--cpcb", str(LIVE_FILE), "--out", str(out_json)], check=True)
            logger.info("Nowcast grid generation completed successfully.")
        except subprocess.CalledProcessError as e:
            logger.error(f"Nowcast grid generation failed with exit code {e.returncode}.")
    else:
        logger.warning(f"Nowcast script not found at {nowcast_script}")

if __name__ == "__main__":
    main()
