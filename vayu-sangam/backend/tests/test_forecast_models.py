"""Tests for the Phase 4 deterministic demo forecast model."""

import unittest

from app.forecast_models import (
    DemoForecastModel,
    ForecastTrainingDataset,
    _scenario_fraction,
)


class DemoForecastModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = DemoForecastModel()

    def test_returns_requested_forecast_tensor_and_weather(self):
        result = self.model.predict(horizon=12)
        self.assertEqual(result.sizes["time"], 12)
        self.assertTrue({"pm25", "pm10", "o3", "nox", "u", "v", "t2", "rh", "pblh"}.issubset(result.data_vars))
        self.assertEqual(result.attrs["model"], "DemoForecastModel")

    def test_full_emission_scenario_matches_baseline(self):
        baseline = self.model.predict(horizon=4)
        full = self.model.predict({"stubble_fraction": 1.0}, horizon=4)
        self.assertTrue((baseline.pm25 == full.pm25).all().item())

    def test_reduced_stubble_reduces_source_sensitive_pm25(self):
        baseline = self.model.predict(horizon=4)
        reduced = self.model.predict({"stubble_fraction": 0.4}, horizon=4)
        self.assertLess(float(reduced.pm25.mean()), float(baseline.pm25.mean()))
        self.assertTrue((reduced.o3 == baseline.o3).all().item())

    def test_rejects_invalid_scenario_and_horizon(self):
        with self.assertRaises(ValueError):
            self.model.predict({"stubble_fraction": 1.1})
        with self.assertRaises(ValueError):
            self.model.predict(horizon=0)

    def test_training_dataset_contract(self):
        combined = self.model.predict(horizon=73)
        dataset = ForecastTrainingDataset(
            combined, ["pm25", "o3", "u", "v"], ["pm25", "o3"], history_hours=6, forecast_horizon=24
        )
        inputs, targets = dataset.sample(0)
        self.assertEqual(inputs.shape[0:2], (6, 4))
        self.assertEqual(targets.shape[0:2], (24, 2))


class ScenarioValidationTests(unittest.TestCase):
    def test_default_fraction_is_one(self):
        self.assertEqual(_scenario_fraction(None), 1.0)


if __name__ == "__main__":
    unittest.main()
