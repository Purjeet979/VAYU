import pandas as pd
import requests
from datetime import datetime, timedelta
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'data', 'cpcb')
DELHI_STATIONS = {
    'ITO': 'site_113',
    'Anand Vihar': 'site_114',
    'Punjabi Bagh': 'site_115',
    'RK Puram': 'site_118'
}

def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)

def fetch_station_data(station_id, start_time, end_time):
    """
    Mock function to represent fetching data from a CPCB API or Open Government Data platform.
    In a real implementation, this would make an HTTP request to the CPCB endpoints with an API key.
    """
    logger.info(f"Fetching data for station {station_id} from {start_time} to {end_time}...")
    
    # Mocking the data pipeline behavior
    # We create a dummy DataFrame that matches what we expect from the raw data
    dates = pd.date_range(start=start_time, end=end_time, freq='h')
    
    import numpy as np
    data = {
        'timestamp': dates,
        'station_id': [station_id] * len(dates),
        'pm25': np.random.uniform(50, 400, len(dates)),
        'pm10': np.random.uniform(100, 600, len(dates)),
        'no2': np.random.uniform(20, 150, len(dates)),
        'o3': np.random.uniform(10, 100, len(dates)),
        'co': np.random.uniform(0.5, 5.0, len(dates)),
        'so2': np.random.uniform(5, 50, len(dates))
    }
    
    df = pd.DataFrame(data)
    
    # Simulate API latency
    import time
    time.sleep(0.5)
    
    return df

def run_cpcb_pipeline():
    logger.info("Starting CPCB Data Ingestion Pipeline...")
    ensure_dir(OUTPUT_DIR)
    
    end_time = datetime.now()
    start_time = end_time - timedelta(days=3) # Fetch last 3 days
    
    all_data = []
    for name, station_id in DELHI_STATIONS.items():
        try:
            df = fetch_station_data(station_id, start_time, end_time)
            df['station_name'] = name
            all_data.append(df)
            logger.info(f"Successfully processed {name} ({len(df)} records).")
        except Exception as e:
            logger.error(f"Failed to fetch data for {name}: {e}")
            
    if all_data:
        final_df = pd.concat(all_data, ignore_index=True)
        
        # Data Cleaning & Harmonisation Step
        logger.info("Harmonising data (handling missing values, standardizing timestamps)...")
        final_df.ffill(inplace=True)
        final_df['timestamp'] = pd.to_datetime(final_df['timestamp'])
        
        # Save to raw storage (NetCDF / Parquet / CSV)
        timestamp_str = end_time.strftime("%Y%m%d_%H%M")
        output_file = os.path.join(OUTPUT_DIR, f"cpcb_delhi_raw_{timestamp_str}.csv")
        final_df.to_csv(output_file, index=False)
        logger.info(f"Pipeline completed successfully. Data saved to {output_file}")
    else:
        logger.warning("No data was fetched.")

if __name__ == "__main__":
    run_cpcb_pipeline()
