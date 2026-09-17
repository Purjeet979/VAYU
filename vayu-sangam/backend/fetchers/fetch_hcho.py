import os
import json
import time
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr
import scipy.ndimage
from dotenv import load_dotenv

try:
    import ee
except ImportError:
    ee = None

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LIVE_DIR = DATA_DIR / "live"
CACHE_DIR = DATA_DIR / "cache"

BASELINE_FILE = CACHE_DIR / "hcho_baseline.nc"
LIVE_FILE = LIVE_DIR / "hcho_hotspots.geojson"
CACHE_FILE = CACHE_DIR / "hcho_hotspots.geojson"
META_FILE = LIVE_DIR / "fetch_hcho.meta.json"

THRESHOLD_MULTIPLIER = 1.5

def ensure_dir(d):
    d.mkdir(parents=True, exist_ok=True)

def init_ee():
    if not ee:
        raise ImportError("The 'earthengine-api' package is not installed.")
    
    key_path = os.getenv("GEE_SERVICE_ACCOUNT_KEY_PATH")
    if not key_path or not os.path.exists(key_path):
        raise ValueError(f"GEE service account JSON not found at path: '{key_path}'. Check GEE_SERVICE_ACCOUNT_KEY_PATH in .env")
    
    with open(key_path, 'r') as f:
        credentials_dict = json.load(f)
        
    creds = ee.ServiceAccountCredentials(credentials_dict['client_email'], key_path)
    ee.Initialize(creds)

def get_grid_points():
    """Returns exactly the 24x26 mesh grid points mapped as an ee.FeatureCollection"""
    lat_vals = np.linspace(27, 31, 24)
    lon_vals = np.linspace(73, 80, 26)
    
    features = []
    for lat in lat_vals:
        for lon in lon_vals:
            geom = ee.Geometry.Point([float(lon), float(lat)])
            feat = ee.Feature(geom, {'lat': float(lat), 'lon': float(lon)})
            features.append(feat)
            
    fc = ee.FeatureCollection(features)
    return lat_vals, lon_vals, fc

def refresh_baseline():
    """
    Computes a 30-day median baseline over the grid and saves to NetCDF.
    Intended for slow-cadence cron jobs (e.g. weekly).
    """
    logger.info("PATH B: Triggering baseline refresh (refresh_baseline)")
    init_ee()
    
    lat_vals, lon_vals, fc = get_grid_points()
    
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=30)
    
    logger.info(f"Computing HCHO baseline from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    
    collection = ee.ImageCollection("COPERNICUS/S5P/NRTI/L3_HCHO") \
                   .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')) \
                   .select('tropospheric_HCHO_column_number_density')
                   
    median_img = collection.median()
    
    logger.info("Sampling 30-day median at 624 grid points...")
    sampled = median_img.reduceRegions(
        collection=fc,
        reducer=ee.Reducer.first(),
        scale=11132
    )
    
    data = sampled.getInfo()
    
    baseline_flat = np.full((len(lat_vals), len(lon_vals)), np.nan)
    
    for feat in data.get('features', []):
        props = feat.get('properties', {})
        lat = props.get('lat')
        lon = props.get('lon')
        val = props.get('first')
        
        if val is not None and lat is not None and lon is not None:
            lat_idx = (np.abs(lat_vals - lat)).argmin()
            lon_idx = (np.abs(lon_vals - lon)).argmin()
            baseline_flat[lat_idx, lon_idx] = val
            
    # Handle missing points at edges gracefully
    df = pd.DataFrame(baseline_flat)
    df = df.ffill(axis=0).bfill(axis=0).ffill(axis=1).bfill(axis=1)
    baseline_flat = df.values
    
    ds = xr.Dataset(
        data_vars={
            "hcho_baseline": (["lat", "lon"], baseline_flat),
        },
        coords={
            "lat": lat_vals,
            "lon": lon_vals
        }
    )
    
    baseline_computed_utc = datetime.now(timezone.utc).isoformat()
    ds.attrs['baseline_computed_utc'] = baseline_computed_utc
    
    ensure_dir(CACHE_DIR)
    tmp_path = CACHE_DIR / ".hcho_baseline.nc.tmp"
    ds.to_netcdf(tmp_path)
    os.replace(tmp_path, BASELINE_FILE)
    
    logger.info(f"Baseline successfully refreshed and saved to {BASELINE_FILE}")
    return ds

def fetch_hcho_live():
    """
    Fast live path. Uses precomputed baseline, fetches only the latest image,
    calculates anomalies, clusters them into hotspots, and writes GeoJSON.
    """
    logger.info("PATH A: Triggering live fetch (fetch_hcho_live)")
    
    if not BASELINE_FILE.exists():
        logger.warning("Baseline file missing. Calling refresh_baseline() for the first time...")
        baseline_ds = refresh_baseline()
    else:
        baseline_ds = xr.open_dataset(BASELINE_FILE)
        
    baseline_time_str = baseline_ds.attrs.get('baseline_computed_utc', '')
    if baseline_time_str:
        try:
            baseline_dt = datetime.fromisoformat(baseline_time_str.replace('Z', '+00:00'))
            if (datetime.now(timezone.utc) - baseline_dt).days > 10:
                logger.warning("Baseline is older than 10 days! (Stale). Continuing with stale baseline to stay fast...")
        except Exception:
            pass
            
    baseline_vals = baseline_ds['hcho_baseline'].values
    lat_vals = baseline_ds['lat'].values
    lon_vals = baseline_ds['lon'].values
    
    init_ee()
    _, _, fc = get_grid_points()
    
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=7)
    
    collection = ee.ImageCollection("COPERNICUS/S5P/NRTI/L3_HCHO") \
                   .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')) \
                   .select('tropospheric_HCHO_column_number_density')
                   
    max_retries = 3
    data = None
    
    for i in range(max_retries):
        try:
            if collection.size().getInfo() == 0:
                logger.error("No HCHO images available in GEE for the last 3 days.")
                return
                
            latest_img = collection.median()
            logger.info(f"Sampling latest 3-day median HCHO image (Attempt {i+1})...")
            
            sampled = latest_img.reduceRegions(
                collection=fc,
                reducer=ee.Reducer.first(),
                scale=11132
            )
            data = sampled.getInfo()
            break
        except Exception as e:
            logger.warning(f"GEE API fetch failed (Attempt {i+1}/{max_retries}): {e}")
            if i < max_retries - 1:
                time.sleep(2 ** i)
                
    if not data:
        logger.error("Live fetch exhausted all retries. Check GEE quotas/connectivity.")
        return
        
    live_flat = np.full((len(lat_vals), len(lon_vals)), np.nan)
    for feat in data.get('features', []):
        props = feat.get('properties', {})
        lat = props.get('lat')
        lon = props.get('lon')
        val = props.get('first')
        
        if val is not None and lat is not None and lon is not None:
            lat_idx = (np.abs(lat_vals - lat)).argmin()
            lon_idx = (np.abs(lon_vals - lon)).argmin()
            live_flat[lat_idx, lon_idx] = val
            
    # Spatially fill any missing pixels in the live scan
    df = pd.DataFrame(live_flat)
    df = df.ffill(axis=0).bfill(axis=0).ffill(axis=1).bfill(axis=1)
    live_flat = df.values
    
    # ---------------------------------------------------------
    # ANOMALY DETECTION & CLUSTERING
    # ---------------------------------------------------------
    anomaly_mask = live_flat > (baseline_vals * THRESHOLD_MULTIPLIER)
    
    # Simple 8-connectivity clustering for adjacent hotspot cells
    structure = scipy.ndimage.generate_binary_structure(2, 2)
    labeled_array, num_features = scipy.ndimage.label(anomaly_mask, structure=structure)
    
    features = []
    for cluster_id in range(1, num_features + 1):
        cluster_indices = np.where(labeled_array == cluster_id)
        
        mean_lat_idx = np.mean(cluster_indices[0])
        mean_lon_idx = np.mean(cluster_indices[1])
        
        centroid_lat = np.interp(mean_lat_idx, range(len(lat_vals)), lat_vals)
        centroid_lon = np.interp(mean_lon_idx, range(len(lon_vals)), lon_vals)
        
        # Mean ratio vs baseline
        ratios = live_flat[cluster_indices] / (baseline_vals[cluster_indices] + 1e-9)
        mean_ratio = np.mean(ratios)
        
        feat = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(centroid_lon), float(centroid_lat)]
            },
            "properties": {
                "cluster_id": cluster_id,
                "hcho_anomaly_score": float(mean_ratio),
                "description": f"Elevated HCHO near lat {centroid_lat:.2f}, lon {centroid_lon:.2f} — {mean_ratio:.1f}x baseline"
            }
        }
        features.append(feat)
        
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    ensure_dir(LIVE_DIR)
    tmp_live = LIVE_DIR / ".hcho_hotspots.geojson.tmp"
    with open(tmp_live, 'w') as f:
        json.dump(geojson, f, indent=2)
    os.replace(tmp_live, LIVE_FILE)
    
    tmp_cache = CACHE_DIR / ".hcho_hotspots.geojson.tmp"
    with open(tmp_cache, 'w') as f:
        json.dump(geojson, f, indent=2)
    os.replace(tmp_cache, CACHE_FILE)
    
    meta = {
        "last_successful_fetch_utc": datetime.now(timezone.utc).isoformat(),
        "row_count": num_features,
        "baseline_used_utc": baseline_time_str
    }
    with open(META_FILE, "w") as f:
        json.dump(meta, f)
        
    logger.info(f"Success! Detected {num_features} anomaly clusters. Written to {LIVE_FILE}")

def main():
    load_dotenv(BASE_DIR.parent / ".env")
    fetch_hcho_live()

if __name__ == "__main__":
    main()
