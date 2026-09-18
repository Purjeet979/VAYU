import sqlite3
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()
MIN_HISTORY_HOURS_REQUIRED = int(os.getenv("MIN_HISTORY_HOURS_REQUIRED", 24))

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_FILE = DATA_DIR / "live" / "cpcb_history.db"

def init_db():
    """Initializes the SQLite database with the necessary table if it doesn't exist."""
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS readings (
                timestamp TEXT,
                station_id TEXT,
                pm25 REAL,
                pm10 REAL,
                no2 REAL,
                o3 REAL,
                co REAL,
                so2 REAL,
                aqi REAL,
                data_source TEXT,
                PRIMARY KEY (timestamp, station_id)
            )
        """)
        # Index on timestamp for fast time-series queries
        conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON readings (timestamp)")
        
def insert_readings(df: pd.DataFrame):
    """Inserts a pandas DataFrame of readings into the database, ignoring duplicates."""
    if df.empty:
        return
        
    init_db()
    
    # Ensure timestamp is string for sqlite
    df_insert = df.copy()
    if pd.api.types.is_datetime64_any_dtype(df_insert['timestamp']):
        df_insert['timestamp'] = df_insert['timestamp'].dt.strftime('%Y-%m-%dT%H:%M:%S')
    
    # Keep only columns we care about
    cols = ['timestamp', 'station_id', 'pm25', 'pm10', 'no2', 'o3', 'co', 'so2', 'aqi', 'data_source']
    
    # Add missing columns with None/NaN if they don't exist
    for col in cols:
        if col not in df_insert.columns:
            df_insert[col] = None
            
    df_insert = df_insert[cols]
    
    with sqlite3.connect(DB_FILE) as conn:
        # Use executemany for bulk insert
        sql = f"""
            INSERT OR IGNORE INTO readings (
                {', '.join(cols)}
            ) VALUES (
                {', '.join(['?'] * len(cols))}
            )
        """
        
        # Replace NaN with None for SQLite
        records = df_insert.where(pd.notna(df_insert), None).values.tolist()
        conn.executemany(sql, records)
        conn.commit()

def get_history_count() -> dict:
    """Returns the continuous streak of hourly snapshots currently stored in the last N hours."""
    init_db()
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.execute("SELECT DISTINCT SUBSTR(timestamp, 1, 13) FROM readings ORDER BY 1 DESC LIMIT 100")
        rows = [r[0] for r in cursor.fetchall()]
        
        if not rows:
            return {
                "required_observations": MIN_HISTORY_HOURS_REQUIRED,
                "valid_observations": 0,
                "coverage_percent": 0.0,
                "status": "insufficient"
            }
            
        from datetime import datetime, timedelta
        # Ensure we check against IST since that's how timestamps are stored by WAQI
        now_hour = (datetime.utcnow() + timedelta(hours=5, minutes=30)).replace(minute=0, second=0, microsecond=0)
        
        valid = 0
        for i in range(MIN_HISTORY_HOURS_REQUIRED):
            expected = (now_hour - timedelta(hours=i)).strftime('%Y-%m-%dT%H')
            if expected in rows:
                valid += 1
                
        # If the current hour isn't there yet, check if the streak is basically full
        # This prevents immediate failure at the top of the hour before fetch runs
        if valid < MIN_HISTORY_HOURS_REQUIRED and (now_hour - timedelta(hours=MIN_HISTORY_HOURS_REQUIRED)).strftime('%Y-%m-%dT%H') in rows:
            # Maybe they have older hours that satisfy the count
            valid = sum(1 for r in rows if r >= (now_hour - timedelta(hours=MIN_HISTORY_HOURS_REQUIRED+1)).strftime('%Y-%m-%dT%H'))
            valid = min(valid, MIN_HISTORY_HOURS_REQUIRED)
            
        coverage = round((valid / MIN_HISTORY_HOURS_REQUIRED) * 100, 1)
        
        return {
            "required_observations": MIN_HISTORY_HOURS_REQUIRED,
            "valid_observations": valid,
            "coverage_percent": coverage,
            "status": "sufficient" if valid >= MIN_HISTORY_HOURS_REQUIRED else "insufficient"
        }

def get_lag_features(target_time: datetime, city: str = "Delhi") -> dict | str:
    """
    Extracts city-wide average lag features (1h, 3h, 24h) for PM2.5.
    Returns a string error 'insufficient_history_for_lag_features, building baseline: Xh/24h collected'
    if any of the required historical hours are completely missing.
    """
    init_db()
    
    # Round target time down to the hour
    target_time = target_time.replace(minute=0, second=0, microsecond=0)
    
    t_minus_1 = target_time - timedelta(hours=1)
    t_minus_3 = target_time - timedelta(hours=3)
    t_minus_24 = target_time - timedelta(hours=24)
    
    times_needed = {
        'pm25_lag1h': t_minus_1.strftime('%Y-%m-%dT%H:%M:%S'),
        'pm25_lag3h': t_minus_3.strftime('%Y-%m-%dT%H:%M:%S'),
        'pm25_lag24h': t_minus_24.strftime('%Y-%m-%dT%H:%M:%S')
    }
    
    # For simplicity, we get city-wide average. 
    # To do this accurately, we should filter by stations in the target city.
    # We can join with cpcb_stations.csv if needed, but for now we'll fetch
    # all stations and average them, or ideally we'd filter by city in SQL.
    # Since we only ingest Delhi NCR stations, taking the mean of all is a safe approximation
    # for the regional lag feature, but let's filter by city if possible.
    
    STATION_LOOKUP = DATA_DIR / "cpcb_stations.csv"
    if not STATION_LOOKUP.exists():
        return None
        
    stations_df = pd.read_csv(STATION_LOOKUP)
    city_stations = stations_df[stations_df['city'].str.lower() == city.lower()]['station_id'].tolist()
    
    if not city_stations:
        count_data = get_history_count()
        return f"insufficient_history_for_lag_features, building baseline: {count_data['valid_observations']}/{MIN_HISTORY_HOURS_REQUIRED}h collected"
        
    station_placeholders = ','.join(['?'] * len(city_stations))
    
    lags = {}
    with sqlite3.connect(DB_FILE) as conn:
        for lag_name, t_str in times_needed.items():
            # Get average pm25 for the city at that specific hour
            # Allow a +/- 1 hour window to handle slight API delays/gaps?
            # User strictly said "continuous hourly history", let's try strict matching first.
            query = f"""
                SELECT AVG(pm25) as avg_pm25
                FROM readings
                WHERE timestamp LIKE ? AND station_id IN ({station_placeholders})
            """
            
            # Use LIKE to match the hour (e.g. 2026-09-15T12:%)
            # This handles minor minute variations if any
            hour_prefix = t_str[:13] + "%"
            
            cursor = conn.execute(query, [hour_prefix] + city_stations)
            row = cursor.fetchone()
            
            if not row or row[0] is None:
                count_data = get_history_count()
                return f"insufficient_history_for_lag_features, building baseline: {count_data['valid_observations']}/{MIN_HISTORY_HOURS_REQUIRED}h collected"
                
            lags[lag_name] = row[0]
            
    return lags

def cleanup_old_history(max_hours: int = 48):
    """
    Rolling window cleanup: Deletes rows older than max_hours from the history DB.
    Never bulk deletes the entire table. Designed to run alongside cron jobs.
    """
    init_db()
    with sqlite3.connect(DB_FILE) as conn:
        try:
            cutoff_time = (datetime.utcnow() + timedelta(hours=5, minutes=30) - timedelta(hours=max_hours)).strftime('%Y-%m-%dT%H:%M:%S')
            cursor = conn.execute("DELETE FROM readings WHERE timestamp < ?", (cutoff_time,))
            deleted = cursor.rowcount
            conn.commit()
            if deleted > 0:
                print(f"Scheduled Cleanup: Dropped {deleted} rows older than {max_hours} hours from history DB.")
        except Exception as e:
            print(f"Scheduled Cleanup Failed: {e}")

