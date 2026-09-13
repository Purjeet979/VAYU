import json
import pandas as pd
from fetchers.fetch_cpcb import process_and_pivot, load_station_lookup

def run_test():
    # 1. Create a mock data.gov.in fixture
    fixture = [
        {
            "country": "India",
            "state": "Delhi",
            "city": "Delhi",
            "station": "ITO, Delhi - CPCB",
            "last_update": "12-09-2026 10:00:00",
            "pollutant_id": "PM2.5",
            "pollutant_avg": "55.4"
        },
        {
            "country": "India",
            "state": "Delhi",
            "city": "Delhi",
            "station": "ITO, Delhi - CPCB",
            "last_update": "12-09-2026 10:00:00",
            "pollutant_id": "OZONE",
            "pollutant_avg": "21.2"
        },
        {
            "country": "India",
            "state": "Delhi",
            "city": "Noida",
            "station": "Sector - 125, Noida - UPPCB",
            "last_update": "12-09-2026 11:00:00",
            "pollutant_id": "PM10",
            "pollutant_avg": "105.0"
        }
    ]
    
    # 2. Load the real station lookup we generated
    lookup_df = load_station_lookup()
    
    # 3. Run the exact same processing logic
    print("Running process_and_pivot on fixture data...")
    final_df = process_and_pivot(fixture, lookup_df)
    
    # 4. Print results
    print("\n--- OFFLINE FIXTURE TEST OUTPUT ---")
    if not final_df.empty:
        print(final_df.to_string(index=False))
    else:
        print("Dataframe is empty!")

if __name__ == "__main__":
    run_test()
