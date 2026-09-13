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
        records.extend(batch)
        
        total = int(data.get('total', 0))
        if offset + limit >= total or len(batch) == 0:
            break
        offset += limit
        
    return records

def fetch_openaq_data(api_key):
    """
    Fallback fetcher using OpenAQ v3 API.
    Fetches latest measurements for Delhi bounding box.
    """
    logger.info("Triggering OpenAQ Fallback Fetcher...")
    if not api_key or "your_" in api_key:
        raise ValueError("OpenAQ API Key is missing or invalid.")
        
    url = "https://api.openaq.org/v3/locations"
    headers = {"X-API-Key": api_key}
    
    # Bounding box for Delhi NCR: [min_lon, min_lat, max_lon, max_lat]
    # Approx: 76.8, 28.2, 77.5, 28.9
    params = {
        "coordinates": "28.6,77.2",
        "radius": 50000, # 50km
        "limit": 1000
    }
    
    # In a real scenario we'd parse OpenAQ's specific measurement format.
    # For now, we will raise NotImplementedError to indicate it's wired up but needs live testing to see the schema.
    # We will map it to look exactly like the raw_records of data.gov.in so the same pivot logic works.
    
    response = requests.get(url, headers=headers, params=params, timeout=15)
    response.raise_for_status()
    
    data = response.json()
    records = []
    
    for loc in data.get('results', []):
        city = loc.get('city', {}).get('name', 'Delhi')
        station = loc.get('name', 'Unknown')
        
        for parameter in loc.get('parameters', []):
            pollutant_id = parameter.get('name').upper()
            if pollutant_id == 'O3': pollutant_id = 'OZONE'
            
            # Map OpenAQ payload to data.gov.in style payload for unified processing
            records.append({
                'country': 'India',
                'state': 'Delhi',
                'city': city,
                'station': station,
                'last_update': parameter.get('lastUpdated'),
                'pollutant_id': pollutant_id,
                'pollutant_avg': parameter.get('lastValue')
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
    
    pivoted = df.pivot_table(
        index=['last_update', 'station', 'city'], 
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
    
    # We must keep last_update, station, city for joining later
    existing_meta_cols = ['last_update', 'station', 'city']
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
    final_cols = ['timestamp', 'station_id', 'pm25', 'pm10', 'no2', 'o3', 'co', 'so2', 'station_name']
    
    # Reindex one last time just to be absolutely sure of the order
    final_df = merged.reindex(columns=final_cols)
    
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
    meta = {
        "last_successful_fetch_utc": datetime.now(timezone.utc).isoformat(),
        "source": source_used,
        "row_count": len(final_df)
    }
    with open(META_FILE, "w") as f:
        json.dump(meta, f)
        
    logger.info(f"Successfully processed and saved {len(final_df)} rows to {LIVE_FILE}")
    
    # Print sample for verification
    print("\n--- SAMPLE OUTPUT ---")
    print(final_df[['timestamp', 'station_name', 'pm25', 'pm10', 'o3', 'no2', 'co', 'so2']].head())

if __name__ == "__main__":
    main()
