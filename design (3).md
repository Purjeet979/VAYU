# VayuSangam --- Technical Demo Design

## 1. Demo objective

Build a credible, runnable prototype for **SIH26082 --- Air
Pollution--Weather Coupled Forecasting System (Delhi NCR Focus)**.

The demo must visually and technically prove this chain:

**Weather + satellite + fire + ground data → source intelligence →
coupled/physics-informed forecast representation → fast ML surrogate →
local correction → 72 h PM2.5/O3/AQI forecast → inversion/plume/source
explanation → what-if intervention.**

The prototype must work in two modes:

1.  **Demo Mode (mandatory):** uses bundled/sample NetCDF/CSV/GeoJSON
    data and pre-generated WRF-Chem-like forecast tensors so the UI
    works without HPC or API credentials.
2.  **Live/Research Mode (optional):** adapters for FIRMS,
    Sentinel-5P/Copernicus, CPCB/ground observations and actual WRF-Chem
    output can be enabled later.

Do not fake a completed WRF-Chem run. The UI must label demo/synthetic
data clearly.

------------------------------------------------------------------------

## 2. Repository strategy

Use official upstream repositories as the scientific foundation.

### Clone these

``` bash
git clone --recurse-submodules https://github.com/wrf-model/WRF.git third_party/WRF
git clone https://github.com/wrf-model/WPS.git third_party/WPS
git clone https://github.com/noaa-oar-arl/utilhysplit.git third_party/utilhysplit
```

WRF contains the WRF-Chem chemistry code. Do **not** clone an arbitrary
GitHub fork named `WRF-Chem`; use the official `wrf-model/WRF`
repository.

WPS prepares real-data WRF inputs. `utilhysplit` is useful for HYSPLIT
input/output processing and plume/trajectory utilities.

The first demo should NOT require compiling WRF on the developer laptop.
Keep WRF/WPS isolated under `third_party/` and provide an optional
Linux/WSL/HPC build path.

------------------------------------------------------------------------

## 3. High-level architecture

``` text
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                               │
│ FIRMS Fire/FRP │ Sentinel-5P │ Weather │ CPCB │ Demo NetCDF/CSV │
└───────────────┬─────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                 SOURCE INTELLIGENCE LAYER                       │
│ HCHO/NO2 anomaly + fire proximity + FRP + land use + wind       │
│ alignment + DBSCAN hotspot clustering                            │
└───────────────┬─────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────────┐
│             PHYSICS / FORECAST FEATURE LAYER                     │
│ PBLH │ temperature │ wind │ RH │ radiation │ stability          │
│ PM2.5 │ PM10 │ O3 │ NOx │ fire-emission scenario                │
│ WRF-Chem output / surrogate-ready tensors                       │
└───────────────┬─────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                 FAST INFERENCE LAYER                            │
│ Transformer/temporal surrogate → 0–72 h forecast fields          │
│ XGBoost bias correction → CPCB-aligned local forecast            │
└───────────────┬─────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                   DECISION LAYER                                │
│ AQI │ PM2.5 │ O3 │ inversion │ plume │ source attribution        │
│ uncertainty │ SHAP │ what-if stubble reduction                   │
└───────────────┬─────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────────┐
│                     WEB DASHBOARD                               │
│ 72 h timeline │ map │ plume │ inversion │ scenario comparison   │
│ source ranking │ explanation │ alerts                            │
└─────────────────────────────────────────────────────────────────┘
```

------------------------------------------------------------------------

## 4. Physics/ML boundary

### WRF-Chem = physics/ground-truth engine

Use WRF-Chem for offline/batch research runs:

-   meteorology
-   transport
-   gas/aerosol chemistry
-   emissions
-   aerosol-radiation feedback
-   PM2.5/PM10/O3/NOx fields

Its outputs become training/validation examples for the fast inference
layer.

### Transformer surrogate = real-time engine

Train a temporal/spatiotemporal model on WRF-Chem-like tensors.

Minimum MVP:

-   input: 6--12 historical/initial feature frames
-   horizon: 72 hourly steps
-   output: PM2.5, O3, PBLH, plume probability/transport field
-   architecture: small Conv/Temporal Transformer or ConvLSTM-style
    model
-   inference: CPU-compatible first; GPU optional

For a hackathon demo, the surrogate may initially be a trained/simple
model over prepared WRF-Chem-derived samples. It must have the same API
contract as a future production transformer.

### XGBoost = local correction

Train an XGBoost regressor using:

-   surrogate PM2.5/O3
-   CPCB observations
-   temperature
-   wind speed/direction
-   RH
-   PBLH
-   hour/day/season
-   source/fire indicators

Output:

`corrected_pm25`, `corrected_o3`, confidence/uncertainty estimate.

------------------------------------------------------------------------

## 5. Source intelligence

For each detected fire/source candidate calculate:

-   latitude/longitude
-   FRP
-   fire confidence
-   distance to Delhi NCR
-   wind direction
-   wind alignment score
-   estimated travel time
-   HCHO anomaly score
-   NO2 anomaly score where available
-   agricultural-land proximity
-   cluster ID
-   source contribution score

A source should only be called a likely contributor when multiple
signals agree.

Example score:

``` text
source_score =
    0.30 * normalized_FRP
  + 0.20 * HCHO_anomaly
  + 0.15 * NO2_anomaly
  + 0.15 * wind_alignment
  + 0.10 * proximity
  + 0.10 * agricultural_land_score
```

Keep weights configurable in YAML. Do not present this heuristic as
scientifically calibrated unless validated.

------------------------------------------------------------------------

## 6. Inversion intelligence

Calculate a demo inversion/trapping index from:

-   PBL height
-   near-surface temperature
-   vertical temperature gradient when available
-   wind speed
-   stability proxy

Return:

-   `Weak`
-   `Moderate`
-   `Strong`
-   `Severe`

Also return the numeric index and contributing variables.

The UI should explain:

> Stronger inversion + shallow PBL + weak winds → reduced dispersion →
> higher accumulation risk.

------------------------------------------------------------------------

## 7. What-if engine

The most important live demo interaction:

``` text
Scenario A: Stubble emissions = 100%
Scenario B: Stubble emissions = 70%
Scenario C: Stubble emissions = 40%
```

The user moves a slider.

The system modifies the source/emission feature tensor and runs the
surrogate again.

Display:

-   Delhi NCR PM2.5
-   AQI
-   O3
-   peak hour
-   plume intensity
-   source contribution
-   change vs baseline

Do not rerun WRF-Chem on every slider move.

------------------------------------------------------------------------

## 8. API design

### `GET /api/health`

Returns service status.

### `GET /api/forecast?hours=72`

Returns forecast time series and metadata.

### `GET /api/forecast/grid?hour=24&variable=pm25`

Returns spatial grid for map rendering.

### `GET /api/sources?hour=24`

Returns source clusters and attribution scores.

### `GET /api/inversion?hour=24`

Returns inversion/trapping metrics.

### `POST /api/scenario`

Request:

``` json
{
  "stubble_reduction": 0.30,
  "hour": 24
}
```

Response:

``` json
{
  "baseline_pm25": 178.4,
  "scenario_pm25": 141.7,
  "pm25_change": -36.7,
  "baseline_aqi": 312,
  "scenario_aqi": 248,
  "peak_hour_shift": 2
}
```

### `GET /api/explanation?hour=24`

Returns SHAP/top-feature explanations.

------------------------------------------------------------------------

## 9. Dashboard layout

### Top bar

-   VayuSangam
-   Delhi NCR
-   Demo/Live badge
-   data timestamp

### KPI row

-   Current PM2.5
-   24 h peak
-   72 h peak
-   O3
-   Inversion strength

### Main map

Layers:

1.  PM2.5 heatmap
2.  fire/FRP points
3.  HCHO hotspot clusters
4.  wind vectors
5.  plume trajectory
6.  Delhi NCR boundary

### Timeline

0--72 h slider.

### Right panel

-   Source attribution
-   inversion explanation
-   uncertainty
-   SHAP features

### What-if panel

Slider:

`Stubble emissions: 100% → 0%`

Compare baseline vs intervention.

------------------------------------------------------------------------

## 10. Technology stack

### Backend

-   Python 3.11+
-   FastAPI
-   Pydantic
-   NumPy
-   pandas
-   xarray
-   netCDF4/h5netcdf
-   scikit-learn
-   XGBoost
-   PyTorch
-   GeoPandas
-   Shapely

### Frontend

-   Next.js
-   TypeScript
-   Tailwind CSS
-   MapLibre GL JS
-   Recharts
-   Zustand or React state

### Data formats

-   NetCDF/Zarr for gridded fields
-   Parquet for tabular observations
-   GeoJSON for boundaries/hotspots
-   JSON for API responses

------------------------------------------------------------------------

## 11. Directory structure

``` text
vayu-sangam/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── models/
│   │   ├── services/
│   │   └── schemas/
│   ├── data/
│   │   ├── demo/
│   │   └── processed/
│   ├── ml/
│   │   ├── surrogate/
│   │   ├── correction/
│   │   └── explainability/
│   ├── pipelines/
│   └── tests/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
├── configs/
│   ├── demo.yaml
│   └── live.yaml
├── scripts/
├── notebooks/
├── third_party/
│   ├── WRF/
│   ├── WPS/
│   └── utilhysplit/
├── docs/
├── requirements.md
├── design.md
├── task.md
└── IDE_PROMPT.md
```

------------------------------------------------------------------------

## 12. Demo truthfulness rules

-   Never call synthetic values "real-time satellite data".
-   Clearly mark sample/demo data.
-   Never claim an ML metric until it has been computed on a held-out
    dataset.
-   Never claim WRF-Chem was run if only surrogate/demo tensors are
    being used.
-   Keep data provenance visible in the UI.
-   Make live adapters optional so the demo remains reproducible.
