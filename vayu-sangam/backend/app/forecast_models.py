"""Forecast-model contracts and Phase 4 demo/ML implementations.

The bundled demo forecast is a pre-generated synthetic field.  It is used for
fast, deterministic UI inference; it does not run WRF-Chem at request time.
The optional PyTorch and XGBoost classes below deliberately require explicit
training data and checkpoints before they can be used in research/live mode.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

import numpy as np
import pandas as pd
import xarray as xr


DEFAULT_SOURCE_BACKGROUNDS = {"pm25": 50.0, "pm10": 80.0, "nox": 20.0}


class ForecastModel(ABC):
    """Model boundary consumed by APIs and scenario logic, never by the UI."""

    @abstractmethod
    def predict(self, features: Mapping[str, Any] | None = None, horizon: int = 72) -> xr.Dataset:
        """Return hourly forecast fields for ``horizon`` steps."""


@dataclass(frozen=True)
class ForecastPaths:
    forecast: Path
    wind: Path


def _scenario_fraction(features: Mapping[str, Any] | None) -> float:
    value = 1.0 if features is None else features.get("stubble_fraction", 1.0)
    try:
        fraction = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError("stubble_fraction must be a number between 0 and 1") from error
    if not 0.0 <= fraction <= 1.0:
        raise ValueError("stubble_fraction must be between 0 and 1")
    return fraction


class DemoForecastModel(ForecastModel):
    """NetCDF-backed deterministic forecast model for the offline demo.

    A stubble scenario only modifies the source-sensitive excess above the
    synthetic background concentration. Meteorology and O3 are left untouched;
    this keeps the mechanism explicit rather than claiming a chemistry model.
    """

    model_name = "DemoForecastModel"
    model_version = "0.4.0"

    def __init__(self, paths: ForecastPaths | None = None) -> None:
        project_root = Path(__file__).resolve().parents[2]
        demo_dir = project_root / "backend" / "data" / "demo"
        self.paths = paths or ForecastPaths(
            forecast=demo_dir / "forecast_demo.nc", wind=demo_dir / "wind_demo.nc"
        )
        self._forecast = xr.open_dataset(self.paths.forecast).load()
        self._weather = xr.open_dataset(self.paths.wind).load()
        if self._forecast.sizes.get("time") != self._weather.sizes.get("time"):
            raise ValueError("Demo forecast and weather files have incompatible time dimensions")

    @property
    def max_horizon(self) -> int:
        return int(self._forecast.sizes["time"])

    def predict(self, features: Mapping[str, Any] | None = None, horizon: int = 72) -> xr.Dataset:
        if not isinstance(horizon, int) or not 1 <= horizon <= self.max_horizon:
            raise ValueError(f"horizon must be an integer between 1 and {self.max_horizon}")
        fraction = _scenario_fraction(features)
        result = xr.merge([
            self._forecast.isel(time=slice(0, horizon)).copy(deep=True),
            self._weather.isel(time=slice(0, horizon)).copy(deep=True),
        ])
        for variable, background in DEFAULT_SOURCE_BACKGROUNDS.items():
            if variable in result:
                result[variable] = background + (result[variable] - background) * fraction

        result.attrs.update(
            {
                "mode": "demo",
                "data_source": "bundled_demo_dataset",
                "model": self.model_name,
                "model_version": self.model_version,
                "stubble_fraction": fraction,
                "scientific_status": "synthetic demo forecast; not scientifically validated",
                "scenario_note": (
                    "Stubble fraction scales source-sensitive PM2.5/PM10/NOx excess "
                    "above the synthetic background; it is not a chemistry rerun."
                ),
            }
        )
        return result

    def summary(self, features: Mapping[str, Any] | None = None, horizon: int = 72) -> list[dict[str, Any]]:
        """Return compact domain means suitable for a forecast timeline API."""
        prediction = self.predict(features=features, horizon=horizon)
        rows: list[dict[str, Any]] = []
        for hour in range(horizon):
            frame = prediction.isel(time=hour)
            rows.append(
                {
                    "hour": hour,
                    "timestamp": pd.Timestamp(frame.time.values).isoformat(),
                    "pm25_ug_m3": round(float(frame.pm25.mean().item()), 1),
                    "pm10_ug_m3": round(float(frame.pm10.mean().item()), 1),
                    "o3_ug_m3": round(float(frame.o3.mean().item()), 1),
                    "nox_ug_m3": round(float(frame.nox.mean().item()), 1),
                    "temperature_c": round(float(frame.t2.mean().item()) - 273.15, 1),
                    "wind_speed_mps": round(float(np.hypot(frame.u.mean().item(), frame.v.mean().item())), 2),
                    "pbl_height_m": round(float(frame.pblh.mean().item()), 1),
                }
            )
        return rows


class ForecastTrainingDataset:
    """Extracts fixed-shape temporal examples from aligned gridded datasets.

    It returns NumPy arrays so both PyTorch and other future ML frameworks can
    consume the same training data contract.
    """

    def __init__(
        self,
        dataset: xr.Dataset,
        input_variables: Sequence[str],
        target_variables: Sequence[str],
        history_hours: int = 6,
        forecast_horizon: int = 72,
    ) -> None:
        missing = set(input_variables).union(target_variables) - set(dataset.data_vars)
        if missing:
            raise ValueError(f"Training dataset lacks variables: {', '.join(sorted(missing))}")
        if history_hours < 1 or forecast_horizon < 1:
            raise ValueError("history_hours and forecast_horizon must be positive")
        self.dataset = dataset
        self.input_variables = tuple(input_variables)
        self.target_variables = tuple(target_variables)
        self.history_hours = history_hours
        self.forecast_horizon = forecast_horizon

    @property
    def sample_count(self) -> int:
        return max(0, int(self.dataset.sizes["time"]) - self.history_hours - self.forecast_horizon + 1)

    def sample(self, index: int) -> tuple[np.ndarray, np.ndarray]:
        if not 0 <= index < self.sample_count:
            raise IndexError(f"sample index must be between 0 and {self.sample_count - 1}")
        inputs = self.dataset[list(self.input_variables)].isel(time=slice(index, index + self.history_hours))
        targets = self.dataset[list(self.target_variables)].isel(
            time=slice(index + self.history_hours, index + self.history_hours + self.forecast_horizon)
        )
        # Shape: time, channel, latitude, longitude.
        return inputs.to_array().transpose("time", "variable", "lat", "lon").values, targets.to_array().transpose("time", "variable", "lat", "lon").values


class TemporalSurrogateForecastModel:
    """Optional PyTorch GRU surrogate with an explicit CPU fallback.

    This is intentionally not instantiated by Demo Mode: it needs a trained
    checkpoint from properly split WRF-Chem-like training data.
    """

    def __init__(self, checkpoint_path: str | Path, input_size: int, output_size: int, horizon: int = 72) -> None:
        try:
            import torch
            from torch import nn
        except ImportError as error:
            raise RuntimeError("Temporal surrogate requires the optional 'torch' dependency") from error
        self.torch = torch
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.horizon = horizon

        class TemporalGRU(nn.Module):
            def __init__(self) -> None:
                super().__init__()
                self.gru = nn.GRU(input_size, 64, batch_first=True)
                self.head = nn.Linear(64, horizon * output_size)

            def forward(self, inputs):
                _, state = self.gru(inputs)
                return self.head(state[-1]).reshape(inputs.shape[0], horizon, output_size)

        self.network = TemporalGRU().to(self.device)
        checkpoint = Path(checkpoint_path)
        if not checkpoint.is_file():
            raise FileNotFoundError(f"Surrogate checkpoint does not exist: {checkpoint}")
        state = torch.load(checkpoint, map_location=self.device, weights_only=True)
        self.network.load_state_dict(state["model_state_dict"] if "model_state_dict" in state else state)
        self.network.eval()

    def predict_features(self, features: np.ndarray) -> np.ndarray:
        """Predict aggregated targets from shape ``batch, history, features``."""
        with self.torch.no_grad():
            tensor = self.torch.as_tensor(features, dtype=self.torch.float32, device=self.device)
            return self.network(tensor).cpu().numpy()

    def save_checkpoint(self, checkpoint_path: str | Path) -> None:
        """Persist a trained surrogate state for later CPU/GPU-safe inference."""
        self.torch.save({"model_state_dict": self.network.state_dict()}, checkpoint_path)


class BiasCorrectionFeatureBuilder:
    """Creates an auditable feature matrix for a future XGBoost correction."""

    feature_names = (
        "raw_pm25", "raw_o3", "temperature_c", "wind_speed_mps", "pblh_m",
        "relative_humidity_pct", "hour_of_day", "fire_indicator",
    )

    def build(self, forecast: xr.Dataset, fire_indicator: float = 0.0) -> pd.DataFrame:
        records = []
        for index in range(int(forecast.sizes["time"])):
            frame = forecast.isel(time=index)
            timestamp = pd.Timestamp(frame.time.values)
            records.append(
                {
                    "timestamp": timestamp,
                    "raw_pm25": float(frame.pm25.mean().item()),
                    "raw_o3": float(frame.o3.mean().item()),
                    "temperature_c": float(frame.t2.mean().item()) - 273.15,
                    "wind_speed_mps": float(np.hypot(frame.u.mean().item(), frame.v.mean().item())),
                    "pblh_m": float(frame.pblh.mean().item()),
                    "relative_humidity_pct": float(frame.rh.mean().item()),
                    "hour_of_day": timestamp.hour,
                    "fire_indicator": float(fire_indicator),
                }
            )
        return pd.DataFrame.from_records(records)


class XGBoostBiasCorrector:
    """Optional, persisted local-bias correction model.

    Training requires time-aligned CPCB observations. The repository's current
    mock CPCB file does not overlap the November demo forecast, so this class
    refuses to imply a trained correction until aligned data is supplied.
    """

    def __init__(self, feature_names: Sequence[str] = BiasCorrectionFeatureBuilder.feature_names) -> None:
        self.feature_names = list(feature_names)
        self.model: Any | None = None

    def fit(self, feature_matrix: pd.DataFrame, observed_pm25: Sequence[float]) -> None:
        if len(feature_matrix) != len(observed_pm25) or feature_matrix.empty:
            raise ValueError("Features and aligned observed_pm25 values must be non-empty and the same length")
        try:
            from xgboost import XGBRegressor
        except ImportError as error:
            raise RuntimeError("Bias correction requires the optional 'xgboost' dependency") from error
        self.model = XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.05, objective="reg:squarederror")
        self.model.fit(feature_matrix[self.feature_names], observed_pm25)

    def predict(self, feature_matrix: pd.DataFrame) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Bias-correction model is not trained or loaded")
        return self.model.predict(feature_matrix[self.feature_names])

    def feature_importance(self) -> dict[str, float]:
        if self.model is None:
            raise RuntimeError("Bias-correction model is not trained or loaded")
        return {name: float(value) for name, value in zip(self.feature_names, self.model.feature_importances_)}

    def save(self, path: str | Path) -> None:
        if self.model is None:
            raise RuntimeError("Cannot save an untrained bias-correction model")
        try:
            import joblib
        except ImportError as error:
            raise RuntimeError("Saving XGBoost models requires the optional 'joblib' dependency") from error
        joblib.dump({"model": self.model, "feature_names": self.feature_names}, path)

    @classmethod
    def load(cls, path: str | Path) -> "XGBoostBiasCorrector":
        try:
            import joblib
        except ImportError as error:
            raise RuntimeError("Loading XGBoost models requires the optional 'joblib' dependency") from error
        saved = joblib.load(path)
        instance = cls(saved["feature_names"])
        instance.model = saved["model"]
        return instance
