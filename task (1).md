# VayuSangam --- Implementation Task Plan

## Phase 0 --- Repository setup

### T0.1 Create project

-   [x] Create `vayu-sangam/`
-   [x] Initialize Git
-   [ ] Add `.gitignore`
-   [ ] Add Python virtual environment instructions
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

-   [ ] DBSCAN on fire coordinates
-   [ ] cluster FRP sum/mean/max
-   [ ] cluster centroid

## T2.2 Wind alignment

-   [ ] Calculate bearing from source to Delhi
-   [ ] Calculate wind-direction difference
-   [ ] Convert to alignment score

## T2.3 Travel-time estimate

-   [ ] Estimate source-to-Delhi distance
-   [ ] Estimate travel time from wind speed
-   [ ] Return uncertainty band

## T2.4 Source score

Implement configurable score from `configs/demo.yaml`.

-   [ ] FRP
-   [ ] HCHO
-   [ ] NO2 if available
-   [ ] wind alignment
-   [ ] proximity
-   [ ] agriculture score

------------------------------------------------------------------------

# Phase 3 --- Inversion intelligence

-   [ ] Implement PBLH normalization
-   [ ] Implement wind-speed normalization
-   [ ] Implement stability proxy
-   [ ] Create inversion index
-   [ ] Map to four categories
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

## T4.2 Demo model

-   [ ] Load demo NetCDF
-   [ ] Return forecast tensor
-   [ ] Add deterministic scenario multiplier

## T4.3 Surrogate model

-   [ ] Build training dataset interface
-   [ ] Implement PyTorch temporal model
-   [ ] Save model checkpoint
-   [ ] Implement inference
-   [ ] Add CPU fallback

## T4.4 XGBoost correction

-   [ ] Build feature matrix
-   [ ] Train baseline XGBoost
-   [ ] Save model
-   [ ] Implement prediction
-   [ ] Add feature importance

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

-   [ ] Modify emission features
-   [ ] Run surrogate
-   [ ] Apply XGBoost correction
-   [ ] Recalculate AQI
-   [ ] Return delta
-   [ ] Cache repeated scenarios

------------------------------------------------------------------------

# Phase 6 --- Backend

## T6.1 FastAPI

-   [ ] `/api/health`
-   [ ] `/api/forecast`
-   [ ] `/api/forecast/grid`
-   [ ] `/api/sources`
-   [ ] `/api/inversion`
-   [ ] `/api/scenario`
-   [ ] `/api/explanation`

## T6.2 Validation

-   [ ] Pydantic schemas
-   [ ] invalid hour handling
-   [ ] variable whitelist
-   [ ] scenario range 0--1

## T6.3 Caching

-   [ ] Cache demo forecast
-   [ ] Cache grid tiles/JSON
-   [ ] Cache scenario responses

------------------------------------------------------------------------

# Phase 7 --- Frontend

## T7.1 Dashboard shell

-   [ ] Next.js
-   [ ] responsive layout
-   [ ] header
-   [ ] KPI cards

## T7.2 Map

-   [ ] Delhi NCR base map
-   [ ] PM2.5 raster/heatmap
-   [ ] fire points
-   [ ] HCHO clusters
-   [ ] wind vectors
-   [ ] plume line

## T7.3 Timeline

-   [ ] 0--72 h slider
-   [ ] play/pause
-   [ ] selected hour

## T7.4 Intelligence panels

-   [ ] inversion card
-   [ ] source attribution
-   [ ] explanation
-   [ ] uncertainty

## T7.5 What-if

-   [ ] stubble slider
-   [ ] baseline card
-   [ ] scenario card
-   [ ] delta visualization

------------------------------------------------------------------------

# Phase 8 --- Demo polish

-   [ ] Add Demo/Live badge
-   [ ] Add data provenance
-   [ ] Add model version
-   [ ] Add loading states
-   [ ] Add error states
-   [ ] Add empty states
-   [ ] Add "last updated"
-   [ ] Add unit labels
-   [ ] Remove scientific claims that are not validated

------------------------------------------------------------------------

# Phase 9 --- Judge flow

Prepare a 3-minute deterministic demo:

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

Show top drivers and SHAP/feature importance.

### 2:45--3:00

Show architecture/data provenance and explain:

**WRF-Chem = physics/ground truth** **Surrogate = fast inference**
**XGBoost = local correction**

------------------------------------------------------------------------

# Phase 10 --- Final verification

-   [ ] `docker compose up` works if Docker is provided
-   [ ] `npm run build` passes
-   [ ] backend tests pass
-   [ ] frontend loads with backend unavailable
-   [ ] demo mode works offline
-   [ ] no secret committed
-   [ ] no overlapping dashboard elements
-   [ ] no fake "real-time" claims
-   [ ] all API endpoints documented
