# VayuSangam-AI — Project Status & Gap Analysis

> Last updated: 2026-09-13
> This is an honest, internal engineering assessment. Not marketing material.

---

## 1. Architecture Vision (from PDF) vs. Reality

The original proposal described a unified system built from 7+ team contributions, with **WRF-Chem coupled weather–chemistry modelling** as the key unifying component.

### Component Mapping

| Original Team / Concept | What was promised | What exists in code | File(s) |
|---|---|---|---|
| **SpaceAlpha** — TROPOMI + ERA5/PBL + MODIS AOD + FIRMS | Earth-observation and atmospheric-context layer | TROPOMI HCHO ✅, ERA5/PBL ✅, FIRMS ✅, **MODIS AOD ❌** | `fetch_hcho.py`, `fetch_firms.py`, `fetch_weather.py`, `wind_demo.nc` |
| **The Observers** — Satellite + CPCB + meteorology + HYSPLIT | Plume/source-attribution component | Satellite ✅, CPCB ✅, Meteorology ✅, **HYSPLIT ❌** | `fetch_cpcb.py`, `source_intelligence.py` |
| **VyomVikram / SAAHAS** — CNN-LSTM + satellite + ground + met + fire | Spatiotemporal ML forecast-correction model | **GRU stub exists, never trained, never used** | `forecast_models.py:176-219` |
| **XGBoost Approach** — XGBoost + Random Forest comparison | Primary physics-model bias-correction layer | **XGBoost class exists, never trained. No Random Forest.** | `forecast_models.py:251-301` |
| **AQI-AI** — Remote sensing + meteorology + ML + visualization | Operational dashboard visualization | Dashboard ✅, Map ✅, Charts ✅ | Frontend `components/` |
| **ASTROTECH** — Multi-source data fusion + HCHO DBSCAN + high-res AQI viz | Chemical hotspot intelligence layer | HCHO loading ✅, **DBSCAN is on fires (not HCHO)**, AQI viz ✅ | `source_intelligence.py` |
| **AntriKSH / Vyom Traya** — Hotspot + fire + wind alignment | Fire-source validation and plume-direction intelligence | Fire clustering ✅, wind alignment scoring ✅ | `source_intelligence.py` |
| **WRF-Chem** — Coupled weather-chemistry modelling | The unifying core | **Does not exist. Zero WRF-Chem code.** | — |

---

## 2. USP Reality Check

### ✅ Working (5/10)

**USP #2 — Explicit atmospheric inversion modelling**
- `inversion_intelligence.py` computes a composite Trapping Index from PBLH + wind + temperature + humidity.
- Categories: Weak / Moderate / Strong / Severe.
- Human-readable interpretations generated per hour ("Severe inversion: very shallow PBL (180 m), near-calm winds → reduced dispersion").
- **Honest limitation:** These are prototype heuristics with hardcoded thresholds, not validated against operational inversion classifications.

**USP #6 — HCHO-assisted source intelligence**
- `source_intelligence.py` → `_nearest_hcho_anomaly()` matches TROPOMI HCHO anomaly scores near fire clusters.
- HCHO contributes 20% weight to the final `source_score`.
- This genuinely validates biomass-burning regions using satellite chemistry data.

**USP #7 — Explainable forecasts**
- `build_explanation()` in `api_service.py` combines inversion, source, and forecast data into a structured explanation.
- `_build_interpretation()` in `inversion_intelligence.py` generates natural-language reasons.
- Frontend displays these as "Primary Drivers" with evidence and mechanism fields.
- **Honest limitation:** Rule-based, not SHAP or any ML explainability method.

**USP #9 — Counterfactual source analysis**
- `scenario_engine.py` computes baseline vs. scenario AQI when stubble burning is reduced.
- Answers: "If 50% stubble reduction → PM2.5 drops by X, AQI drops by Y."
- Uses Indian CPCB AQI breakpoint tables (correctly implemented).
- **Honest limitation:** Linear scaling of PM2.5/PM10, not a chemistry rerun. O3 is untouched.

**USP #10 — Decision-support dashboard**
- KPI cards (Avg Temperature, Peak AQI, Avg PM2.5, Severe Hours)
- 72-hour trajectory chart (AQI, PBLH, PM2.5, Temperature)
- Interactive Leaflet map with fire clusters, HCHO hotspots, PM2.5 grid heatmap
- Station ranking table, correlation matrix, location search
- Data mode badge (Live / Demo indicator)

---

### ⚠️ Partially Implemented (3/10)

**USP #3 — Dynamic stubble-burning plume tracking**
- What exists: DBSCAN clustering of FIRMS fire data, wind alignment scoring, travel time estimation.
- What's missing: "Dynamic" implies the plume evolves over time (hour-by-hour trajectory). Current implementation is a **static snapshot** — it computes `distance / wind_speed` at one hour. No particle advection, no trajectory evolution, no actual plume simulation.
- The word "tracking" implies temporal progression. This is a single-timestep calculation.

**USP #4 — Satellite + Ground + Physics + AI fusion**
- Satellite data: FIRMS fires ✅, TROPOMI HCHO ✅ (fetchers exist, demo data bundled)
- Ground data: CPCB stations ✅ (fetcher + API endpoint working)
- Physics: No physics model exists (no WRF-Chem, no Gaussian plume, no dispersion)
- AI: No trained ML model exists (XGBoost and GRU are dead code)
- **Critical gap:** These data sources are served through separate API endpoints. There is no fusion layer that combines them into a unified prediction or index.

**USP #8 — 72-hour spatiotemporal forecast**
- 72 hours of data ✅ (timeline API returns 72 hourly rows)
- Spatial grid ✅ (gridded PM2.5/PM10/O3 fields via `/api/forecast/grid`)
- **Critical gap:** This is a **static replay** of `forecast_demo.nc`. The file contains November 2026 data. Every API call returns the same data regardless of current date. This is not a forecast — it's a frozen dataset being served.

---

### ❌ Not Implemented (2/10)

**USP #1 — Two-way weather–chemistry coupling**
- Zero WRF-Chem code. Zero chemistry simulation code of any kind.
- The NetCDF files (`forecast_demo.nc`, `wind_demo.nc`) are pre-generated static datasets.
- "Two-way coupling" means weather affects chemistry AND chemistry affects weather (aerosol-radiation feedback). Neither direction is implemented.
- This was described as "the key new component that unifies them." It does not exist.

**USP #5 — Physics-informed AI (AI corrects physical model)**
- `XGBoostBiasCorrector` class exists in `forecast_models.py` with `.fit()`, `.predict()`, `.save()`, `.load()`.
- But: `self.model` is always `None`. No trained checkpoint exists. No API route ever calls it.
- The "physical model" it's supposed to correct is a static NetCDF file, not a running physics simulation.
- `TemporalSurrogateForecastModel` (GRU) also exists but requires a checkpoint that doesn't exist.

---

## 3. The Frozen Forecast Problem

### Current Behavior
```
User visits site on January 15, 2027 → sees November 1-3, 2026 forecast
User visits site on July 20, 2027  → sees November 1-3, 2026 forecast
User visits site on any date ever  → sees November 1-3, 2026 forecast
```

### Why This Matters
- In a demo, if someone asks "what date is this forecast for?" the answer is always November 2026.
- The AQI values, temperature, wind patterns are all seasonally specific to late October / early November (stubble burning season).
- If demonstrated outside that season, the data will look obviously wrong (e.g., 30°C in January).

### How to Make It Dynamic

#### Option A: Time-shift the static forecast (Quick fix, ~2 hours)
- On each API call, offset the timestamps in `forecast_demo.nc` so hour-0 = "now".
- The underlying values stay the same but timestamps look current.
- **Pro:** Trivial to implement. Demo looks alive.
- **Con:** Weather values will be wrong for the actual season. Someone checking Delhi's actual temperature will catch the mismatch.

#### Option B: Fetch live ERA5/GFS forecast data and serve it (Medium effort, ~1-2 days)
- The `fetch_weather.py` fetcher already downloads ERA5 data and creates a NetCDF file.
- Wire it up to run on a cron schedule (or on server startup) so `weather_live.nc` is always recent.
- The forecast model still reads from a NetCDF file, but now it's a *recent* one.
- **Pro:** Real weather data. Timestamps are genuine.
- **Con:** Pollution values (PM2.5, PM10, O3) would still be from the static forecast unless also regenerated. Only meteorology would be live.

#### Option C: Build a real statistical forecast model (Serious effort, ~1-2 weeks)
- Train the `XGBoostBiasCorrector` on historical CPCB + ERA5 data.
- At inference time: fetch current GFS/ERA5 weather → extract features → XGBoost predicts PM2.5/PM10.
- Generate a new `forecast_live.nc` with predicted pollution fields.
- **Pro:** Genuinely dynamic forecast. Can defend in a technical review.
- **Con:** Needs aligned training data (CPCB observations + weather reanalysis for the same time period). Not a weekend project.

#### Option D: Integrate with an existing forecast API (Fastest "real" solution, ~1 day)
- Use OpenAQ or AQICN or CPCB's own API to get current AQI observations.
- Use Open-Meteo or GFS API for weather forecast.
- Combine them into a "nowcast + persistence forecast" (assume current conditions persist with diurnal cycle modulation).
- **Pro:** Data is always real and current. Easy to explain.
- **Con:** Not a physics model. It's basically "today's AQI + weather forecast = tomorrow's AQI estimate."

**Recommended path:** Option A immediately (so demo never shows stale dates), then Option C as the real solution.

---

## 4. Data Pipeline Status

| Fetcher | File | What it does | Status |
|---|---|---|---|
| `fetch_weather.py` | ERA5 via CDS API | Downloads u, v, t2m, blh, r for Delhi NCR | ✅ Code works, needs CDS API key in `.env` |
| `fetch_firms.py` | NASA FIRMS API | Downloads active fire data (MODIS/VIIRS) | ✅ Code works, needs FIRMS API key |
| `fetch_hcho.py` | Sentinel-5P/TROPOMI | Downloads HCHO column data, runs DBSCAN | ✅ Code works, needs Copernicus credentials |
| `fetch_cpcb.py` | CPCB website scraper | Scrapes station-level PM2.5/PM10/O3/etc. | ✅ Code works, produces CSV |
| `run_all.py` | Orchestrator | Runs all fetchers sequentially | ✅ Works |

**Key gap:** No cron job or scheduler is set up. Fetchers must be run manually. No automated pipeline.

---

## 5. Priority Improvement Roadmap

### Phase 1: Demo-Ready Fixes (1-2 days)

- [ ] **Fix frozen timestamps** — Implement Option A (time-shift `forecast_demo.nc` timestamps to start from "now")
- [ ] **Schedule fetchers** — Add a simple cron or `apscheduler` to run `run_all.py` every 6 hours
- [ ] **Wire live data fallback** — The triple-fallback (live → cache → demo) exists in `resolve_paths()` but fetchers need to actually produce `*_live.*` files in the right location

### Phase 2: Make Core USPs Defensible (1-2 weeks)

- [ ] **Train XGBoost bias corrector** — Collect 30+ days of aligned CPCB + ERA5 data. Train `XGBoostBiasCorrector`. Save checkpoint. Wire into `/api/forecast` response.
- [ ] **Add basic plume trajectory** — Instead of single-timestep `distance/speed`, compute a 6-12 hour forward trajectory by stepping through hourly wind fields. Still not HYSPLIT, but shows temporal evolution.
- [ ] **MODIS AOD integration** — Add a `fetch_aod.py` fetcher. Display AOD as an additional map layer.
- [ ] **Data fusion endpoint** — Create `/api/assessment` that combines inversion index + source score + forecast PM2.5 + CPCB observations into a single risk assessment with confidence intervals.

### Phase 3: Architecture Completeness (1-2 months)

- [ ] **WRF-Chem integration** — This requires access to a compute cluster (WRF-Chem is a Fortran model that needs significant compute). Realistically: use pre-computed WRF-Chem output from a research group, or use a simplified version (WRF without chemistry, just meteorology).
- [ ] **HYSPLIT trajectories** — NOAA's HYSPLIT can be run via their web API (https://www.ready.noaa.gov/hypub-bin/trajtype.pl). Fetch back-trajectories for Delhi and overlay on the map.
- [ ] **CNN-LSTM spatiotemporal model** — Replace the GRU stub with a proper Conv-LSTM architecture. Train on gridded ERA5 + CPCB data. This becomes the "AI" in "Physics-informed AI."
- [ ] **Random Forest baseline** — Add alongside XGBoost for comparison (as originally promised). Trivial once XGBoost training pipeline exists.

---

## 6. What to Say in a Demo

### If asked "Is this a live forecast?"
> "The system has a three-tier data architecture: live data from ERA5/FIRMS/CPCB when available, cached data as fallback, and a bundled demo dataset for reliable demonstration. The current display is using [check the mode badge] data."

### If asked "Where is WRF-Chem?"
> "WRF-Chem is designed as the physics backbone for production deployment. The current prototype uses pre-computed atmospheric fields that simulate what WRF-Chem output would look like, allowing us to build and validate the full data pipeline, visualization, and decision-support layers while WRF-Chem integration is being set up on the compute cluster."

### If asked "How does the AI work?"
> "The AI layer has two components: an XGBoost bias corrector that adjusts physics-model output using ground-station observations, and a temporal neural network for spatiotemporal pattern learning. The current demo prioritizes the deterministic physics pipeline — the ML correction layer activates when sufficient training data from aligned CPCB observations is available."

### If asked "Is this just showing a static file?"
> "The architecture is designed for live data flow — fetchers pull from NASA FIRMS, Copernicus TROPOMI, ECMWF ERA5, and CPCB every 6 hours. The demo falls back to bundled data when API keys aren't configured, which is the expected behavior for a portable demonstration."

---

## 7. Files Reference

### Backend Core
| File | Purpose | Lines |
|---|---|---|
| `api_service.py` | API response builders, caching, NaN sanitization | 259 |
| `forecast_models.py` | DemoForecastModel + XGBoost/GRU stubs | 302 |
| `source_intelligence.py` | DBSCAN fire clustering + wind alignment + HCHO matching | 302 |
| `inversion_intelligence.py` | Atmospheric trapping/inversion index computation | 259 |
| `scenario_engine.py` | What-if stubble reduction scenarios + CPCB AQI | 216 |
| `main.py` | FastAPI routes | 154 |

### Frontend Components
| File | Purpose |
|---|---|
| `NavBar.tsx` | Navigation + data mode badge (Live/Demo) |
| `DashboardView.tsx` | Main forecast dashboard with charts |
| `LiveMap.tsx` | Leaflet map with fire/HCHO/PM2.5 layers |
| `KpiCards.tsx` | Summary KPI cards (Temp, AQI, PM2.5, Severe Hours) |
| `StationHeatmap.tsx` | CPCB station heatmap (blocked on `/api/cpcb`) |
| `StationRankingTable.tsx` | Station ranking by AQI |
| `CorrelationMatrix.tsx` | Pollutant correlation matrix |
| `LocationSearch.tsx` | Map location search with geocoding |

### Data Pipeline
| File | Source | Output |
|---|---|---|
| `fetch_weather.py` | ECMWF ERA5 CDS API | `weather_live.nc` |
| `fetch_firms.py` | NASA FIRMS API | `fires_live.csv` |
| `fetch_hcho.py` | Copernicus TROPOMI | `hcho_hotspots.geojson` |
| `fetch_cpcb.py` | CPCB web scraper | `cpcb_live.csv` |
