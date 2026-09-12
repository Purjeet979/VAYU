"""Pydantic schemas for the VayuSangam API.

All schemas carry explicit field descriptions so that FastAPI can auto-generate
accurate OpenAPI documentation without any extra effort.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Scenario Engine  (POST /api/scenario)
# ---------------------------------------------------------------------------

class ScenarioRequest(BaseModel):
    """Input for a what-if stubble-reduction scenario."""

    stubble_reduction: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description=(
            "Fractional reduction in stubble-burning emissions: "
            "0.0 = no change (baseline), 1.0 = 100 % reduction."
        ),
    )
    hour: int = Field(
        default=24,
        ge=0,
        le=72,
        description="Forecast hour (0–72) to evaluate the scenario at.",
    )


class AQISubIndices(BaseModel):
    """Per-pollutant AQI sub-index breakdown (Indian CPCB method)."""

    pm25: float = Field(description="Sub-index for PM2.5")
    pm10: float = Field(description="Sub-index for PM10")
    o3: float = Field(description="Sub-index for O3")


class ScenarioResponse(BaseModel):
    """Response for a what-if scenario run."""

    mode: str = Field(default="demo")
    scientific_status: str = Field(
        default="synthetic demo scenario; not scientifically validated"
    )
    note: str

    stubble_reduction: float
    hour: int

    # PM2.5
    baseline_pm25: float = Field(description="Baseline spatial-mean PM2.5 (µg m⁻³)")
    scenario_pm25: float = Field(description="Scenario spatial-mean PM2.5 (µg m⁻³)")
    pm25_change: float = Field(description="PM2.5 change vs baseline (µg m⁻³, negative = improvement)")

    # PM10
    baseline_pm10: float = Field(description="Baseline spatial-mean PM10 (µg m⁻³)")
    scenario_pm10: float = Field(description="Scenario spatial-mean PM10 (µg m⁻³)")
    pm10_change: float = Field(description="PM10 change vs baseline (µg m⁻³)")

    # O3 (unchanged by stubble slider)
    baseline_o3: float = Field(description="Baseline spatial-mean O3 (µg m⁻³)")
    scenario_o3: float = Field(description="Scenario O3 — identical to baseline (O3 is not a direct combustion product)")

    # AQI  (Indian CPCB: max sub-index across pollutants)
    baseline_aqi: int = Field(description="Baseline AQI (Indian CPCB max-sub-index method)")
    scenario_aqi: int = Field(description="Scenario AQI")
    aqi_change: int = Field(description="AQI change vs baseline (negative = improvement)")

    # Dominant pollutant
    dominant_pollutant: str = Field(description="Pollutant driving the baseline AQI (PM2.5 / PM10 / O3)")
    scenario_dominant_pollutant: str = Field(description="Pollutant driving the scenario AQI")

    # Sub-index breakdown
    baseline_aqi_sub_indices: AQISubIndices
    scenario_aqi_sub_indices: AQISubIndices

    # Peak hour
    baseline_peak_pm25_hour: int = Field(description="Hour (0–72) at which baseline PM2.5 peaks")
    scenario_peak_pm25_hour: int = Field(description="Hour (0–72) at which scenario PM2.5 peaks")
    peak_hour_shift: int = Field(description="Shift in peak PM2.5 hour (scenario − baseline)")
