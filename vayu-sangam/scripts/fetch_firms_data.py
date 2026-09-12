import pandas as pd
import requests
from datetime import datetime, timedelta
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'data', 'satellite')

def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)

def fetch_nasa_firms(bbox, source="VIIRS_SNPP_NRT", days=1):
    """
    Mock function to fetch active fires from NASA FIRMS API.
    Required for identifying dynamic stubble burning emissions.
    
    In production, uses: https://firms.modaps.eosdis.nasa.gov/api/
    """
    logger.info(f"Fetching {source} fire anomalies for bbox {bbox} over last {days} days...")
    
    # Mock FIRMS CSV response format
    # Columns: latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
    import numpy as np
    
    num_fires = int(np.random.uniform(500, 2000))
    logger.info(f"Detected {num_fires} thermal anomalies.")
    
    # Generate random points within Punjab/Haryana approx bbox
    lat_min, lon_min, lat_max, lon_max = map(float, bbox.split(','))
    
    lats = np.random.uniform(lat_min, lat_max, num_fires)
    lons = np.random.uniform(lon_min, lon_max, num_fires)
    frps = np.random.exponential(10, num_fires) + 2.0 # Fire Radiative Power
    confidence = np.random.choice(['n', 'l', 'h'], num_fires, p=[0.2, 0.3, 0.5])
    
    df = pd.DataFrame({
        'latitude': lats,
        'longitude': lons,
        'acq_date': [(datetime.now() - timedelta(days=np.random.rand())).strftime('%Y-%m-%d')] * num_fires,
        'frp': frps,
        'confidence': confidence,
        'instrument': [source] * num_fires
    })
    
    # Filter high confidence for stubble tracking
    df_filtered = df[df['confidence'] == 'h']
    logger.info(f"Filtered {len(df_filtered)} high-confidence active fires.")
    
    return df_filtered

def run_satellite_pipeline():
    logger.info("Starting Satellite Source Intelligence Pipeline...")
    ensure_dir(OUTPUT_DIR)
    
    # Bounding box for Punjab & Haryana (approximate)
    punjab_haryana_bbox = "27.5,73.5,32.5,77.5"
    
    try:
        fires_df = fetch_nasa_firms(punjab_haryana_bbox)
        
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M")
        output_file = os.path.join(OUTPUT_DIR, f"firms_fires_{timestamp_str}.csv")
        fires_df.to_csv(output_file, index=False)
        logger.info(f"Pipeline completed successfully. Data saved to {output_file}")
    except Exception as e:
        logger.error(f"Satellite pipeline failed: {e}")

if __name__ == "__main__":
    run_satellite_pipeline()
