import pandas as pd
import requests
import io
import os
from pathlib import Path

# Data directory
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "backend" / "data"
OUTPUT_FILE = DATA_DIR / "cpcb_stations.csv"

def generate_lookup():
    url = "https://raw.githubusercontent.com/deepanshu88/Datasets/master/UploadedFiles/stations.csv"
    print(f"Fetching {url}...")
    response = requests.get(url)
    response.raise_for_status()
    
    df = pd.read_csv(io.StringIO(response.text))
    
    ncr_cities = ['Delhi', 'Gurugram', 'Faridabad', 'Noida', 'Ghaziabad']
    
    # The columns are: ['id', 'stationID', 'longitude', 'latitude', 'live', 'avg', 'cityID', 'stateID']
    # stateID == 'Delhi' or cityID in ncr_cities
    filtered_df = df[df['stateID'].str.contains('Delhi', case=False, na=False) | 
                     df['cityID'].str.contains('|'.join(ncr_cities), case=False, na=False)]
    
    # Rename columns to be more standard
    filtered_df = filtered_df.rename(columns={
        'id': 'station_id',
        'stationID': 'station_name',
        'latitude': 'lat',
        'longitude': 'lon',
        'cityID': 'city',
        'stateID': 'state'
    })
    
    # Clean up station names (remove ", Delhi - CPCB" etc for easier matching if needed)
    # The data.gov.in API usually returns names like "ITO, Delhi - CPCB" or just "ITO"
    # We will keep the original name for matching, but maybe add a cleaned version
    filtered_df['clean_name'] = filtered_df['station_name'].str.split(',').str[0].str.strip().str.lower()
    
    # Keep relevant columns
    final_df = filtered_df[['station_id', 'station_name', 'clean_name', 'lat', 'lon', 'city', 'state']]
    
    print(f"Found {len(final_df)} stations in Delhi NCR.")
    
    # Save to cpcb_stations.csv
    final_df.to_csv(OUTPUT_FILE, index=False)
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_lookup()
