# VayuSangam --- Requirements

## 1. Product requirement

Build a working technical prototype for SIH26082 that demonstrates
72-hour Delhi NCR air-pollution/weather coupled forecasting with source
attribution, inversion intelligence, and intervention simulation.

The prototype must prioritize a **working end-to-end demo** over a large
unfinished research stack.

------------------------------------------------------------------------

## 2. Functional requirements

### FR-01 --- 72-hour forecast

The system shall display hourly 0--72 h:

-   PM2.5
-   O3
-   PM10
-   NOx where available
-   temperature
-   wind speed/direction
-   PBL height
-   inversion/trapping level

### FR-02 --- Spatial forecast

The system shall render an hourly spatial field for at least:

-   PM2.5
-   O3

The MVP grid can be demo data, but the data contract must support
NetCDF/Zarr-derived grids.

### FR-03 --- Fire intelligence

The system shall ingest or simulate:

-   fire latitude/longitude
-   FRP
-   confidence
-   timestamp

The UI shall render fire points and intensity.

### FR-04 --- HCHO/source intelligence

The system shall support HCHO anomaly fields or demo HCHO hotspot data
and combine them with:

-   FRP
-   wind
-   distance
-   agricultural-land indicator

to produce source clusters and a ranked source-attribution list.

### FR-05 --- Plume tracking

The system shall display a source-to-Delhi transport path using
wind/trajectory data.

For MVP, a deterministic trajectory approximation is acceptable,
provided it is clearly labeled as a prototype transport layer.

### FR-06 --- Inversion intelligence

The system shall calculate and display:

-   inversion/trapping score
-   PBL height
-   wind speed
-   stability category

Categories:

`Weak / Moderate / Strong / Severe`

### FR-07 --- Fast forecast

The UI shall receive forecast results from a fast inference service.

The API must be model-agnostic so a Transformer surrogate can replace
the MVP model without changing the frontend.

### FR-08 --- Bias correction

An XGBoost correction layer shall be supported.

Inputs should include:

-   raw/surrogate PM2.5
-   raw/surrogate O3
-   meteorological variables
-   PBLH
-   source indicators
-   temporal features

### FR-09 --- What-if scenario

The user shall be able to change stubble-burning intensity.

At minimum:

-   100%
-   70%
-   40%

The system shall immediately recompute forecast outputs through the
surrogate/scenario layer.

### FR-10 --- Comparison

The UI shall show:

-   baseline PM2.5
-   scenario PM2.5
-   delta
-   baseline AQI
-   scenario AQI
-   delta percentage

### FR-11 --- Explainability

The UI shall show the top forecast drivers, e.g.:

-   PBL height
-   wind speed
-   fire/FRP
-   HCHO anomaly
-   temperature
-   humidity

If SHAP is available, use SHAP. Otherwise use a clearly labeled
feature-importance fallback.

### FR-12 --- Data provenance

Every forecast screen shall expose:

-   Demo / Live status
-   source
-   timestamp
-   model name/version
-   whether output is surrogate or WRF-Chem

------------------------------------------------------------------------

## 3. Non-functional requirements

### NFR-01 --- Reproducibility

A fresh developer must be able to start Demo Mode using documented
commands.

### NFR-02 --- Offline-first demo

The dashboard must work without internet after dependencies and demo
assets are installed.

### NFR-03 --- Performance

Target:

-   API health \< 500 ms
-   normal forecast query \< 2 s
-   what-if inference \< 5 s on a normal development machine

These are engineering targets, not scientific accuracy claims.

### NFR-04 --- Responsive UI

Dashboard must work at:

-   1366×768
-   1920×1080

### NFR-05 --- Error handling

No blank screens.

Show actionable messages for:

-   missing data
-   model unavailable
-   API failure
-   invalid scenario
-   missing environment variable

### NFR-06 --- Model abstraction

Model interface:

``` python
class ForecastModel:
    def predict(self, features, horizon=72):
        ...
```

Implement:

-   `DemoForecastModel`
-   `SurrogateForecastModel`

so the frontend/API never depends directly on PyTorch internals.

------------------------------------------------------------------------

## 4. Scientific requirements

The prototype should represent the coupled feedback concept:

``` text
Weather
  ↓
Transport / PBL / radiation
  ↓
Pollutant concentration
  ↓
Aerosol loading
  ↓
Radiation modification
  ↓
Temperature / PBL change
  ↓
Transport + chemistry change
```

The MVP may represent this relationship through WRF-Chem-derived
training features and a surrogate model. Do not claim the browser is
performing a full two-way WRF-Chem integration.

------------------------------------------------------------------------

## 5. Data requirements

### Demo data

Create a small reproducible dataset covering Delhi NCR and nearby source
regions.

Minimum files:

``` text
forecast_demo.nc
fires_demo.csv
hcho_hotspots.geojson
cpcb_demo.csv
wind_demo.nc
delhi_ncr.geojson
source_clusters.geojson
```

### Live adapters

Optional:

-   NASA FIRMS API
-   Sentinel-5P/Copernicus data
-   CPCB observations
-   ERA5/NWP input
-   WRF-Chem NetCDF output

API credentials must be environment variables, never committed.

------------------------------------------------------------------------

## 6. Acceptance criteria

The demo is accepted only when a judge can perform this sequence:

1.  Open dashboard.
2.  See Delhi NCR forecast.
3.  Move 0--72 h slider.
4.  See PM2.5 map change.
5.  Turn on fire layer.
6.  Select a source cluster.
7.  See its FRP/HCHO/wind/source score.
8.  See plume direction toward Delhi.
9.  See inversion strength change over time.
10. Move stubble slider from 100% to 40%.
11. See PM2.5/AQI update within 5 seconds.
12. See baseline-vs-scenario comparison.
13. Open explanation and see why the peak occurred.
14. Confirm whether the screen is Demo or Live.

------------------------------------------------------------------------

## 7. Security

-   `.env` is gitignored.
-   API keys never enter frontend source.
-   No secrets in notebooks.
-   CORS restricted in production.
-   Uploaded files validated by type and size.

------------------------------------------------------------------------

## 8. Out of scope for first demo

Do NOT block the demo on:

-   full operational WRF-Chem compilation
-   real-time ingestion of every satellite product
-   nationwide 1 km forecasting
-   perfect AQI regulatory certification
-   mobile application
-   multi-cloud deployment
-   full chemistry data assimilation

These belong to later phases.
