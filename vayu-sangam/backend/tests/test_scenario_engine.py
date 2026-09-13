"""Unit tests for Phase 5 – Scenario Engine.

Run with:
    source venv/bin/activate
    cd vayu-sangam
    python -m pytest backend/tests/test_scenario_engine.py -v
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app.scenario_engine import (
    ScenarioEngine,
    _linear_interpolate,
    _PM25_BREAKS,
    _PM10_BREAKS,
    _O3_BREAKS,
    compute_sub_indices,
    _max_sub_index_and_pollutant,
    get_scenario_engine,
)
from backend.app.schemas import AQISubIndices, ScenarioResponse


# ---------------------------------------------------------------------------
# CPCB AQI breakpoint interpolation
# ---------------------------------------------------------------------------

class TestLinearInterpolate:
    """Verify the piecewise linear AQI interpolation for known values."""

    @pytest.mark.parametrize("conc,expected_range", [
        (0.0,   (0,   50)),
        (15.0,  (0,   50)),
        (30.0,  (0,   50)),
        (45.0,  (51,  100)),
        (75.0,  (101, 200)),
        (105.0, (201, 300)),
        (200.0, (301, 400)),
        (300.0, (401, 500)),
    ])
    def test_pm25_range(self, conc: float, expected_range: tuple[int, int]):
        result = _linear_interpolate(_PM25_BREAKS, conc)
        lo, hi = expected_range
        assert lo <= result <= hi, f"PM2.5={conc} µg/m³ → AQI={result:.1f}, expected [{lo},{hi}]"

    @pytest.mark.parametrize("conc,expected_range", [
        (0.0,   (0,   50)),
        (25.0,  (0,   50)),
        (75.0,  (51,  100)),
        (175.0, (101, 200)),
        (300.0, (201, 300)),
        (400.0, (301, 400)),
        (500.0, (401, 500)),
    ])
    def test_pm10_range(self, conc: float, expected_range: tuple[int, int]):
        result = _linear_interpolate(_PM10_BREAKS, conc)
        lo, hi = expected_range
        assert lo <= result <= hi, f"PM10={conc} µg/m³ → AQI={result:.1f}, expected [{lo},{hi}]"

    @pytest.mark.parametrize("conc,expected_range", [
        (0.0,   (0,   50)),
        (25.0,  (0,   50)),
        (75.0,  (51,  100)),
        (135.0, (101, 200)),
        (190.0, (201, 300)),
    ])
    def test_o3_range(self, conc: float, expected_range: tuple[int, int]):
        result = _linear_interpolate(_O3_BREAKS, conc)
        lo, hi = expected_range
        assert lo <= result <= hi, f"O3={conc} µg/m³ → AQI={result:.1f}, expected [{lo},{hi}]"

    def test_above_upper_breakpoint_caps_at_500(self):
        assert _linear_interpolate(_PM25_BREAKS, 9999.0) == 500.0

    def test_negative_concentration_treated_as_zero(self):
        result = _linear_interpolate(_PM25_BREAKS, -10.0)
        assert 0.0 <= result <= 50.0

    def test_zero_concentration_gives_zero_aqi(self):
        assert _linear_interpolate(_PM25_BREAKS, 0.0) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# compute_sub_indices
# ---------------------------------------------------------------------------

class TestComputeSubIndices:
    def test_returns_aqi_sub_indices(self):
        result = compute_sub_indices(50.0, 80.0, 60.0)
        assert isinstance(result, AQISubIndices)

    def test_all_zero_gives_zero_sub_indices(self):
        result = compute_sub_indices(0.0, 0.0, 0.0)
        assert result.pm25 == pytest.approx(0.0)
        assert result.pm10 == pytest.approx(0.0)
        assert result.o3 == pytest.approx(0.0)

    def test_values_are_non_negative(self):
        result = compute_sub_indices(80.0, 150.0, 120.0)
        assert result.pm25 >= 0
        assert result.pm10 >= 0
        assert result.o3 >= 0


# ---------------------------------------------------------------------------
# max sub-index dominant pollutant
# ---------------------------------------------------------------------------

class TestMaxSubIndex:
    def test_pm25_dominates(self):
        sub = AQISubIndices(pm25=300.0, pm10=150.0, o3=80.0)
        aqi, dominant = _max_sub_index_and_pollutant(sub)
        assert dominant == "PM2.5"
        assert aqi == 300

    def test_pm10_dominates(self):
        sub = AQISubIndices(pm25=80.0, pm10=250.0, o3=60.0)
        aqi, dominant = _max_sub_index_and_pollutant(sub)
        assert dominant == "PM10"
        assert aqi == 250

    def test_o3_dominates(self):
        sub = AQISubIndices(pm25=40.0, pm10=30.0, o3=180.0)
        aqi, dominant = _max_sub_index_and_pollutant(sub)
        assert dominant == "O3"
        assert aqi == 180

    def test_dominant_is_valid_string(self):
        sub = AQISubIndices(pm25=100.0, pm10=200.0, o3=150.0)
        _, dominant = _max_sub_index_and_pollutant(sub)
        assert dominant in {"PM2.5", "PM10", "O3"}


# ---------------------------------------------------------------------------
# ScenarioEngine – integration tests on the real demo data
# ---------------------------------------------------------------------------

class TestScenarioEngine:
    @pytest.fixture(scope="class")
    def engine(self) -> ScenarioEngine:
        return ScenarioEngine()

    # --- basic validity ---

    def test_returns_scenario_response(self, engine):
        result = engine.run(stubble_reduction=0.30, hour=24)
        assert isinstance(result, ScenarioResponse)

    def test_mode_is_demo(self, engine):
        assert engine.run(0.0, 24).mode in ("demo", "live")

    def test_note_is_non_empty(self, engine):
        assert len(engine.run(0.0, 24).note) > 0

    # --- zero reduction means no change ---

    def test_zero_reduction_no_pm25_change(self, engine):
        result = engine.run(stubble_reduction=0.0, hour=24)
        assert result.pm25_change == pytest.approx(0.0, abs=0.2)

    def test_zero_reduction_no_pm10_change(self, engine):
        result = engine.run(stubble_reduction=0.0, hour=24)
        assert result.pm10_change == pytest.approx(0.0, abs=0.2)

    def test_zero_reduction_no_aqi_change(self, engine):
        result = engine.run(stubble_reduction=0.0, hour=24)
        assert result.aqi_change == 0

    # --- positive reduction means improvement ---

    def test_30pct_reduction_lowers_pm25(self, engine):
        result = engine.run(stubble_reduction=0.30, hour=24)
        assert result.pm25_change < 0, f"Expected PM2.5 decrease, got {result.pm25_change}"

    def test_30pct_reduction_lowers_pm10(self, engine):
        result = engine.run(stubble_reduction=0.30, hour=24)
        assert result.pm10_change < 0

    def test_30pct_reduction_lowers_or_equal_aqi(self, engine):
        result = engine.run(stubble_reduction=0.30, hour=24)
        assert result.aqi_change <= 0

    def test_60pct_bigger_delta_than_30pct(self, engine):
        r30 = engine.run(stubble_reduction=0.30, hour=24)
        r60 = engine.run(stubble_reduction=0.60, hour=24)
        assert r60.pm25_change < r30.pm25_change

    # --- O3 is unchanged ---

    def test_o3_unchanged_at_30pct_reduction(self, engine):
        result = engine.run(stubble_reduction=0.30, hour=24)
        assert result.baseline_o3 == pytest.approx(result.scenario_o3, abs=0.1)

    def test_o3_unchanged_at_60pct_reduction(self, engine):
        result = engine.run(stubble_reduction=0.60, hour=24)
        assert result.baseline_o3 == pytest.approx(result.scenario_o3, abs=0.1)

    # --- AQI values in range ---

    def test_baseline_aqi_positive(self, engine):
        assert engine.run(0.0, 24).baseline_aqi > 0

    def test_scenario_aqi_positive(self, engine):
        assert engine.run(0.3, 24).scenario_aqi > 0

    def test_scenario_aqi_leq_baseline_aqi(self, engine):
        for hour in [0, 12, 24, 48, 72]:
            result = engine.run(stubble_reduction=0.30, hour=hour)
            assert result.scenario_aqi <= result.baseline_aqi

    # --- dominant pollutant ---

    def test_dominant_pollutant_is_valid(self, engine):
        valid = {"PM2.5", "PM10", "O3"}
        for r in [0.0, 0.3, 0.6]:
            result = engine.run(stubble_reduction=r, hour=24)
            assert result.dominant_pollutant in valid
            assert result.scenario_dominant_pollutant in valid

    # --- sub-indices ---

    def test_sub_indices_are_non_negative(self, engine):
        result = engine.run(0.30, 24)
        for name, value in result.baseline_aqi_sub_indices.model_dump().items():
            assert value >= 0, f"baseline sub-index {name}={value}"
        for name, value in result.scenario_aqi_sub_indices.model_dump().items():
            assert value >= 0, f"scenario sub-index {name}={value}"

    # --- peak hour ---

    def test_peak_hour_shift_is_integer(self, engine):
        result = engine.run(0.30, 24)
        assert isinstance(result.peak_hour_shift, int)

    def test_peak_hours_in_valid_range(self, engine):
        result = engine.run(0.30, 24)
        assert 0 <= result.baseline_peak_pm25_hour <= 72
        assert 0 <= result.scenario_peak_pm25_hour <= 72

    # --- error handling ---

    def test_reduction_above_1_raises(self, engine):
        with pytest.raises(ValueError):
            engine.run(stubble_reduction=1.5, hour=24)

    def test_negative_reduction_raises(self, engine):
        with pytest.raises(ValueError):
            engine.run(stubble_reduction=-0.1, hour=24)

    def test_invalid_hour_raises(self, engine):
        with pytest.raises(ValueError):
            engine.run(stubble_reduction=0.30, hour=999)

    # --- singleton ---

    def test_singleton_returns_same_instance(self):
        e1 = get_scenario_engine()
        e2 = get_scenario_engine()
        assert e1 is e2
