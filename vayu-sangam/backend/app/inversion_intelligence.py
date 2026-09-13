"""Phase 3 – Inversion Intelligence Engine.

Computes a prototype Atmospheric Trapping / Inversion Index from:

  * PBL height          (pblh, m)
  * 2-metre temperature (t2, K)
  * Wind speed          (u/v → m s⁻¹)
  * Relative humidity   (rh, 0–100 %)

All inputs are read from the bundled demo wind_demo.nc.  The resulting index
is spatially averaged over the Delhi-NCR bounding box so a single scalar is
returned per forecast hour.

Inversion categories
--------------------
  Weak     : index < 0.25
  Moderate : 0.25 ≤ index < 0.50
  Strong   : 0.50 ≤ index < 0.75
  Severe   : index ≥ 0.75

These thresholds are prototype heuristics and have NOT been validated against
operational inversion classifications.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr


# ---------------------------------------------------------------------------
# Delhi-NCR domain
# ---------------------------------------------------------------------------
DELHI_LAT_MIN = 28.3
DELHI_LAT_MAX = 29.0
DELHI_LON_MIN = 76.8
DELHI_LON_MAX = 77.6

# Shallow PBL (m) that indicates strong trapping
PBLH_SHALLOW_M = 200.0
PBLH_DEEP_M = 1500.0

# Calm wind threshold (m s⁻¹) that indicates poor dispersion
WIND_CALM_MPS = 1.0
WIND_STRONG_MPS = 6.0

# Warm surface temperature (K) proxy for radiation / daytime mixing
T2_COOL_K = 283.15   # ~10 °C  (nocturnal / winter — trapping)
T2_WARM_K = 308.15   # ~35 °C  (hot day — deep mixing)

# High RH can suppress mixing (haze/fog)
RH_HIGH = 85.0
RH_LOW = 30.0


def _clamp_01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _inversion_category(index: float) -> str:
    if index >= 0.75:
        return "Severe"
    if index >= 0.50:
        return "Strong"
    if index >= 0.25:
        return "Moderate"
    return "Weak"


@dataclass(frozen=True)
class InversionPaths:
    wind: Path


@dataclass
class HourlyInversionResult:
    """Typed container for a single-hour inversion result."""
    mode: str
    data_source: str
    hour: int
    timestamp: str
    pblh_m: float
    wind_speed_mps: float
    temperature_k: float
    temperature_c: float
    rh_pct: float
    stability_proxy: float       # 0 (unstable/well-mixed) → 1 (very stable/trapped)
    pblh_norm: float             # normalised PBLH contribution  (high = shallow = bad)
    wind_norm: float             # normalised wind contribution   (high = calm = bad)
    inversion_index: float       # composite index [0, 1]
    category: str                # Weak / Moderate / Strong / Severe
    score_components: dict[str, float] = field(default_factory=dict)

    def as_api_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "data_source": self.data_source,
            "model": "InversionIntelligencePrototype",
            "model_version": "0.3.0",
            "scientific_status": "prototype heuristic; not scientifically calibrated",
            "hour": self.hour,
            "timestamp": self.timestamp,
            "domain": "Delhi NCR",
            "inversion_index": round(self.inversion_index, 3),
            "category": self.category,
            "pbl_height_m": round(self.pblh_m, 1),
            "wind_speed_mps": round(self.wind_speed_mps, 2),
            "temperature_c": round(self.temperature_c, 1),
            "relative_humidity_pct": round(self.rh_pct, 1),
            "stability_proxy": round(self.stability_proxy, 3),
            "score_components": {k: round(v, 3) for k, v in self.score_components.items()},
            "interpretation": _build_interpretation(self),
        }


def _build_interpretation(r: HourlyInversionResult) -> str:
    """Return a one-sentence human-readable explanation for the UI."""
    lines: list[str] = []

    if r.pblh_m < 300:
        lines.append(f"very shallow PBL ({r.pblh_m:.0f} m)")
    elif r.pblh_m < 600:
        lines.append(f"shallow PBL ({r.pblh_m:.0f} m)")

    if r.wind_speed_mps < 1.5:
        lines.append("near-calm winds")
    elif r.wind_speed_mps < 3.0:
        lines.append(f"light winds ({r.wind_speed_mps:.1f} m s⁻¹)")

    if r.rh_pct > 80:
        lines.append(f"high humidity ({r.rh_pct:.0f} %)")

    if not lines:
        return (
            f"Mixed conditions — {r.category.lower()} trapping potential "
            f"(index {r.inversion_index:.2f})."
        )

    conjoined = ", ".join(lines)
    return (
        f"{r.category} inversion: {conjoined} → reduced dispersion → "
        f"elevated accumulation risk (index {r.inversion_index:.2f})."
    )


class InversionIntelligenceService:
    """Reads weather_live.nc (if fresh) or wind_demo.nc and computes an inversion/trapping index per hour."""

    def __init__(self, paths: InversionPaths | None = None) -> None:
        project_root = Path(__file__).resolve().parents[2]
        demo_dir = project_root / "backend" / "data" / "demo"
        live_dir = project_root / "backend" / "data" / "live"
        
        wind_path = demo_dir / "wind_demo.nc"
        self.mode = "demo"
        self.data_source = "bundled_demo_dataset"
        
        live_weather = live_dir / "weather_live.nc"
        if live_weather.exists():
            import datetime, os
            try:
                mtime = live_weather.stat().st_mtime
                age_hours = (datetime.datetime.now().timestamp() - mtime) / 3600
                if age_hours <= 6:
                    wind_path = live_weather
                    self.mode = "live"
                    self.data_source = "live_weather_fetcher"
            except Exception:
                pass
                
        self.paths = paths or InversionPaths(wind=wind_path)
        self.ds = xr.open_dataset(self.paths.wind)
        # Slice to Delhi-NCR bounding box once at init
        self.ds_delhi = self.ds.sel(
            lat=slice(DELHI_LAT_MIN, DELHI_LAT_MAX),
            lon=slice(DELHI_LON_MIN, DELHI_LON_MAX),
        )
        self._total_hours = int(self.ds.sizes["time"])

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_inversion(self, hour: int = 24) -> dict[str, Any]:
        """Return inversion metrics for a single forecast hour."""
        if not 0 <= hour < self._total_hours:
            raise ValueError(
                f"hour must be between 0 and {self._total_hours - 1}, got {hour}"
            )
        result = self._compute_hour(hour)
        return result.as_api_dict()

    def get_inversion_series(self) -> list[dict[str, Any]]:
        """Return the inversion index for all 73 hours (for the timeline)."""
        return [self._compute_hour(h).as_api_dict() for h in range(self._total_hours)]

    # ------------------------------------------------------------------
    # Internal computation
    # ------------------------------------------------------------------

    def _compute_hour(self, hour: int) -> HourlyInversionResult:
        frame = self.ds_delhi.isel(time=hour)
        timestamp = str(self.ds.time.values[hour])

        # --- spatial mean over Delhi NCR box ---
        pblh = float(frame["pblh"].mean().item())
        t2   = float(frame["t2"].mean().item())
        rh   = float(frame["rh"].mean().item())
        u    = float(frame["u"].mean().item())
        v    = float(frame["v"].mean().item())
        wind_speed = math.hypot(u, v)

        # --- Normalised PBLH: high score = shallow PBL = poor dispersion ---
        pblh_norm = _clamp_01(
            (PBLH_DEEP_M - pblh) / (PBLH_DEEP_M - PBLH_SHALLOW_M)
        )

        # --- Normalised wind: high score = calm = poor dispersion ---
        wind_norm = _clamp_01(
            (WIND_STRONG_MPS - wind_speed) / (WIND_STRONG_MPS - WIND_CALM_MPS)
        )

        # --- Stability proxy from temperature ---
        # Cool/cold surface → stable atmosphere → trapping
        # Warm surface → convective mixing → dispersion
        stability = _clamp_01(
            (T2_WARM_K - t2) / (T2_WARM_K - T2_COOL_K)
        )

        # --- High RH contribution (haze / fog suppresses mixing) ---
        rh_norm = _clamp_01((rh - RH_LOW) / (RH_HIGH - RH_LOW))

        # --- Composite inversion index (weighted average) ---
        # Weights reflect relative importance; total = 1.0
        w_pblh      = 0.40
        w_wind      = 0.30
        w_stability = 0.20
        w_rh        = 0.10

        inversion_index = (
            w_pblh      * pblh_norm
            + w_wind      * wind_norm
            + w_stability * stability
            + w_rh        * rh_norm
        )
        inversion_index = _clamp_01(inversion_index)

        return HourlyInversionResult(
            mode=self.mode,
            data_source=self.data_source,
            hour=hour,
            timestamp=timestamp,
            pblh_m=pblh,
            wind_speed_mps=wind_speed,
            temperature_k=t2,
            temperature_c=t2 - 273.15,
            rh_pct=rh,
            stability_proxy=stability,
            pblh_norm=pblh_norm,
            wind_norm=wind_norm,
            inversion_index=inversion_index,
            category=_inversion_category(inversion_index),
            score_components={
                "pblh_norm":       pblh_norm,
                "wind_norm":       wind_norm,
                "stability_proxy": stability,
                "rh_norm":         rh_norm,
            },
        )


@lru_cache(maxsize=1)
def get_inversion_service() -> InversionIntelligenceService:
    """Singleton — load NetCDF once per server lifetime."""
    return InversionIntelligenceService()
