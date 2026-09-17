"""Real SHAP explainability using trained XGBoost model.

Falls back gracefully to None if model files are not found,
so the API continues to work in demo mode without the ML files.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import datetime

from backend.scripts.cpcb_history_store import get_lag_features

ML_DIR = Path(__file__).resolve().parents[1] / "data" / "ml"
PM25_MODEL_PATH = ML_DIR / "xgb_pm25.joblib"
AQI_MODEL_PATH  = ML_DIR / "xgb_aqi.joblib"
METADATA_PATH   = ML_DIR / "model_metadata.json"


@lru_cache(maxsize=1)
def _load_models() -> dict | None:
    """Load XGBoost models + metadata. Cached after first call."""
    try:
        import joblib
        import shap
    except ImportError:
        return None

    if not PM25_MODEL_PATH.exists() or not AQI_MODEL_PATH.exists():
        return None

    saved_pm25 = joblib.load(PM25_MODEL_PATH)
    saved_aqi  = joblib.load(AQI_MODEL_PATH)
    model_pm25 = saved_pm25["model"]
    model_aqi  = saved_aqi["model"]
    feature_names = saved_pm25["feature_names"]

    explainer = shap.TreeExplainer(model_pm25)

    metadata: dict = {}
    if METADATA_PATH.exists():
        with open(METADATA_PATH) as f:
            metadata = json.load(f)

    return {
        "model_pm25": model_pm25,
        "model_aqi": model_aqi,
        "explainer": explainer,
        "feature_names": feature_names,
        "metadata": metadata,
    }


def ml_available() -> bool:
    """Return True if trained model files are present and loadable."""
    return _load_models() is not None


def _current_weather_features(hour: int) -> pd.DataFrame | None:
    """
    Build a single-row feature DataFrame from current Open-Meteo live data.
    Returns None if live weather data is unavailable.
    """
    live_nc = Path(__file__).resolve().parents[1] / "data" / "live" / "weather_live.nc"
    demo_nc = Path(__file__).resolve().parents[1] / "data" / "demo" / "forecast_demo.nc"

    nc_path = live_nc if live_nc.exists() else (demo_nc if demo_nc.exists() else None)
    if nc_path is None:
        return None

    try:
        import xarray as xr
        ds = xr.open_dataset(nc_path)
        h = min(hour, int(ds.sizes["time"]) - 1)
        frame = ds.isel(time=h)

        # Fire features from live/demo CSV
        fire_csv = (
            Path(__file__).resolve().parents[1] / "data" / "live" / "fires_live.csv"
        )
        if not fire_csv.exists():
            fire_csv = Path(__file__).resolve().parents[1] / "data" / "demo" / "fires_demo.csv"

        fire_count, fire_frp_sum, fire_frp_max = 0.0, 0.0, 0.0
        if fire_csv.exists():
            df_fire = pd.read_csv(fire_csv)
            if "frp" in df_fire.columns:
                fire_count   = float(len(df_fire))
                fire_frp_sum = float(df_fire["frp"].sum())
                fire_frp_max = float(df_fire["frp"].max())

        # Use dataset variables (names vary by demo vs live)
        def _get(var_candidates, default=0.0):
            for v in var_candidates:
                if v in ds.data_vars:
                    val = float(frame[v].mean().item())
                    return val
            return default

        t_c  = _get(["t2"], 288.15) - 273.15   # K → °C
        ws   = float(np.hypot(
            _get(["u"], 0.0), _get(["v"], 0.0)
        ))
        pblh = _get(["pblh"], 500.0)
        rh   = _get(["rh"], 60.0)

        ts   = pd.Timestamp(frame.time.values) if hasattr(frame, "time") else pd.Timestamp.now()

        # Get real lag features from DB
        target_time = (datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)).replace(minute=0, second=0, microsecond=0)
        lags = get_lag_features(target_time)
        
        if isinstance(lags, str):
            # Phase 0 constraint: If we don't have enough history, explicit short-circuit
            return None

        row = {
            "temperature_c": t_c,
            "relative_humidity_pct": rh,
            "wind_speed_mps": ws,
            "wind_dir_deg": 180.0,        # not stored in nc ?" use neutral
            "precipitation": 0.0,         # not stored in nc
            "pbl_height_m": pblh,
            "hour_of_day": ts.hour,
            "month": ts.month,
            "day_of_week": ts.dayofweek,
            "is_stubble_season": int(ts.month in (10, 11)),
            "fire_count_24h": fire_count,
            "fire_frp_sum_24h": fire_frp_sum,
            "fire_frp_max_24h": fire_frp_max,
            "pm25_lag1h": lags["pm25_lag1h"],
            "pm25_lag3h": lags["pm25_lag3h"],
            "pm25_lag24h": lags["pm25_lag24h"],
        }
        return pd.DataFrame([row])
    except Exception:
        return None


def explain_hour(hour: int) -> dict[str, Any] | None:
    """
    Return SHAP explanation for the given forecast hour.
    Returns None if the model is not available.
    """
    bundle = _load_models()
    if bundle is None:
        return None

    features_df = _current_weather_features(hour)
    if features_df is None:
        return None

    feature_names: list[str] = bundle["feature_names"]
    # Align columns to trained feature order
    for col in feature_names:
        if col not in features_df.columns:
            features_df[col] = 0.0
    X = features_df[feature_names]

    explainer = bundle["explainer"]
    shap_vals = explainer.shap_values(X)[0]   # shape: (n_features,)
    base_val  = float(explainer.expected_value)

    pred_pm25 = float(bundle["model_pm25"].predict(X)[0])
    pred_aqi  = float(bundle["model_aqi"].predict(X)[0])

    shap_dict = {
        name: round(float(val), 4)
        for name, val in zip(feature_names, shap_vals)
    }

    # Sort by absolute impact for easy display
    top_drivers = sorted(
        [{"feature": k, "shap": v, "direction": "increase" if v > 0 else "decrease"}
         for k, v in shap_dict.items()],
        key=lambda x: abs(x["shap"]),
        reverse=True,
    )

    formatted_drivers = [
        {
            "factor": f"{d['feature']} ({d['direction']})",
            "evidence": f"SHAP value {d['shap']:+.4f} µg/m³",
            "mechanism": f"Trained XGBoost model attribute contributing to PM2.5 {d['direction']}.",
        }
        for d in top_drivers[:6]
    ]

    metrics = bundle["metadata"].get("metrics", {})

    return {
        "model": "XGBoostAQIPredictor",
        "model_version": "1.0.0",
        "data_source": "trained_on_real_cpcb_data",
        "hour": hour,
        "prediction": {
            "pm25_ug_m3": round(pred_pm25, 2),
            "aqi": round(max(0, pred_aqi), 0),
        },
        "base_value_pm25": round(base_val, 2),
        "shap_values": shap_dict,
        "top_drivers": top_drivers[:6],
        "primary_drivers": formatted_drivers,
        "summary": "The displayed drivers are derived from trained XGBoost TreeExplainer SHAP values.",
        "model_metrics": {
            "pm25_r2":   metrics.get("pm25", {}).get("r2", None),
            "pm25_mae":  metrics.get("pm25", {}).get("mae", None),
            "aqi_r2":    metrics.get("aqi", {}).get("r2", None),
        },
        "train_range": bundle["metadata"].get("train_range", "unknown"),
        "scientific_status": "real XGBoost trained on CPCB observations 2015-2020",
    }
