"""Deterministic source-intelligence calculations for the bundled demo data.

This module deliberately models transport as a simple prototype layer.  It is
not a replacement for a validated trajectory or dispersion model such as
HYSPLIT/WRF-Chem.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xarray as xr
import yaml


EARTH_RADIUS_KM = 6371.0088
DELHI_NCR = {"lat": 28.6139, "lon": 77.2090}


def haversine_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    """Return the great-circle distance between two WGS84 coordinates."""
    lat_a, lon_a, lat_b, lon_b = map(math.radians, (lat_a, lon_a, lat_b, lon_b))
    delta_lat = lat_b - lat_a
    delta_lon = lon_b - lon_a
    value = math.sin(delta_lat / 2) ** 2 + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(value))


def bearing_to_deg(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    """Return the initial compass bearing from point A to point B, clockwise from north."""
    lat_a, lon_a, lat_b, lon_b = map(math.radians, (lat_a, lon_a, lat_b, lon_b))
    delta_lon = lon_b - lon_a
    x = math.sin(delta_lon) * math.cos(lat_b)
    y = math.cos(lat_a) * math.sin(lat_b) - math.sin(lat_a) * math.cos(lat_b) * math.cos(delta_lon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def wind_to_direction_deg(u_eastward: float, v_northward: float) -> float:
    """Return the direction the wind is travelling towards, clockwise from north."""
    return (math.degrees(math.atan2(u_eastward, v_northward)) + 360) % 360


def angular_difference_deg(angle_a: float, angle_b: float) -> float:
    return abs((angle_a - angle_b + 180) % 360 - 180)


def wind_alignment_score(wind_to_deg: float, bearing_to_delhi_deg: float) -> float:
    """Score directional transport from 0 (away) to 1 (directly toward Delhi)."""
    difference = angular_difference_deg(wind_to_deg, bearing_to_delhi_deg)
    return max(0.0, math.cos(math.radians(difference)))


def dbscan_haversine(points: list[tuple[float, float]], epsilon_km: float, min_samples: int) -> list[int]:
    """A compact DBSCAN implementation using great-circle distance.

    Labels are zero-based cluster ids; ``-1`` is noise.  The demo has a small
    number of fires, so the transparent O(n²) neighbourhood lookup is a better
    fit than adding an otherwise-unused scikit-learn dependency.
    """
    if epsilon_km <= 0 or min_samples < 1:
        raise ValueError("epsilon_km must be positive and min_samples must be at least one")

    unvisited = -99
    labels = [unvisited] * len(points)

    def neighbours(index: int) -> list[int]:
        lat, lon = points[index]
        return [
            candidate
            for candidate, (candidate_lat, candidate_lon) in enumerate(points)
            if haversine_km(lat, lon, candidate_lat, candidate_lon) <= epsilon_km
        ]

    cluster_id = 0
    for point_index in range(len(points)):
        if labels[point_index] != unvisited:
            continue
        nearby = neighbours(point_index)
        if len(nearby) < min_samples:
            labels[point_index] = -1
            continue

        labels[point_index] = cluster_id
        seeds = list(nearby)
        seed_index = 0
        while seed_index < len(seeds):
            candidate = seeds[seed_index]
            if labels[candidate] == -1:
                labels[candidate] = cluster_id
            if labels[candidate] == unvisited:
                labels[candidate] = cluster_id
                candidate_neighbours = neighbours(candidate)
                if len(candidate_neighbours) >= min_samples:
                    for neighbour in candidate_neighbours:
                        if neighbour not in seeds:
                            seeds.append(neighbour)
            seed_index += 1
        cluster_id += 1
    return labels


@dataclass(frozen=True)
class SourcePaths:
    fires: Path
    hcho: Path
    wind: Path
    config: Path


class SourceIntelligenceService:
    """Loads demo assets and returns ranked fire-source clusters."""

    def __init__(self, paths: SourcePaths | None = None) -> None:
        project_root = Path(__file__).resolve().parents[2]
        demo_dir = project_root / "backend" / "data" / "demo"
        self.paths = paths or SourcePaths(
            fires=demo_dir / "fires_demo.csv",
            hcho=demo_dir / "hcho_hotspots.geojson",
            wind=demo_dir / "wind_demo.nc",
            config=project_root / "configs" / "demo.yaml",
        )
        self.config = self._load_config()
        self.fires = self._load_fires()
        self.hcho_hotspots = self._load_hcho_hotspots()
        self.wind = xr.open_dataset(self.paths.wind)

    def _load_config(self) -> dict[str, Any]:
        with self.paths.config.open(encoding="utf-8") as config_file:
            config = yaml.safe_load(config_file) or {}
        return config.get("source_intelligence", {})

    def _load_fires(self) -> pd.DataFrame:
        fires = pd.read_csv(self.paths.fires)
        required_columns = {"lat", "lon", "frp", "confidence", "timestamp"}
        missing = required_columns - set(fires.columns)
        if missing:
            raise ValueError(f"Fire data is missing required columns: {', '.join(sorted(missing))}")
        return fires

    def _load_hcho_hotspots(self) -> list[dict[str, float]]:
        with self.paths.hcho.open(encoding="utf-8") as hotspot_file:
            geojson = json.load(hotspot_file)
        return [
            {
                "lat": float(feature["geometry"]["coordinates"][1]),
                "lon": float(feature["geometry"]["coordinates"][0]),
                "anomaly": float(feature["properties"].get("hcho_anomaly_score", 0)),
            }
            for feature in geojson.get("features", [])
            if feature.get("geometry", {}).get("type") == "Point"
        ]

    def _wind_at(self, hour: int, lat: float, lon: float) -> tuple[float, float]:
        frame = self.wind.isel(time=hour).sel(lat=lat, lon=lon, method="nearest")
        return float(frame["u"].item()), float(frame["v"].item())

    def _nearest_hcho_anomaly(self, lat: float, lon: float) -> float:
        radius_km = float(self.config.get("hcho_match_radius_km", 75))
        nearby = [
            hotspot["anomaly"]
            for hotspot in self.hcho_hotspots
            if haversine_km(lat, lon, hotspot["lat"], hotspot["lon"]) <= radius_km
        ]
        return max(nearby, default=0.0)

    def get_sources(self, hour: int = 24) -> dict[str, Any]:
        total_hours = int(self.wind.sizes["time"])
        if not 0 <= hour < total_hours:
            raise ValueError(f"hour must be between 0 and {total_hours - 1}")

        epsilon_km = float(self.config.get("dbscan_epsilon_km", 25))
        min_samples = int(self.config.get("dbscan_min_samples", 3))
        points = list(self.fires[["lat", "lon"]].itertuples(index=False, name=None))
        labels = dbscan_haversine(points, epsilon_km, min_samples)
        clustered_fires = self.fires.assign(cluster_label=labels)
        clusters = []

        for label in sorted(label for label in set(labels) if label >= 0):
            members = clustered_fires[clustered_fires.cluster_label == label]
            centroid_lat = float(members.lat.mean())
            centroid_lon = float(members.lon.mean())
            clusters.append(
                {
                    "cluster_id": label + 1,
                    "centroid": {"lat": centroid_lat, "lon": centroid_lon},
                    "fire_count": int(len(members)),
                    "frp_sum": float(members.frp.sum()),
                    "frp_mean": float(members.frp.mean()),
                    "frp_max": float(members.frp.max()),
                    "mean_confidence": float(members.confidence.mean()),
                    "hcho_anomaly": self._nearest_hcho_anomaly(centroid_lat, centroid_lon),
                }
            )

        max_frp = max((cluster["frp_sum"] for cluster in clusters), default=1.0)
        weights = self.config.get("score_weights", {})
        for cluster in clusters:
            lat, lon = cluster["centroid"]["lat"], cluster["centroid"]["lon"]
            distance_km = haversine_km(lat, lon, DELHI_NCR["lat"], DELHI_NCR["lon"])
            bearing = bearing_to_deg(lat, lon, DELHI_NCR["lat"], DELHI_NCR["lon"])
            u_wind, v_wind = self._wind_at(hour, lat, lon)
            speed_mps = math.hypot(u_wind, v_wind)
            wind_direction = wind_to_direction_deg(u_wind, v_wind)
            alignment = wind_alignment_score(wind_direction, bearing)
            safe_speed_mps = max(speed_mps, float(self.config.get("minimum_wind_speed_mps", 0.5)))
            travel_hours = distance_km / (safe_speed_mps * 3.6)
            uncertainty_fraction = float(self.config.get("travel_time_uncertainty_fraction", 0.30))
            proximity_scale_km = float(self.config.get("proximity_scale_km", 250))
            proximity_score = max(0.0, 1 - distance_km / proximity_scale_km)
            normalized_frp = cluster["frp_sum"] / max_frp
            hcho_score = min(cluster["hcho_anomaly"] / 100, 1.0)
            agricultural_score = float(self.config.get("demo_agricultural_land_score", 1.0))
            no2_score = 0.0  # NO2 is not present in the Phase 1 demo assets.

            source_score = (
                float(weights.get("frp", 0.30)) * normalized_frp
                + float(weights.get("hcho", 0.20)) * hcho_score
                + float(weights.get("no2", 0.15)) * no2_score
                + float(weights.get("wind_alignment", 0.15)) * alignment
                + float(weights.get("proximity", 0.10)) * proximity_score
                + float(weights.get("agricultural_land", 0.10)) * agricultural_score
            )
            cluster.update(
                {
                    "distance_to_delhi_km": round(distance_km, 1),
                    "bearing_to_delhi_deg": round(bearing, 1),
                    "wind": {
                        "u_mps": round(u_wind, 2),
                        "v_mps": round(v_wind, 2),
                        "speed_mps": round(speed_mps, 2),
                        "direction_to_deg": round(wind_direction, 1),
                    },
                    "wind_alignment_score": round(alignment, 3),
                    "travel_time_hours": round(travel_hours, 1),
                    "travel_time_range_hours": [
                        round(travel_hours / (1 + uncertainty_fraction), 1),
                        round(travel_hours / (1 - uncertainty_fraction), 1),
                    ],
                    "score_components": {
                        "normalized_frp": round(normalized_frp, 3),
                        "hcho_anomaly": round(hcho_score, 3),
                        "no2": no2_score,
                        "wind_alignment": round(alignment, 3),
                        "proximity": round(proximity_score, 3),
                        "agricultural_land": round(agricultural_score, 3),
                    },
                    "source_score": round(source_score, 3),
                    "scientific_status": "prototype heuristic; not scientifically calibrated",
                }
            )

        clusters.sort(key=lambda cluster: cluster["source_score"], reverse=True)
        noise_count = int(sum(label == -1 for label in labels))
        timestamp = pd.Timestamp(self.wind.time.values[hour]).isoformat()
        return {
            "mode": "demo",
            "data_source": "bundled_demo_dataset",
            "model": "SourceIntelligencePrototype",
            "model_version": "0.2.0",
            "scientific_status": "prototype heuristic; not scientifically calibrated",
            "hour": hour,
            "timestamp": timestamp,
            "target": {"name": "Delhi NCR", **DELHI_NCR},
            "cluster_parameters": {"epsilon_km": epsilon_km, "min_samples": min_samples},
            "noise_fire_count": noise_count,
            "sources": clusters,
        }


@lru_cache(maxsize=1)
def get_source_intelligence_service() -> SourceIntelligenceService:
    return SourceIntelligenceService()
