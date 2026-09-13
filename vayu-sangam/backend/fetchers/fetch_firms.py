import os
import time
import json
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from sklearn.cluster import DBSCAN
from pathlib import Path
from dotenv import load_dotenv
import logging

# Set up logging to both file and console
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(Path(__file__).resolve().parent.parent / "data_freshness.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('fetch_firms')

# Load environment variables
load_dotenv()
FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY")

# Data directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LIVE_DIR = DATA_DIR / "live"
CACHE_DIR = DATA_DIR / "cache"

LIVE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

LIVE_FILE = LIVE_DIR / "fires_live.csv"
CACHE_FILE = CACHE_DIR / "fires_cache.csv"

# Configuration
AREA = "73,27,80,31" # Punjab, Haryana, Delhi NCR
DAY_RANGE = 1
SOURCES = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]

def fetch_firms_data(dry_run=False):
    if not FIRMS_MAP_KEY or FIRMS_MAP_KEY == "your_firms_map_key_here":
        logger.error("FIRMS_MAP_KEY is not set or invalid in .env")
        logger.warning("Falling back to last-known-good cache (if available) - handled by ingestion loader.")
        return

    all_dfs = []
    
    source_stats = {}
    
    for source in SOURCES:
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_MAP_KEY}/{source}/{AREA}/{DAY_RANGE}"
        source_stats[source] = "failed"
        
        # Retry logic with exponential backoff
        max_retries = 3
        for attempt in range(max_retries):
            try:
                logger.info(f"Fetching FIRMS data from {source} (Attempt {attempt+1}/{max_retries})")
                response = requests.get(url, timeout=15)
                response.raise_for_status()
                
                # Check if empty (only header)
                lines = response.text.strip().split('\n')
                if len(lines) > 1:
                    from io import StringIO
                    df = pd.read_csv(StringIO(response.text))
                    all_dfs.append(df)
                    source_stats[source] = "ok"
                break
            except Exception as e:
                logger.warning(f"Error fetching {source}: {e}")
                if attempt == max_retries - 1:
                    logger.error(f"Failed to fetch {source} after {max_retries} attempts.")
                else:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    
    if not all_dfs:
        logger.warning("No data retrieved from any FIRMS source. Ingestion will fall back to cache.")
        return
        
    # Process and map data
    try:
        combined_df = pd.concat(all_dfs, ignore_index=True)
        
        # Schema mapping
        # Target: ['lat', 'lon', 'frp', 'confidence', 'timestamp']
        
        # Rename coords
        combined_df = combined_df.rename(columns={'latitude': 'lat', 'longitude': 'lon'})
        
        # Confidence mapping (Assumption: l=30, n=70, h=100)
        # Note: Filtering out 'l' to reduce false positives/sun-glint for hackathon demo
        if 'confidence' in combined_df.columns:
            combined_df = combined_df[combined_df['confidence'] != 'l']
            
            def map_confidence(val):
                if isinstance(val, str):
                    if val == 'n': return 70.0
                    if val == 'h': return 100.0
                    return 50.0
                return float(val)
            combined_df['confidence'] = combined_df['confidence'].apply(map_confidence)
            
        # Parse timestamp (UTC to IST)
        # Bug fix: acq_time can lack zero padding e.g., '5' -> '0005'
        combined_df['acq_time'] = combined_df['acq_time'].astype(str).str.zfill(4)
        
        # Create datetime string and parse as UTC
        datetime_str = combined_df['acq_date'] + ' ' + combined_df['acq_time'].str[:2] + ':' + combined_df['acq_time'].str[2:]
        # Convert UTC to IST (Asia/Kolkata) so downstream receives naive local time correctly
        utc_time = pd.to_datetime(datetime_str, format="%Y-%m-%d %H:%M").dt.tz_localize('UTC')
        ist_time = utc_time.dt.tz_convert('Asia/Kolkata')
        combined_df['timestamp'] = ist_time.dt.strftime('%Y-%m-%dT%H:%M:%S')
        
        # Keep only required columns
        final_df = combined_df[['lat', 'lon', 'frp', 'confidence', 'timestamp']].copy()
        
        # 1. Spatial + Temporal Deduplication (Fix for Multi-Satellite Overlap)
        # Convert timestamp to datetime for temporal windowing
        final_df['dt'] = pd.to_datetime(final_df['timestamp'])
        
        def spatial_dedup(group):
            if len(group) == 1:
                return group
            # Convert lat/lon to radians for haversine
            coords = np.radians(group[['lat', 'lon']].values)
            # 400m eps in radians: 0.4km / 6371km = 0.0000627
            db = DBSCAN(eps=0.0000627, min_samples=1, metric='haversine').fit(coords)
            group['cluster'] = db.labels_
            # Group by cluster, taking mean lat/lon and max FRP/confidence, first timestamp
            return group.groupby('cluster').agg({
                'lat': 'mean',
                'lon': 'mean',
                'frp': 'max',
                'confidence': 'max',
                'timestamp': 'first'
            }).reset_index(drop=True)
            
        # Group by 1-hour temporal window and apply spatial dedup
        final_df['time_window'] = final_df['dt'].dt.floor('h')
        final_df = final_df.groupby('time_window').apply(spatial_dedup).reset_index(drop=True)
        
        final_df = final_df[['lat', 'lon', 'frp', 'confidence', 'timestamp']].sort_values('timestamp')
        
        if dry_run:
            logger.info("--- DRY RUN OUTPUT ---")
            print(final_df.head())
            logger.info(f"Total rows fetched and parsed (after dedup): {len(final_df)}")
            return
            
        # Write atomically to live
        tmp_file = LIVE_DIR / ".fires_live.csv.tmp"
        final_df.to_csv(tmp_file, index=False)
        os.replace(tmp_file, LIVE_FILE)
        
        # Write copy to cache
        tmp_cache = CACHE_DIR / ".fires_cache.csv.tmp"
        final_df.to_csv(tmp_cache, index=False)
        os.replace(tmp_cache, CACHE_FILE)
        
        # 2. Write freshness metadata
        meta = {
            "last_successful_fetch_utc": datetime.now(timezone.utc).isoformat(),
            "source": "NASA FIRMS (VIIRS SNPP/NOAA20/NOAA21)",
            "row_count": len(final_df),
            "satellite_status": source_stats
        }
        with open(LIVE_DIR / "fetch_firms.meta.json", "w") as f:
            json.dump(meta, f)
            
        logger.info(f"Successfully fetched and mapped {len(final_df)} fires to {LIVE_FILE.name}")
        
    except Exception as e:
        logger.error(f"Error processing FIRMS data: {e}. Ingestion will fall back to cache.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Run without overwriting files')
    args = parser.parse_args()
    fetch_firms_data(dry_run=args.dry_run)
