"""Cached, serialisable backend views over the Phase 1–5 demo services."""

from __future__ import annotations

from functools import lru_cache
import threading
from typing import Any

import numpy as np
import pandas as pd

from .forecast_models import DemoForecastModel, ForecastPaths
from .inversion_intelligence import InversionIntelligenceService, InversionPaths
from .scenario_engine import compute_sub_indices
from .source_intelligence import SourceIntelligenceService, SourcePaths
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
DATA_MODE = os.getenv("DATA_MODE", "demo")

def resolve_paths(mode: str) -> tuple[ForecastPaths, SourcePaths, InversionPaths]:
    project_root = Path(__file__).resolve().parents[2]
    data_dir = project_root / "backend" / "data"
    demo_dir = data_dir / "demo"
    live_dir = data_dir / "live"
    cache_dir = data_dir / "cache"
    
    def get_path(demo_filename: str) -> Path:
        if mode == "live":
            live_filename = demo_filename.replace("_demo", "_live")
            cache_filename = demo_filename.replace("_demo", "_cache")
            
            if demo_filename == "wind_demo.nc":
                live_filename = "weather_live.nc"
                cache_filename = "weather_cache.nc"
            elif demo_filename == "hcho_hotspots.geojson":
                live_filename = demo_filename
                cache_filename = demo_filename
            
            # Double-fallback architecture:
            # 1. Try live directory (handles successful fetch today)
            # 2. Try cache directory (handles failed fetch today, uses last known good)
            # 3. Try demo directory (handles cold-start where files don't exist yet)
            live_path = live_dir / live_filename
            if live_path.exists(): return live_path
            
            cache_path = cache_dir / cache_filename
            if cache_path.exists(): return cache_path
            
        return demo_dir / demo_filename

    wind_path = get_path("wind_demo.nc")
    fires_path = get_path("fires_demo.csv")
    hcho_path = get_path("hcho_hotspots.geojson")
    cpcb_path = get_path("cpcb_demo.csv") # Mapped for completeness (used downstream or in BiasCorrector)
    forecast_path = get_path("forecast_demo.nc")
    config_path = project_root / "configs" / "demo.yaml"

    return (
        ForecastPaths(forecast=forecast_path, wind=wind_path),
        SourcePaths(fires=fires_path, hcho=hcho_path, wind=wind_path, config=config_path),
        InversionPaths(wind=wind_path)
    )


GRID_VARIABLES = {
    "pm25": "µg/m³",
    "pm10": "µg/m³",
    "o3": "µg/m³",
    "nox": "µg/m³",
    "pblh": "m",
    "t2": "K",
    "rh": "%",
}



def _clamp(val: float | None) -> float | None:
    # pollutant concentrations cannot be negative; clamps interpolation/demo-noise overshoot.
    if val is None or np.isnan(val): return None
    return max(0.0, float(val))

def _aqi(pm25: float, pm10: float, o3: float) -> int:
    subindices = compute_sub_indices(pm25, pm10, o3)
    return int(np.ceil(max(subindices.pm25, subindices.pm10, subindices.o3)))


_model_lock = threading.Lock()

@lru_cache(maxsize=1)
def _get_demo_forecast_model_cached() -> DemoForecastModel:
    f_paths, _, _ = resolve_paths(DATA_MODE)
    return DemoForecastModel(paths=f_paths)

def get_demo_forecast_model() -> DemoForecastModel:
    """Keep the pre-generated NetCDF tensors in memory for the server lifetime."""
    with _model_lock:
        return _get_demo_forecast_model_cached()
        
@lru_cache(maxsize=1)
def _get_source_intelligence_service_cached() -> SourceIntelligenceService:
    _, s_paths, _ = resolve_paths(DATA_MODE)
    return SourceIntelligenceService(paths=s_paths)

@lru_cache(maxsize=1)
def _get_inversion_service_cached() -> InversionIntelligenceService:
    _, _, i_paths = resolve_paths(DATA_MODE)
    return InversionIntelligenceService(paths=i_paths)


@lru_cache(maxsize=74)
def cached_forecast(hours: int, stubble_fraction: float = 1.0) -> dict[str, Any]:
    """Return a compact, deterministic timeline response for a scenario."""
    model = get_demo_forecast_model()
    rows = model.summary({"stubble_fraction": stubble_fraction}, horizon=hours)
    for row in rows:
        for pol in ["pm25_ug_m3", "pm10_ug_m3", "o3_ug_m3", "nox_ug_m3", "so2_ug_m3", "co_mg_m3", "no2_ug_m3"]:
            if pol in row and row[pol] is not None:
                row[pol] = _clamp(row[pol])
        row["aqi"] = _aqi(row["pm25_ug_m3"], row["pm10_ug_m3"], row["o3_ug_m3"])
        for k, v in row.items():
            if isinstance(v, float) and np.isnan(v): row[k] = None
    return {
        "mode": DATA_MODE,
        "data_source": "bundled_demo_dataset",
        "model": model.model_name,
        "model_version": model.model_version,
        "scientific_status": "synthetic demo forecast; not scientifically validated",
        "hours": hours,
        "stubble_fraction": stubble_fraction,
        "forecast": rows,
    }


@lru_cache(maxsize=512)
def cached_grid(hour: int, variable: str, stubble_fraction: float = 1.0) -> dict[str, Any]:
    """Serialise a single gridded field once per hour/variable/scenario."""
    if variable not in GRID_VARIABLES:
        allowed = ", ".join(sorted(GRID_VARIABLES))
        raise ValueError(f"variable must be one of: {allowed}")
    model = get_demo_forecast_model()
    frame = model.predict({"stubble_fraction": stubble_fraction}, horizon=hour + 1).isel(time=hour)
    field = frame[variable]
    return {
        "mode": DATA_MODE,
        "data_source": "bundled_demo_dataset",
        "model": model.model_name,
        "model_version": model.model_version,
        "scientific_status": "synthetic demo forecast; not scientifically validated",
        "hour": hour,
        "timestamp": str(frame.time.values),
        "variable": variable,
        "units": GRID_VARIABLES[variable],
        "stubble_fraction": stubble_fraction,
        "lat": [round(float(value), 5) for value in field.lat.values],
        "lon": [round(float(value), 5) for value in field.lon.values],
        "values": [[None if np.isnan(v) else (_clamp(v) if variable not in ['pblh', 't2', 'rh'] else v) for v in row] for row in np.round(field.values, 3).tolist()],
    }


@lru_cache(maxsize=73)
def cached_sources(hour: int) -> dict[str, Any]:
    return _get_source_intelligence_service_cached().get_sources(hour)


@lru_cache(maxsize=73)
def cached_inversion(hour: int) -> dict[str, Any]:
    return _get_inversion_service_cached().get_inversion(hour)


def _first_existing(paths: list[Path]) -> Path | None:
    for path in paths:
        if path.exists():
            return path
    return None


@lru_cache(maxsize=1)
def cached_cpcb() -> list[dict[str, Any]]:
    """Return station observations from existing file-based CPCB artifacts."""
    project_root = Path(__file__).resolve().parents[2]
    data_dir = project_root / "backend" / "data"
    cpcb_path = _first_existing(
        [
            data_dir / "live" / "cpcb_live.csv",
            data_dir / "cache" / "cpcb_cache.csv",
            data_dir / "cpcb" / "cpcb_delhi_raw_20260912_1007.csv",
        ]
    )
    if cpcb_path is None:
        return []

    df = pd.read_csv(cpcb_path)
    required = {"timestamp", "station_id", "station_name", "pm25", "pm10", "o3"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CPCB file is missing required columns: {', '.join(sorted(missing))}")

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp", "station_id", "station_name"])
    for column in ("pm25", "pm10", "no2", "o3", "co", "so2"):
        if column not in df.columns:
            df[column] = np.nan
        df[column] = pd.to_numeric(df[column], errors="coerce")

    stations_path = data_dir / "cpcb_stations.csv"
    if stations_path.exists():
        stations = pd.read_csv(stations_path)
        df = df.merge(
            stations[["station_id", "lat", "lon", "city", "state"]],
            on="station_id",
            how="left",
        )

    def row_aqi(row: pd.Series) -> int | None:
        if pd.isna(row["pm25"]) or pd.isna(row["pm10"]) or pd.isna(row["o3"]):
            return None
        return _aqi(float(row["pm25"]), float(row["pm10"]), float(row["o3"]))

    df["hour"] = df["timestamp"].dt.hour
    df["aqi"] = df.apply(row_aqi, axis=1)
    df = df.sort_values(["station_name", "timestamp"])
    df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%S")
    return df.replace({np.nan: None}).to_dict(orient="records")


@lru_cache(maxsize=1)
def cached_cpcb_latest() -> list[dict[str, Any]]:
    """Return only the latest station row per station for lightweight rankings."""
    records = cached_cpcb()
    latest: dict[str, dict[str, Any]] = {}
    for row in records:
        station_id = str(row.get("station_id") or row.get("station_name") or "")
        timestamp = str(row.get("timestamp") or "")
        if station_id and (station_id not in latest or timestamp > str(latest[station_id].get("timestamp") or "")):
            latest[station_id] = row
    return sorted(
        latest.values(),
        key=lambda row: -1 if row.get("aqi") is None else float(row["aqi"]),
        reverse=True,
    )


def build_explanation(hour: int) -> dict[str, Any]:
    """Combine independent engines into a transparent, non-SHAP explanation."""
    inversion = cached_inversion(hour)
    sources = cached_sources(hour)
    forecast = cached_forecast(hour + 1)["forecast"][hour]
    drivers: list[dict[str, Any]] = [
        {
            "factor": f"{inversion['category']} atmospheric trapping",
            "evidence": f"Index {inversion['inversion_index']}; PBLH {inversion['pbl_height_m']} m; wind {inversion['wind_speed_mps']} m/s",
            "mechanism": "Shallow boundary layers and weak winds reduce dispersion.",
        }
    ]
    if sources["sources"]:
        top = sources["sources"][0]
        drivers.append(
            {
                "factor": "Highest-ranked biomass-burning source cluster",
                "evidence": f"Score {top['source_score']}; {top['fire_count']} fires; travel estimate {top['travel_time_hours']} h",
                "mechanism": "The prototype score combines FRP, HCHO, wind alignment, proximity, and agricultural context.",
            }
        )
    drivers.append(
        {
            "factor": "Forecast PM2.5 level",
            "evidence": f"Domain mean {forecast['pm25_ug_m3']} µg/m³; AQI {forecast['aqi']}",
            "mechanism": "This is a synthetic NetCDF demo field, not a validated operational prediction.",
        }
    )
    return {
        "mode": DATA_MODE,
        "data_source": "bundled_demo_dataset",
        "model": "RulesBasedExplanationPrototype",
        "model_version": "0.6.0",
        "scientific_status": "prototype evidence summary; not SHAP or scientifically calibrated",
        "hour": hour,
        "timestamp": forecast["timestamp"],
        "primary_drivers": drivers,
        "summary": "The displayed drivers are transparent prototype rules derived from the demo forecast, inversion, and source-intelligence outputs.",
    }


@lru_cache(maxsize=16)
def cached_dashboard_summary(hours: int = 72, hour: int = 24) -> dict[str, Any]:
    """Bundle dashboard data into one response to reduce frontend round-trips."""
    return {
        "forecast": cached_forecast(hours),
        "inversion": cached_inversion(hour),
        "sources": cached_sources(hour),
        "explanation": build_explanation(hour),
    }


@lru_cache(maxsize=128)
def cached_map_data(hour: int = 24, variable: str = "pm25") -> dict[str, Any]:
    """Bundle map layers into one response to reduce frontend round-trips."""
    return {
        "sources": cached_sources(hour),
        "grid": cached_grid(hour, variable),
    }


def get_data_confidence(path) -> str:
    try:
        from pathlib import Path
        project_root = Path(__file__).resolve().parents[2]
        data_dir = project_root / "backend" / "data"
        live_dir = data_dir / "live"
        cache_dir = data_dir / "cache"
        
        # Explicitly check all inputs
        inputs = [
            ("weather", ".nc"), ("fires", ".csv"), ("hcho_hotspots", ".geojson"), 
            ("cpcb", ".csv"), ("forecast", ".nc"), ("aod", ".nc"), ("no2_satellite", ".nc")
        ]
        parents = []
        for base, ext in inputs:
            if (live_dir / f"{base}_live{ext}").exists() or (live_dir / f"{base}{ext}").exists():
                parents.append("live")
            elif (cache_dir / f"{base}_cache{ext}").exists() or (cache_dir / f"{base}{ext}").exists():
                parents.append("cache")
            else:
                parents.append("demo")
                
        if "demo" in parents: return "Low (demo data)"
        if "cache" in parents: return "Medium (cached data)"
        return "High (live data)"
    except Exception:
        return "Low (demo data)"
        if "cache" in parents: return "Medium (cached data)"
        return "High (live data)"
    except Exception:
        return "Low (demo data)"


import xarray as xr

@lru_cache(maxsize=1)
def cached_station_forecasts():
    stations = [s for s in cached_cpcb_latest() if s.get("lat") and s.get("lon")]
    model = get_demo_forecast_model()
    ds = model.predict(horizon=72)
    
    if not stations:
        return []
        
    station_lat = xr.DataArray([s["lat"] for s in stations], dims="station")
    station_lon = xr.DataArray([s["lon"] for s in stations], dims="station")
    
    linear_ds = ds.interp(lat=station_lat, lon=station_lon, method="linear")
    nearest_ds = ds.interp(lat=station_lat, lon=station_lon, method="nearest")
    interp_ds = linear_ds.combine_first(nearest_ds)
    
    results = []
    for i, s in enumerate(stations):
        station_id = s.get("station_id")
        station_name = s.get("station_name")
        forecast = []
        for h in range(72):
            frame = interp_ds.isel(time=h, station=i)
            # handle NaN if outside grid
            pm25 = _clamp(float(frame.pm25.item())) if not np.isnan(frame.pm25.item()) else 0
            pm10 = _clamp(float(frame.pm10.item())) if not np.isnan(frame.pm10.item()) else 0
            o3 = _clamp(float(frame.o3.item())) if not np.isnan(frame.o3.item()) else 0
            
            forecast.append({
                "hour": h,
                "timestamp": pd.Timestamp(frame.time.values).isoformat(),
                "pm25": pm25,
                "pm10": pm10,
                "o3": o3,
                "aqi": _aqi(pm25, pm10, o3)
            })
        results.append({
            "station_id": station_id,
            "station_name": station_name,
            "lat": s["lat"],
            "lon": s["lon"],
            "forecast": forecast,
            "scientific_status": "spatial interpolation of existing grid, not a new prediction"
        })
    return results

def get_dominant_drivers(hour: int):
    inversion = cached_inversion(hour)
    sources = cached_sources(hour)
    forecast = cached_forecast(hour + 1)["forecast"][hour]
    
    drivers = []
    if float(forecast["pbl_height_m"]) < 500:
        drivers.append(f"Low boundary layer height ({forecast['pbl_height_m']} m) trapping pollutants")
    if float(forecast["wind_speed_mps"]) < 2.0:
        drivers.append(f"Weak winds ({forecast['wind_speed_mps']} m/s) limiting dispersion")
        
    for cluster in sources.get("sources", []):
        if cluster.get("wind_alignment_score", 0) > 0.7 and cluster.get("stubble_intensity_score", 0) > 0.5:
            drivers.append(f"Incoming plume from stubble-burning cluster near {cluster.get('distance_to_delhi_km', 'unknown')}km away")
            break
            
    if inversion.get("category", "").lower() in ["strong", "severe"]:
        drivers.append("Strong temperature inversion detected")
        
    return drivers

def get_early_warnings():
    forecast = cached_forecast(72)["forecast"]
    alerts = []
    in_alert = False
    start_time = None
    peak_aqi = 0
    
    for row in forecast:
        aqi = row.get("aqi")
        if aqi is None: continue
        is_severe = aqi > 400
        if is_severe and not in_alert:
            in_alert = True
            start_time = row["timestamp"]
            peak_aqi = aqi
        elif is_severe and in_alert:
            peak_aqi = max(peak_aqi, aqi)
        elif not is_severe and in_alert:
            in_alert = False
            alerts.append({
                "start_time": start_time,
                "end_time": row["timestamp"],
                "predicted_aqi_range": f"400-{peak_aqi}",
                "severity_label": "Severe"
            })
            
    if in_alert:
        alerts.append({
            "start_time": start_time,
            "end_time": forecast[-1]["timestamp"],
            "predicted_aqi_range": f"400-{peak_aqi}",
            "severity_label": "Severe"
        })
    return alerts
