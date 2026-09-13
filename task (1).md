# VayuSangam --- Implementation Task Plan

## Phase 0 --- Repository setup

### T0.1 Create project

-   [x] Create `vayu-sangam/`
-   [x] Initialize Git
-   [x] Add `.gitignore`
-   [x] Add Python virtual environment instructions
-   [x] Add Node/Next.js setup

### T0.2 Clone scientific dependencies

``` bash
git clone --recurse-submodules https://github.com/wrf-model/WRF.git third_party/WRF
git clone https://github.com/wrf-model/WPS.git third_party/WPS
git clone https://github.com/noaa-oar-arl/utilhysplit.git third_party/utilhysplit
```

-   [x] Verify repositories
-   [x] Do not modify upstream source initially
-   [x] Document Linux/WSL/HPC compilation separately

------------------------------------------------------------------------

# Phase 1 --- Demo data

## T1.1 Create reproducible Delhi grid

-   [x] Define Delhi NCR bounding box
-   [x] Generate 0.05°--0.1° demo grid
-   [x] Create 73 hourly timestamps
-   [x] Store latitude/longitude arrays

## T1.2 Generate weather features

Create realistic-looking but explicitly synthetic demo fields:

-   [x] temperature
-   [x] wind u/v
-   [x] RH
-   [x] PBLH
-   [x] radiation/stability proxy

Output:

`backend/data/demo/wind_demo.nc`

## T1.3 Generate pollution fields

-   [x] PM2.5
-   [x] O3
-   [x] PM10
-   [x] NOx

Use spatial Gaussian source plumes plus temporal evolution.

Output:

`backend/data/demo/forecast_demo.nc`

## T1.4 Generate fire data

Create:

-   [x] 20--100 fire points
-   [x] FRP
-   [x] confidence
-   [x] timestamps

Output:

`fires_demo.csv`

## T1.5 Generate HCHO hotspots

-   [x] Create hotspot polygons/points
-   [x] HCHO anomaly score
-   [x] cluster ID

Output:

`hcho_hotspots.geojson`

------------------------------------------------------------------------

# Phase 2 --- Source intelligence

## T2.1 Fire clustering

-   [x] DBSCAN on fire coordinates
-   [x] cluster FRP sum/mean/max
-   [x] cluster centroid

## T2.2 Wind alignment

-   [x] Calculate bearing from source to Delhi
-   [x] Calculate wind-direction difference
-   [x] Convert to alignment score

## T2.3 Travel-time estimate

-   [x] Estimate source-to-Delhi distance
-   [x] Estimate travel time from wind speed
-   [x] Return uncertainty band

## T2.4 Source score

Implement configurable score from `configs/demo.yaml`.

-   [x] FRP
-   [x] HCHO
-   [x] NO2 if available (reported as unavailable in current demo assets)
-   [x] wind alignment
-   [x] proximity
-   [x] agriculture score

------------------------------------------------------------------------

# Phase 3 --- Inversion intelligence

-   [x] Implement PBLH normalization
-   [x] Implement wind-speed normalization
-   [x] Implement stability proxy
-   [x] Create inversion index
-   [x] Map to four categories
-   [ ] Unit-test thresholds

------------------------------------------------------------------------

# Phase 4 --- Forecast engine

## T4.1 Model interface

Create:

``` python
class ForecastModel:
    def predict(self, features, horizon=72):
        raise NotImplementedError
```

-   [x] Model-agnostic forecast interface implemented

## T4.2 Demo model

-   [x] Load demo NetCDF
-   [x] Return forecast tensor
-   [x] Add deterministic scenario multiplier

## T4.3 Surrogate model

-   [x] Build training dataset interface
-   [x] Implement PyTorch temporal model
-   [x] Save model checkpoint (CODE EXISTS, NEVER TRAINED)
-   [x] Implement inference
-   [x] Add CPU fallback

## T4.4 XGBoost correction

-   [x] Build feature matrix
-   [ ] Train baseline XGBoost (CODE EXISTS, NEVER TRAINED)
-   [x] Save model
-   [x] Implement prediction
-   [x] Add feature importance

Do not report performance metrics unless a proper train/validation/test
split has been performed.

------------------------------------------------------------------------

# Phase 5 --- Scenario engine

Implement:

``` text
baseline = 1.0
moderate = 0.70
aggressive = 0.40
```

-   [x] Modify emission features
-   [ ] Run surrogate (MISSING MODEL CHECKPOINT)
-   [ ] Apply XGBoost correction (MISSING MODEL CHECKPOINT)
-   [x] Recalculate AQI
-   [x] Return delta
-   [x] Cache repeated scenarios

------------------------------------------------------------------------

# Phase 6 --- Backend

## T6.1 FastAPI

-   [x] `/api/health`
-   [x] `/api/forecast`
-   [x] `/api/forecast/grid`
-   [x] `/api/sources`
-   [x] `/api/inversion`
-   [x] `/api/scenario`
-   [x] `/api/explanation`

## T6.2 Validation

-   [x] Pydantic schemas
-   [x] invalid hour handling
-   [x] variable whitelist
-   [x] scenario range 0--1

## T6.3 Caching

-   [x] Cache demo forecast
-   [x] Cache grid tiles/JSON
-   [x] Cache scenario responses

------------------------------------------------------------------------

# Phase 7 --- Frontend

## T7.1 Dashboard shell

-   [x] Next.js
-   [x] responsive layout
-   [x] header
-   [x] KPI cards

## T7.2 Map

-   [x] Delhi NCR base map
-   [x] PM2.5 raster/heatmap (Mock GeoJSON implemented)
-   [x] fire points (Sourced from /api/sources)
-   [x] HCHO clusters
-   [x] wind vectors
-   [x] plume line

## T7.3 Timeline

-   [x] 0--72 h slider
-   [x] play/pause
-   [x] selected hour

## T7.4 Intelligence panels

-   [x] inversion card
-   [x] source attribution
-   [x] explanation
-   [x] uncertainty

## T7.5 What-if

-   [x] stubble slider
-   [x] baseline card
-   [x] scenario card
-   [x] delta visualization

------------------------------------------------------------------------

# Phase 8 --- Demo polish

-   [x] Add Demo/Live badge
-   [x] Add data provenance
-   [x] Add model version
-   [x] Add loading states
-   [x] Add error states
-   [x] Add empty states
-   [x] Add "last updated"
-   [x] Add unit labels
-   [x] Remove scientific claims that are not validated

------------------------------------------------------------------------

# Phase 9 --- Judge flow

Prepare a 3-minute deterministic demo:

> [!WARNING]
> The current codebase does NOT implement WRF-Chem or trained XGBoost models. You MUST adjust this script for the actual demo, otherwise you will be claiming features that do not exist in the codebase.

### 0:00--0:30

Show current Delhi NCR PM2.5/O3 and 72 h outlook.

### 0:30--1:00

Move time slider to the predicted peak.

Show:

-   shallow PBL
-   weak wind
-   inversion
-   PM2.5 increase

### 1:00--1:30

Enable source layer.

Click a Punjab/Haryana-region source cluster.

Show:

-   FRP
-   HCHO anomaly
-   wind alignment
-   travel-time estimate
-   plume toward Delhi

### 1:30--2:15

Open what-if.

Change stubble emissions:

`100% → 70% → 40%`

Show PM2.5/AQI reduction.

### 2:15--2:45

Open explanation.

Show top drivers and SHAP/feature importance. (NOTE: SHAP is not implemented, rule-based drivers are).

### 2:45--3:00

Show architecture/data provenance and explain:

**WRF-Chem = physics/ground truth** (NOTE: Missing from codebase)
**Surrogate = fast inference** (NOTE: Untrained skeleton only)
**XGBoost = local correction** (NOTE: Untrained skeleton only)

------------------------------------------------------------------------

# Phase 10 --- Final verification

-   [ ] `docker compose up` works if Docker is provided
-   [x] `npm run build` passes
-   [ ] backend tests pass
-   [x] frontend loads with backend unavailable
-   [x] demo mode works offline
-   [x] no secret committed
-   [x] no overlapping dashboard elements
-   [x] no fake "real-time" claims
-   [x] all API endpoints documented
