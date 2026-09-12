import os
import json
import time
import logging
import requests
import numpy as np
import pandas as pd
import xarray as xr
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LIVE_DIR = DATA_DIR / "live"
CACHE_DIR = DATA_DIR / "cache"

LIVE_FILE = LIVE_DIR / "weather_live.nc"
CACHE_FILE = CACHE_DIR / "weather_cache.nc"
META_FILE = LIVE_DIR / "fetch_weather.meta.json"

def ensure_dir(d):
    d.mkdir(parents=True, exist_ok=True)

def build_grid():
    # Bbox: (73, 27, 80, 31) -> (min_lon, min_lat, max_lon, max_lat)
    # Shape: lat=24, lon=26
    lat_vals = np.linspace(27, 31, 24)
    lon_vals = np.linspace(73, 80, 26)
    
    # Sort by lat then lon (create flattened lists)
    lat_flat = []
    lon_flat = []
    for lat in lat_vals:
        for lon in lon_vals:
            lat_flat.append(lat)
            lon_flat.append(lon)
            
    return lat_vals, lon_vals, np.array(lat_flat), np.array(lon_flat)

def fetch_chunk(lats, lons):
    max_retries = 3
    url = "https://api.open-meteo.com/v1/forecast"
    # Note: open-meteo expects multiple lats/lons as comma separated strings
    # But for a very long string, it might hit URL length limits. The chunk size of 50 handles this.
    params = {
        "latitude": ",".join(f"{x:.4f}" for x in lats),
        "longitude": ",".join(f"{x:.4f}" for x in lons),
        "hourly": "temperature_2m,relative_humidity_2m,windspeed_10m,winddirection_10m,boundary_layer_height",
        "forecast_days": 4
    }
    
    for i in range(max_retries):
        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            # If multiple points are requested, it returns a list of dictionaries.
            # If only 1 point, it returns a single dict. We standardize to list.
            if isinstance(data, dict):
                # If there's an error key, requests usually raise_for_status, but check just in case
                if "error" in data:
                    raise ValueError(data.get("reason", "Unknown API error"))
                return [data]
            return data
        except Exception as e:
            logger.warning(f"Chunk fetch failed (Attempt {i+1}/{max_retries}): {e}")
            if i < max_retries - 1:
                time.sleep(2 ** i)
                
    logger.error("Chunk fetch exhausted all retries.")
    return None

def main():
    # .env for DATA_MODE (even though fetcher doesn't check it directly, downstream does, but we load it anyway per rules)
    load_dotenv(BASE_DIR.parent / ".env")
    
    ensure_dir(LIVE_DIR)
    ensure_dir(CACHE_DIR)
    
    lat_vals, lon_vals, lat_flat, lon_flat = build_grid()
    total_points = len(lat_flat)
    
    chunk_size = 50
    all_data = []
    
    logger.info(f"Fetching Open-Meteo data for {total_points} points in batches of {chunk_size}...")
    
    success_count = 0
    # Create placeholders for empty data in case a chunk fails, so our reshape logic doesn't break
    # We will initialize all_data with None, then fill it.
    all_data = [None] * total_points
    
    for start_idx in range(0, total_points, chunk_size):
        end_idx = min(start_idx + chunk_size, total_points)
        chunk_lats = lat_flat[start_idx:end_idx]
        chunk_lons = lon_flat[start_idx:end_idx]
        
        logger.info(f"Fetching chunk {start_idx} to {end_idx-1}...")
        results = fetch_chunk(chunk_lats, chunk_lons)
        
        if results and len(results) == (end_idx - start_idx):
            for i, res in enumerate(results):
                all_data[start_idx + i] = res
            success_count += len(results)
        else:
            logger.error(f"Failed to fetch chunk {start_idx}-{end_idx-1} properly. Skipping...")
            
        time.sleep(1) # Respect rate limits
        
    # Final robust retry pass for missing points after a long cool-down
    missing_indices = [i for i, data in enumerate(all_data) if data is None]
    if missing_indices:
        logger.warning(f"Cooling down for 10 seconds before retrying {len(missing_indices)} failed points...")
        time.sleep(10)
        
        for start_idx in range(0, len(missing_indices), chunk_size):
            chunk_idx_subset = missing_indices[start_idx:start_idx + chunk_size]
            chunk_lats = lat_flat[chunk_idx_subset]
            chunk_lons = lon_flat[chunk_idx_subset]
            
            logger.info(f"Final retry for a chunk of {len(chunk_idx_subset)} points...")
            results = fetch_chunk(chunk_lats, chunk_lons)
            
            if results and len(results) == len(chunk_idx_subset):
                for list_i, real_i in enumerate(chunk_idx_subset):
                    all_data[real_i] = results[list_i]
                success_count += len(results)
            else:
                logger.error("Final retry failed for this chunk.")
            time.sleep(2)
        
    if success_count < total_points * 0.9:
        logger.error(f"Fetch failed too many chunks (Got {success_count}/{total_points}). Aborting to rely on cache.")
        return
        
    logger.info("Processing and reshaping data...")
    
    # Find the first valid result to extract the time dimension
    first_valid = next(item for item in all_data if item is not None)
    times = pd.to_datetime(first_valid["hourly"]["time"])
    time_len = len(times)
    
    # Initialize arrays
    # Shape: (lat*lon, time) -> we will reshape to (lat, lon, time) later
    t2m_flat = np.full((total_points, time_len), np.nan)
    rh_flat_all = np.full((total_points, time_len), np.nan)
    ws_flat = np.full((total_points, time_len), np.nan)
    wd_flat = np.full((total_points, time_len), np.nan)
    pblh_flat = np.full((total_points, time_len), np.nan)
    
    for idx, pt_data in enumerate(all_data):
        if pt_data is None:
            continue
        h = pt_data.get("hourly", {})
        
        # Open-Meteo returns None/null for missing values, handle them using np.nan
        def replace_none(lst):
            return [np.nan if x is None else x for x in lst]

        t2m_flat[idx, :] = replace_none(h.get("temperature_2m", [np.nan]*time_len))
        rh_flat_all[idx, :] = replace_none(h.get("relative_humidity_2m", [np.nan]*time_len))
        ws_flat[idx, :] = replace_none(h.get("windspeed_10m", [np.nan]*time_len))
        wd_flat[idx, :] = replace_none(h.get("winddirection_10m", [np.nan]*time_len))
        pblh_flat[idx, :] = replace_none(h.get("boundary_layer_height", [np.nan]*time_len))
        
    # Convert wind to u/v components
    wd_rad = wd_flat * np.pi / 180.0
    u10_flat = -ws_flat * np.sin(wd_rad)
    v10_flat = -ws_flat * np.cos(wd_rad)
    
    # Convert t2m to Kelvin
    t2_flat = t2m_flat + 273.15
    
    # Reshape arrays to (lat, lon, time) then transpose to (time, lat, lon)
    shape = (len(lat_vals), len(lon_vals), time_len)
    
    u = u10_flat.reshape(shape).transpose(2, 0, 1)
    v = v10_flat.reshape(shape).transpose(2, 0, 1)
    t2 = t2_flat.reshape(shape).transpose(2, 0, 1)
    rh = rh_flat_all.reshape(shape).transpose(2, 0, 1)
    pblh = pblh_flat.reshape(shape).transpose(2, 0, 1)
    
    # Proper 2D spatial fill: for each time step, fill missing edges from adjacent latitudes
    def spatial_fill(arr_3d):
        # arr_3d shape is (time, lat, lon)
        for t in range(arr_3d.shape[0]):
            df = pd.DataFrame(arr_3d[t, :, :])
            # ffill/bfill along lat (axis 0), then lon (axis 1)
            df = df.ffill(axis=0).bfill(axis=0).ffill(axis=1).bfill(axis=1)
            arr_3d[t, :, :] = df.values
        return arr_3d

    u = spatial_fill(u)
    v = spatial_fill(v)
    t2 = spatial_fill(t2)
    rh = spatial_fill(rh)
    pblh = spatial_fill(pblh)
    
    # Construct the xarray Dataset
    ds = xr.Dataset(
        data_vars={
            "u": (["time", "lat", "lon"], u),
            "v": (["time", "lat", "lon"], v),
            "t2": (["time", "lat", "lon"], t2),
            "rh": (["time", "lat", "lon"], rh),
            "pblh": (["time", "lat", "lon"], pblh),
        },
        coords={
            "time": times,
            "lat": lat_vals,
            "lon": lon_vals
        }
    )
    
    # Ensure exactly 73 hours to match wind_demo.nc
    # forecast_days=4 gives 96 hours, we just slice the first 73.
    ds = ds.isel(time=slice(0, 73))
    
    # Atomic write to live
    tmp_live = LIVE_DIR / ".weather_live.nc.tmp"
    ds.to_netcdf(tmp_live)
    os.replace(tmp_live, LIVE_FILE)
    
    # Write copy to cache
    tmp_cache = CACHE_DIR / ".weather_cache.nc.tmp"
    ds.to_netcdf(tmp_cache)
    os.replace(tmp_cache, CACHE_FILE)
    
    # Write metadata
    meta = {
        "last_successful_fetch_utc": datetime.now(timezone.utc).isoformat(),
        "source": "Open-Meteo Forecast",
        "grid_points_success": success_count,
        "total_grid_points": total_points,
        "time_steps": time_len
    }
    with open(META_FILE, "w") as f:
        json.dump(meta, f)
        
    logger.info(f"Successfully processed and saved weather_live.nc with dims {ds.dims}")

if __name__ == "__main__":
    main()
