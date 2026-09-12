"""Phase 6 API contract tests without requiring an external HTTP client."""

import unittest

from fastapi import HTTPException
from pydantic import ValidationError

from app.main import (
    app,
    get_72_hour_forecast,
    get_explainability,
    get_explanation,
    get_forecast,
    get_forecast_grid,
    get_health,
    get_inversion,
    get_inversion_series,
    get_map_layers,
    get_sources,
    read_root,
    run_scenario,
)
from app.schemas import ScenarioRequest


class ApiContractTests(unittest.TestCase):
    def test_openapi_includes_all_documented_phase_six_routes(self):
        paths = app.openapi()["paths"]
        for path in (
            "/api/health", "/api/forecast", "/api/forecast/grid", "/api/sources",
            "/api/inversion", "/api/scenario", "/api/explanation",
        ):
            self.assertIn(path, paths)

    def test_all_get_endpoints_return_useful_payloads(self):
        self.assertIn("message", read_root())
        self.assertEqual(get_health()["status"], "ok")
        self.assertEqual(len(get_forecast(72)["forecast"]), 72)
        grid = get_forecast_grid(24, "pm25")
        self.assertEqual(grid["variable"], "pm25")
        self.assertEqual(len(grid["values"]), len(grid["lat"]))
        self.assertIn("sources", get_sources(24))
        self.assertIn("category", get_inversion(24))
        self.assertEqual(len(get_inversion_series()["series"]), 73)
        self.assertIn("primary_drivers", get_explanation(24))

    def test_compatibility_endpoints_are_deterministic_and_non_mock(self):
        first = get_72_hour_forecast()["forecast"]
        second = get_72_hour_forecast()["forecast"]
        self.assertEqual(first, second)
        self.assertEqual(len(first), 72)
        self.assertIn("primary_drivers", get_explainability())
        self.assertIn("sources", get_map_layers())

    def test_grid_variable_whitelist_returns_422(self):
        with self.assertRaises(HTTPException) as captured:
            get_forecast_grid(24, "not_a_variable")
        self.assertEqual(captured.exception.status_code, 422)

    def test_scenario_schema_and_endpoint(self):
        request = ScenarioRequest(stubble_reduction=0.3, hour=24)
        result = run_scenario(request)
        self.assertLess(result.scenario_pm25, result.baseline_pm25)
        with self.assertRaises(ValidationError):
            ScenarioRequest(stubble_reduction=1.1, hour=24)
        with self.assertRaises(ValidationError):
            ScenarioRequest(stubble_reduction=0.3, hour=73)


if __name__ == "__main__":
    unittest.main()
