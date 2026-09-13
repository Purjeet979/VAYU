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

load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")
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
        "values": [[None if np.isnan(v) else v for v in row] for row in np.round(field.values, 3).tolist()],
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
