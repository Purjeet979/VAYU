"""Cached, serialisable backend views over the Phase 1–5 demo services."""

from __future__ import annotations

from functools import lru_cache
import threading
from typing import Any

import numpy as np

from .forecast_models import DemoForecastModel
from .inversion_intelligence import get_inversion_service
from .scenario_engine import compute_sub_indices
from .source_intelligence import get_source_intelligence_service


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
    return DemoForecastModel()

def get_demo_forecast_model() -> DemoForecastModel:
    """Keep the pre-generated NetCDF tensors in memory for the server lifetime."""
    with _model_lock:
        return _get_demo_forecast_model_cached()


@lru_cache(maxsize=74)
def cached_forecast(hours: int, stubble_fraction: float = 1.0) -> dict[str, Any]:
    """Return a compact, deterministic timeline response for a scenario."""
    model = get_demo_forecast_model()
    rows = model.summary({"stubble_fraction": stubble_fraction}, horizon=hours)
    for row in rows:
        row["aqi"] = _aqi(row["pm25_ug_m3"], row["pm10_ug_m3"], row["o3_ug_m3"])
    return {
        "mode": "demo",
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
        "mode": "demo",
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
        "values": np.round(field.values, 3).tolist(),
    }


@lru_cache(maxsize=73)
def cached_sources(hour: int) -> dict[str, Any]:
    return get_source_intelligence_service().get_sources(hour)


@lru_cache(maxsize=73)
def cached_inversion(hour: int) -> dict[str, Any]:
    return get_inversion_service().get_inversion(hour)


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
        "mode": "demo",
        "data_source": "bundled_demo_dataset",
        "model": "RulesBasedExplanationPrototype",
        "model_version": "0.6.0",
        "scientific_status": "prototype evidence summary; not SHAP or scientifically calibrated",
        "hour": hour,
        "timestamp": forecast["timestamp"],
        "primary_drivers": drivers,
        "summary": "The displayed drivers are transparent prototype rules derived from the demo forecast, inversion, and source-intelligence outputs.",
    }
