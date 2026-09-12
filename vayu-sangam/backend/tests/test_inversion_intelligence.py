"""Unit tests for Phase 3 – Inversion Intelligence Engine.

Run with:
    source venv/bin/activate
    cd vayu-sangam
    python -m pytest backend/tests/test_inversion_intelligence.py -v
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

# Make the app package importable without installing
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app.inversion_intelligence import (
    DELHI_LAT_MAX,
    DELHI_LAT_MIN,
    DELHI_LON_MAX,
    DELHI_LON_MIN,
    PBLH_DEEP_M,
    PBLH_SHALLOW_M,
    WIND_CALM_MPS,
    WIND_STRONG_MPS,
    InversionIntelligenceService,
    _clamp_01,
    _inversion_category,
    get_inversion_service,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class TestClamp01:
    def test_below_zero_clamped(self):
        assert _clamp_01(-5.0) == 0.0

    def test_above_one_clamped(self):
        assert _clamp_01(1.5) == 1.0

    def test_zero_returned(self):
        assert _clamp_01(0.0) == 0.0

    def test_one_returned(self):
        assert _clamp_01(1.0) == 1.0

    def test_midpoint_unchanged(self):
        assert _clamp_01(0.5) == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# Category thresholds
# ---------------------------------------------------------------------------

class TestInversionCategory:
    @pytest.mark.parametrize("index,expected", [
        (0.00, "Weak"),
        (0.10, "Weak"),
        (0.24, "Weak"),
        (0.25, "Moderate"),
        (0.49, "Moderate"),
        (0.50, "Strong"),
        (0.74, "Strong"),
        (0.75, "Severe"),
        (1.00, "Severe"),
    ])
    def test_boundaries(self, index: float, expected: str):
        assert _inversion_category(index) == expected

    def test_all_valid_categories(self):
        valid = {"Weak", "Moderate", "Strong", "Severe"}
        for raw in [0.0, 0.25, 0.5, 0.75, 1.0]:
            assert _inversion_category(raw) in valid


# ---------------------------------------------------------------------------
# InversionIntelligenceService – integration tests on the real demo data
# ---------------------------------------------------------------------------

class TestInversionService:
    """These tests load wind_demo.nc from the repository, so they require
    the demo data to be present (generated in Phase 1)."""

    @pytest.fixture(scope="class")
    def service(self) -> InversionIntelligenceService:
        return InversionIntelligenceService()

    # --- basic validity ---

    def test_single_hour_returns_dict(self, service):
        result = service.get_inversion(hour=24)
        assert isinstance(result, dict)

    def test_required_keys_present(self, service):
        result = service.get_inversion(hour=0)
        required = {
            "hour", "timestamp", "inversion_index", "category",
            "pbl_height_m", "wind_speed_mps", "temperature_c",
            "relative_humidity_pct", "stability_proxy", "score_components",
            "interpretation", "mode", "data_source",
        }
        assert required.issubset(result.keys())

    def test_mode_is_demo(self, service):
        assert service.get_inversion(0)["mode"] == "demo"

    # --- numeric range checks ---

    def test_inversion_index_in_unit_interval(self, service):
        for hour in range(0, 73, 8):
            idx = service.get_inversion(hour)["inversion_index"]
            assert 0.0 <= idx <= 1.0, f"hour={hour}: index={idx}"

    def test_pblh_positive(self, service):
        for hour in range(0, 73, 8):
            pblh = service.get_inversion(hour)["pbl_height_m"]
            assert pblh > 0, f"hour={hour}: pblh={pblh}"

    def test_wind_speed_non_negative(self, service):
        for hour in range(0, 73, 8):
            ws = service.get_inversion(hour)["wind_speed_mps"]
            assert ws >= 0.0

    def test_category_is_valid_string(self, service):
        valid = {"Weak", "Moderate", "Strong", "Severe"}
        for hour in range(0, 73, 8):
            cat = service.get_inversion(hour)["category"]
            assert cat in valid, f"hour={hour}: unexpected category '{cat}'"

    def test_temperature_reasonable_celsius(self, service):
        for hour in range(0, 73, 8):
            t = service.get_inversion(hour)["temperature_c"]
            assert -20.0 <= t <= 60.0, f"hour={hour}: t={t} °C"

    # --- score components sum check ---

    def test_score_components_keys(self, service):
        sc = service.get_inversion(0)["score_components"]
        assert set(sc.keys()) == {"pblh_norm", "wind_norm", "stability_proxy", "rh_norm"}

    def test_score_components_in_unit_interval(self, service):
        sc = service.get_inversion(24)["score_components"]
        for name, value in sc.items():
            assert 0.0 <= value <= 1.0, f"{name}={value}"

    # --- series endpoint ---

    def test_series_length_is_73(self, service):
        series = service.get_inversion_series()
        assert len(series) == 73

    def test_series_hours_are_sequential(self, service):
        series = service.get_inversion_series()
        for expected_hour, entry in enumerate(series):
            assert entry["hour"] == expected_hour

    # --- error handling ---

    def test_invalid_hour_raises(self, service):
        with pytest.raises(ValueError, match="hour must be between"):
            service.get_inversion(hour=999)

    def test_negative_hour_raises(self, service):
        with pytest.raises(ValueError):
            service.get_inversion(hour=-1)

    # --- diurnal pattern sanity ---

    def test_night_hours_higher_index_than_midday(self, service):
        """Nocturnal hours should generally show stronger inversion than
        midday because PBLH is shallower and temperatures are lower."""
        night_indices = [service.get_inversion(h)["inversion_index"] for h in [0, 1, 2, 3]]
        midday_indices = [service.get_inversion(h)["inversion_index"] for h in [12, 13, 14]]
        assert sum(night_indices) / len(night_indices) > sum(midday_indices) / len(midday_indices), (
            "Expected night average inversion index > midday average"
        )

    # --- singleton cache ---

    def test_singleton_returns_same_instance(self):
        s1 = get_inversion_service()
        s2 = get_inversion_service()
        assert s1 is s2

    # --- interpretation string ---

    def test_interpretation_is_non_empty_string(self, service):
        for hour in [0, 24, 48, 72]:
            interp = service.get_inversion(hour)["interpretation"]
            assert isinstance(interp, str) and len(interp) > 0
