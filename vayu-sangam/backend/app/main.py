from datetime import datetime, timezone

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
from .schemas import ScenarioRequest, ScenarioResponse

app = FastAPI(title="VayuSangam-AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to VayuSangam-AI Backend API", "docs": "/docs"}


@app.get("/api/health")
def get_health():
    """Validate that all bundled demo engines and assets are loadable."""
    try:
        model = get_demo_forecast_model()
        cached_sources(0)
        cached_inversion(0)
        return {
            "status": "ok",
            "mode": DATA_MODE,
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


@app.get("/api/forecast")
def get_forecast(hours: int = Query(default=72, ge=1, le=73, description="Number of hourly forecast steps")):
    """Return a cached timeline built from the deterministic demo forecast model."""
    return cached_forecast(hours)


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
                "time": row["timestamp"], "aqi": row["aqi"], "pm25": row["pm25_ug_m3"],
                "pm10": row["pm10_ug_m3"], "temperature": row["temperature_c"],
                "wind_speed": row["wind_speed_mps"], "pbl_height": row["pbl_height_m"],
                "inversion_strength": cached_inversion(row["hour"])["category"].upper(),
                "plume_influence": bool(cached_sources(row["hour"])["sources"]),
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
        return cached_cpcb()
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/api/cpcb/latest")
def get_cpcb_latest():
    """Return latest file-backed CPCB station observations for fast ranking UI."""
    try:
        return cached_cpcb_latest()
    except ValueError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

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
    """Return explainable prototype evidence for the selected forecast hour."""
    return build_explanation(hour)
