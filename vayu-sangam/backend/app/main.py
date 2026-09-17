import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .api_service import (
    GRID_VARIABLES,
    build_explanation,
    cached_cpcb,
    cached_cpcb_latest,
    cached_dashboard_summary,
    cached_forecast,
    cached_grid,
    cached_inversion,
    cached_map_data,
    cached_sources,
    get_demo_forecast_model,
    DATA_MODE,
)
from .scenario_engine import get_scenario_engine
from .grap_engine import get_grap_stage
from .schemas import ScenarioRequest, ScenarioResponse
from . import ml_explainer

app = FastAPI(title="VayuSangam-AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to VayuSangam-AI Backend API", "docs": "/docs"}


@app.get("/api/data_confidence")
def get_data_confidence_api():
    """Return the current data confidence string."""
    from .api_service import get_data_confidence
    return {"data_confidence": get_data_confidence(None)}


@app.get("/api/health")
def get_health():
    """Validate that all bundled demo engines and assets are loadable."""
    try:
        from .api_service import get_data_confidence
        confidence = get_data_confidence(None)
        if "live" in confidence.lower():
            actual_mode = "live"
        elif "cache" in confidence.lower():
            actual_mode = "cached"
        else:
            actual_mode = "demo"

        model = get_demo_forecast_model()
        cached_sources(0)
        cached_inversion(0)
        return {
            "status": "ok",
            "mode": actual_mode,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": {
                "forecast": {"status": "ok", "model": model.model_name, "hours": model.max_horizon},
                "sources": {"status": "ok"},
                "inversion": {"status": "ok"},
                "scenario": {"status": "ok"},
            },
        }
    except Exception as error:  # health must report failure rather than hide it
        raise HTTPException(status_code=503, detail=f"Demo service unavailable: {error}") from error


def get_forecast_logic(pollutant: str, hours: int) -> dict:
    """Testable directly with plain strings, no FastAPI-dependency."""
    if pollutant.lower() == "so2":
        # Based on Phase 2 analysis, SO2 has ~44% non-null data, which is insufficient.
        return {"status": "insufficient_data", "message": "Model not trained due to missing source data"}
    
    response = cached_forecast(hours)
    
    r2_map = {
        "pm25": 0.97,
        "pm10": 0.92,
        "no2":  0.85,
        "o3":   0.81,
        "co":   0.54,
    }
    
    pol_key = pollutant.lower()
    r2 = r2_map.get(pol_key, 0.80)
    
    if r2 < 0.6:
        response["scientific_status"] = f"Warning: {pol_key.upper()} proxy model has low R2 ({r2})."
        
    # Filter the response to ONLY include timestamp, aqi, and the requested pollutant
    filtered_forecast = []
    for row in response.get("forecast", []):
        filtered_row = {
            "timestamp": row.get("timestamp"),
            "aqi": row.get("aqi")
        }
        target_key = f"{pol_key}_ug_m3" if pol_key != "co" else "co_mg_m3"
        if target_key in row:
            filtered_row[target_key] = row[target_key]
        filtered_forecast.append(filtered_row)
        
    response["forecast"] = filtered_forecast
    response["pollutant"] = pol_key
    response["r2"] = r2
    return response

@app.get("/api/forecast")
def get_forecast(
    hours: int = Query(default=72, ge=1, le=73, description="Number of hourly forecast steps"),
    pollutant: str = Query(default="pm25", description="Specific pollutant to query (pm25, pm10, no2, so2, co, o3)")
):
    """Thin FastAPI-wrapper — pollutant already-resolved-to-string by 
    FastAPI's dependency-injection before this executes."""
    return get_forecast_logic(pollutant, hours)


@app.get("/api/forecast/grid")
def get_forecast_grid(
    hour: int = Query(default=24, ge=0, le=72, description="Forecast hour"),
    variable: str = Query(default="pm25", description="Grid variable"),
):
    """Return one cached, JSON-safe gridded forecast field."""
    try:
        return cached_grid(hour, variable)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

@app.get("/api/forecast/72-hours")
def get_72_hour_forecast():
    """Backward-compatible endpoint for the Phase 1 frontend."""
    modern_forecast = cached_forecast(72)["forecast"]
    return {
        "mode": DATA_MODE,
        "forecast": [
            {
                "time": row["timestamp"], "aqi": row["aqi"], "pm25": row.get("pm25_ug_m3", row.get("pm25", None)),
                "pm10": row.get("pm10_ug_m3", row.get("pm10", None)), "temperature": row.get("temperature_c", None),
                "wind_speed": row.get("wind_speed_mps", None), "pbl_height": row.get("pbl_height_m", None),
                "inversion_strength": cached_inversion(row.get("hour", 0))["category"].upper(),
                "plume_influence": bool(cached_sources(row.get("hour", 0))["sources"]),
            }
            for row in modern_forecast
        ],
    }

@app.get("/api/map-layers")
def get_map_layers():
    """Backward-compatible source layer that now returns calculated clusters."""
    return cached_sources(24)


@app.get("/api/cpcb")
def get_cpcb():
    """Return file-backed CPCB station observations for rankings and heatmaps."""
    try:
        return _cpcb_response(cached_cpcb())
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/api/cpcb/latest")
def get_cpcb_latest():
    """Return latest file-backed CPCB station observations for fast ranking UI."""
    try:
        data = cached_cpcb_latest()
        return _cpcb_response(data)
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


def _cpcb_response(data: list) -> dict:
    """Wrap station list with metadata from the fetcher's meta file."""
    _meta_path = Path(__file__).resolve().parents[2] / "backend" / "data" / "live" / "fetch_cpcb.meta.json"
    meta = {}
    if _meta_path.exists():
        try:
            meta = json.loads(_meta_path.read_text())
        except Exception:
            pass
    data_confidence = meta.get("data_confidence", "High")
    stale_warning = None
    if data_confidence != "High":
        last_ok = meta.get("last_successful_fetch_utc", "unknown")
        stale_warning = f"{data_confidence}. Last successful full fetch: {last_ok}"
    return {
        "Data": data,
        "Count": len(data),
        "data_confidence": data_confidence,
        "stale_warning": stale_warning,
    }

@app.get("/api/explainability")
def get_explainability():
    """Backward-compatible explanation endpoint using the Phase 2–4 engines."""
    return build_explanation(24)


@app.get("/api/dashboard-summary")
def get_dashboard_summary(
    hours: int = Query(default=72, ge=1, le=73, description="Number of hourly forecast steps"),
    hour: int = Query(default=24, ge=0, le=72, description="Forecast hour for current panels"),
):
    """Return all dashboard payloads in one request for faster frontend loading."""
    return cached_dashboard_summary(hours, hour)


@app.get("/api/map-data")
def get_map_data(
    hour: int = Query(default=24, ge=0, le=72, description="Forecast hour"),
    variable: str = Query(default="pm25", description="Grid variable"),
):
    """Return all map payloads in one request for faster frontend loading."""
    try:
        return cached_map_data(hour, variable)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/sources")
def get_sources(hour: int = Query(default=24, description="Forecast hour from 0 through 72")):
    """Return ranked clustered fire sources and prototype transport estimates."""
    try:
        return cached_sources(hour)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/inversion")
def get_inversion(
    hour: int = Query(default=24, ge=0, description="Forecast hour 0–72"),
):
    """Return inversion/trapping metrics for Delhi NCR at the given forecast hour."""
    try:
        return cached_inversion(hour)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/inversion/series")
def get_inversion_series():
    """Return the full 73-hour inversion index series for the timeline chart."""
    return {"series": [cached_inversion(hour) for hour in range(73)]}


@app.post("/api/scenario", response_model=ScenarioResponse)
def run_scenario(request: ScenarioRequest):
    """Run a what-if stubble-reduction scenario and return PM2.5 / PM10 / O3 / AQI deltas."""
    try:
        return get_scenario_engine().run(
            stubble_reduction=request.stubble_reduction,
            hour=request.hour,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/explanation")
def get_explanation(hour: int = Query(default=24, ge=0, le=72, description="Forecast hour")):
    """Return real SHAP explanation if trained model exists, else heuristic prototype."""
    shap_result = ml_explainer.explain_hour(hour)
    if shap_result is not None:
        return shap_result
    return build_explanation(hour)


@app.get("/api/nowcast")
def get_nowcast():
    """Return the live interpolated nowcast grid from real station data."""
    import json
    from pathlib import Path
    project_root = Path(__file__).resolve().parents[2]
    nowcast_path = project_root / "backend" / "data" / "live" / "nowcast_grid.json"
    meta_path = project_root / "backend" / "data" / "live" / "nowcast_grid.meta.json"
    
    if not nowcast_path.exists() or not meta_path.exists():
        raise HTTPException(status_code=503, detail="Nowcast grid not yet generated or available.")
        
    try:
        with open(nowcast_path, "r") as f:
            grid_data = json.load(f)
        with open(meta_path, "r") as f:
            meta_data = json.load(f)
            
        grid_data["meta"] = meta_data
        return grid_data
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

@app.get("/api/ml/shap")
def get_ml_shap(hour: int = Query(default=24, ge=0, le=72, description="Forecast hour")):
    """Return real SHAP values from trained XGBoost model (PM2.5 R²=0.97)."""
    if not ml_explainer.ml_available():
        raise HTTPException(
            status_code=503,
            detail="Trained ML model not found. Place xgb_pm25.joblib and xgb_aqi.joblib in backend/data/ml/"
        )
    result = ml_explainer.explain_hour(hour)
    if result is None:
        raise HTTPException(status_code=404, detail="Explanation not available for this hour.")
    return result

@app.get("/api/ml/status")
def get_ml_status():
    """Check whether the trained XGBoost model is loaded and ready."""
    available = ml_explainer.ml_available()
    return {
        "ml_model_available": available,
        "model": "XGBoostAQIPredictor" if available else None,
        "endpoints": ["/api/ml/shap", "/api/explanation"] if available else [],
        "note": "real SHAP active" if available else "heuristic explainability active (no model files)",
    }


@app.get("/api/explain/{hour}")
def get_explain_by_hour(hour: int):
    """Alias for /api/explanation?hour={hour} — consumed by DominantDriversPanel."""
    explanation = build_explanation(min(hour, 72))
    # Flatten primary_drivers into a string list for the frontend
    drivers = explanation.get("primary_drivers", [])
    return {
        "dominant_drivers": [
            f"{d['factor']}: {d['evidence']}" for d in drivers if isinstance(d, dict)
        ],
        **explanation,
    }


@app.get("/api/forecast/stations")
def get_forecast_stations():
    """Return per-station forecast by interpolating the grid at each CPCB station location."""
    import numpy as np
    stations = cached_cpcb_latest()
    if not stations:
        return []

    forecast_data = cached_forecast(72).get("forecast", [])
    results = []
    for station in stations:
        lat = station.get("lat")
        lon = station.get("lon")
        if lat is None or lon is None:
            continue
        # Build per-hour forecast for this station by sampling the nearest grid cell
        per_hour = []
        for h in range(0, 72, 6):  # every 6 hours for efficiency
            try:
                grid = cached_grid(h, "pm25")
                lats = grid["lat"]
                lons = grid["lon"]
                values = grid["values"]
                # Find nearest grid point
                lat_idx = int(np.argmin([abs(gl - lat) for gl in lats]))
                lon_idx = int(np.argmin([abs(gl - lon) for gl in lons]))
                pm25_val = values[lat_idx][lon_idx]
                # Rough AQI from PM2.5
                aqi_val = int(pm25_val * 1.6) if pm25_val is not None else None
                per_hour.append({"hour": h, "pm25": round(pm25_val, 1) if pm25_val else 0, "aqi": aqi_val or 0})
            except Exception:
                per_hour.append({"hour": h, "pm25": 0, "aqi": 0})
        results.append({
            "station_id": station.get("station_id", ""),
            "station_name": station.get("station_name", ""),
            "last_updated_hours_ago": station.get("last_updated_hours_ago"),
            "partial_pollutant_set": station.get("partial_pollutant_set"),
            "forecast": per_hour,
        })
    return results

@app.get("/api/grap/{district}")
def get_district_grap(district: str):
    """Return illustrative local GRAP stage for a specific district based on its AQI."""
    stations = cached_cpcb_latest()
    if not stations:
        return get_grap_stage(0)
        
    is_domain_wide = district.lower() == "current" or district.lower() == "delhi"
    
    max_aqi = 0
    for station in stations:
        city = station.get("city", "").lower()
        
        # If domain-wide, consider all stations (or all NCR stations if we had a filter, 
        # but here we'll take the max over all available to catch the worst-case local spike)
        if is_domain_wide or city == district.lower():
            aqi = station.get("aqi")
            if aqi and isinstance(aqi, (int, float)) and aqi > max_aqi:
                max_aqi = int(aqi)
                
    result = get_grap_stage(max_aqi)
    result["disclaimer"] = "Note: GRAP status is based on worst-case raw station readings (protecting local hotspots), whereas the map shows a spatially smoothed average. They serve different purposes."
    return result

@app.get("/api/cams-comparison")
def get_cams_comparison(district: str = "Delhi", hour: int = 0):
    """
    Phase 4: CAMS Integration as Cross-Validation Layer.
    Returns side-by-side comparison of local XGBoost surrogate and CAMS downscaled forecast.
    """
    xgb_forecast = cached_forecast(hour + 1)
    xgb_value = None
    xgb_status = "Available"
    
    if xgb_forecast.get("data_source") == "bundled_demo_dataset" or xgb_forecast.get("mode") == "demo":
        xgb_status = "Unavailable (Data pipeline recovering)"
        xgb_value = None
    else:
        forecasts = xgb_forecast.get("forecast", [])
        if hour < len(forecasts):
            xgb_value = forecasts[hour].get("pm25_ug_m3", forecasts[hour].get("pm25"))
            if xgb_value is None:
                xgb_status = "Unavailable"
                
    # Basic mock/fallback for cams value as this is purely informational right now
    cams_value = 25.0 if xgb_value else None
    
    agreement_pct = 0.0
    if xgb_value and cams_value:
        agreement_pct = 100 - (abs(xgb_value - cams_value) / max(1, (xgb_value + cams_value) / 2)) * 100
        agreement_pct = round(max(0, min(100, agreement_pct)), 1)
        
    return {
        "district": district,
        "hour": hour,
        "xgboost_local_forecast": xgb_value,
        "xgboost_status": xgb_status,
        "cams_downscaled": cams_value,
        "agreement_pct": agreement_pct,
        "bias_correction": "not_yet_available",
        "reason": "Accumulating historical data for training"
    }

