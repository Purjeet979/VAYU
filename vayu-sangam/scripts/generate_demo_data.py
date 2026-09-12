import os
import json
import numpy as np
import pandas as pd
import xarray as xr
from datetime import datetime, timedelta

# Constants
LAT_MIN, LAT_MAX = 28.0, 29.2
LON_MIN, LON_MAX = 76.5, 77.8
RES = 0.05
HOURS = 73
START_TIME = datetime(2026, 11, 1, 0, 0, 0) # Use a typical winter month for pollution
OUTPUT_DIR = os.path.join("backend", "data", "demo")

os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_grid():
    lats = np.arange(LAT_MIN, LAT_MAX, RES)
    lons = np.arange(LON_MIN, LON_MAX, RES)
    times = [START_TIME + timedelta(hours=i) for i in range(HOURS)]
    return lats, lons, times

def generate_weather_nc(lats, lons, times):
    n_lat, n_lon, n_time = len(lats), len(lons), len(times)
    
    # Synthetic weather: Wind pushing from NW to SE
    # U (Eastward wind) is positive, V (Northward wind) is negative (so blowing to South-East)
    u_wind = np.full((n_time, n_lat, n_lon), 2.5) + np.random.normal(0, 0.5, (n_time, n_lat, n_lon))
    v_wind = np.full((n_time, n_lat, n_lon), -1.5) + np.random.normal(0, 0.5, (n_time, n_lat, n_lon))
    
    # Temperature: diurnal cycle (cooler at night)
    base_t2 = 290 # Kelvin (~17 C)
    diurnal_t2 = np.array([np.sin(2 * np.pi * (t.hour - 6) / 24) * 8 for t in times])
    t2 = base_t2 + diurnal_t2[:, None, None] + np.random.normal(0, 0.5, (n_time, n_lat, n_lon))
    
    # RH: Inverse of temp
    rh = 100 - ((t2 - 273.15) * 2.5)
    rh = np.clip(rh, 30, 95)
    
    # PBLH: Drops significantly at night causing trapping
    pblh_base = np.array([max(200, 1500 * np.sin(np.pi * max(0, t.hour - 6) / 12)) for t in times])
    pblh = pblh_base[:, None, None] + np.random.normal(0, 50, (n_time, n_lat, n_lon))
    pblh = np.clip(pblh, 100, 2000)

    ds = xr.Dataset(
        {
            "u": (["time", "lat", "lon"], u_wind, {"units": "m/s", "description": "Eastward wind"}),
            "v": (["time", "lat", "lon"], v_wind, {"units": "m/s", "description": "Northward wind"}),
            "t2": (["time", "lat", "lon"], t2, {"units": "K", "description": "2m Temperature"}),
            "rh": (["time", "lat", "lon"], rh, {"units": "%", "description": "Relative Humidity"}),
            "pblh": (["time", "lat", "lon"], pblh, {"units": "m", "description": "Planetary Boundary Layer Height"})
        },
        coords={
            "lon": (["lon"], lons, {"units": "degrees_east"}),
            "lat": (["lat"], lats, {"units": "degrees_north"}),
            "time": (["time"], times)
        }
    )
    
    ds.to_netcdf(os.path.join(OUTPUT_DIR, "wind_demo.nc"))
    print("Generated wind_demo.nc")

def generate_pollution_nc(lats, lons, times):
    n_lat, n_lon, n_time = len(lats), len(lons), len(times)
    
    # Create a spatial gaussian plume starting NW (Punjab/Haryana direction) and moving SE (towards Delhi)
    # Delhi center approx 28.6 N, 77.2 E
    # Plume source: 29.1 N, 76.6 E
    pm25 = np.zeros((n_time, n_lat, n_lon))
    o3 = np.zeros((n_time, n_lat, n_lon))
    
    for t_idx, t in enumerate(times):
        # Diurnal PM2.5 buildup (worse at night/early morning due to low PBLH)
        diurnal_factor = 1.5 if (t.hour < 10 or t.hour > 18) else 0.8
        
        for i, lat in enumerate(lats):
            for j, lon in enumerate(lons):
                # Plume movement based on time (simulating transport)
                # Source starts at top left and diffuses towards center
                center_lat = 29.1 - (t_idx * 0.005)
                center_lon = 76.6 + (t_idx * 0.01)
                
                dist = np.sqrt((lat - center_lat)**2 + (lon - center_lon)**2)
                
                # Base pollution
                val = 50 + (300 * np.exp(-dist / 0.3) * diurnal_factor)
                pm25[t_idx, i, j] = val + np.random.normal(0, 10)
                
                # O3 is inversely related to PM2.5 (photochemical smog blocked by aerosols)
                # Peaks in afternoon
                o3_diurnal = np.sin(np.pi * max(0, t.hour - 8) / 10) * 80 if 8 <= t.hour <= 18 else 10
                o3[t_idx, i, j] = max(0, o3_diurnal - (val * 0.1)) + np.random.normal(0, 5)

    pm10 = pm25 * 1.6
    nox = pm25 * 0.4

    ds = xr.Dataset(
        {
            "pm25": (["time", "lat", "lon"], pm25, {"units": "ug/m3"}),
            "o3": (["time", "lat", "lon"], o3, {"units": "ug/m3"}),
            "pm10": (["time", "lat", "lon"], pm10, {"units": "ug/m3"}),
            "nox": (["time", "lat", "lon"], nox, {"units": "ug/m3"}),
        },
        coords={
            "lon": (["lon"], lons, {"units": "degrees_east"}),
            "lat": (["lat"], lats, {"units": "degrees_north"}),
            "time": (["time"], times)
        }
    )
    
    ds.to_netcdf(os.path.join(OUTPUT_DIR, "forecast_demo.nc"))
    print("Generated forecast_demo.nc")

def generate_fires_csv(times):
    # Generate around 50 fires in the NW region
    n_fires = 50
    data = []
    
    for _ in range(n_fires):
        lat = np.random.uniform(28.8, 29.2)
        lon = np.random.uniform(76.5, 77.0)
        frp = np.random.uniform(10, 150)
        conf = np.random.uniform(60, 100)
        # Fires usually happen in the afternoon
        t = times[0] + timedelta(hours=np.random.randint(12, 18))
        
        data.append({
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "frp": round(frp, 1),
            "confidence": round(conf, 1),
            "timestamp": t.isoformat()
        })
        
    df = pd.DataFrame(data)
    df.to_csv(os.path.join(OUTPUT_DIR, "fires_demo.csv"), index=False)
    print("Generated fires_demo.csv")

def generate_hcho_geojson():
    # Generate 3 HCHO hotspot clusters
    features = []
    clusters = [
        (29.0, 76.7, 50),
        (28.9, 76.6, 30),
        (29.1, 76.8, 45)
    ]
    
    for i, (lat, lon, anomaly) in enumerate(clusters):
        feature = {
            "type": "Feature",
            "properties": {
                "cluster_id": i + 1,
                "hcho_anomaly_score": anomaly,
                "description": "High HCHO anomaly detected"
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            }
        }
        features.append(feature)
        
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(os.path.join(OUTPUT_DIR, "hcho_hotspots.geojson"), "w") as f:
        json.dump(geojson, f, indent=2)
    print("Generated hcho_hotspots.geojson")

if __name__ == "__main__":
    lats, lons, times = generate_grid()
    generate_weather_nc(lats, lons, times)
    generate_pollution_nc(lats, lons, times)
    generate_fires_csv(times)
    generate_hcho_geojson()
    print("Demo data generation complete!")
