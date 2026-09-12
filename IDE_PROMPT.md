# IDE MASTER PROMPT --- VayuSangam Technical Demo

You are the lead full-stack + atmospheric-science engineer implementing
**VayuSangam**, a technical prototype for SIH2026 Problem Statement
**SIH26082: Air Pollution--Weather Coupled Forecasting System (Delhi NCR
Focus)**.

Read these files first and treat them as the project specification:

1.  `design.md`
2.  `requirements.md`
3.  `task.md`

Do not skip them.

## Primary goal

Build a **working, judge-ready technical demo**, not a collection of
disconnected mock screens.

The judge must be able to:

1.  view a 72-hour Delhi NCR PM2.5/O3 forecast,
2.  move through time,
3.  see fire/HCHO source intelligence,
4.  see wind/plume transport,
5.  see inversion/PBL conditions,
6.  understand why pollution peaks,
7.  change stubble-burning intensity,
8.  see the forecast update quickly,
9.  compare baseline vs intervention,
10. understand the model/data provenance.

## Scientific architecture

Use this conceptual pipeline:

`Weather + Satellite + Fire + Ground → Source Intelligence → Physics/WRF-Chem Feature Space → Fast Surrogate → XGBoost Correction → Forecast + Attribution + What-if`

Important:

-   WRF-Chem is the physics/ground-truth engine.
-   The browser dashboard must NOT run WRF-Chem interactively.
-   A Transformer/temporal surrogate is the fast inference engine.
-   XGBoost is the local observation-bias correction layer.
-   Demo Mode must work without WRF-Chem compilation.
-   Never claim synthetic data is real-time.
-   Never claim scientific accuracy without validation.

## Scientific repositories

Use official repositories:

``` bash
git clone --recurse-submodules https://github.com/wrf-model/WRF.git third_party/WRF
git clone https://github.com/wrf-model/WPS.git third_party/WPS
git clone https://github.com/noaa-oar-arl/utilhysplit.git third_party/utilhysplit
```

Do NOT replace the official WRF repository with an arbitrary GitHub
fork.

WRF contains WRF-Chem. WPS is the official preprocessing system.
`utilhysplit` can support HYSPLIT trajectory/input-output processing.

Do not block the first runnable demo on compiling WRF.

## Implementation rules

### Rule 1 --- Build in vertical slices

Implement one complete flow first:

`demo data → FastAPI → dashboard map → timeline → scenario`

Only after that add deeper ML/science components.

### Rule 2 --- Real APIs are adapters

Create interfaces:

``` python
class FireDataProvider:
    def get_fires(self, start, end, bbox): ...

class SatelliteDataProvider:
    def get_hcho(self, start, end, bbox): ...

class GroundDataProvider:
    def get_observations(self, start, end, stations): ...
```

Implement:

-   `DemoFireProvider`
-   `DemoSatelliteProvider`
-   `DemoGroundProvider`

Later implement live providers.

### Rule 3 --- Model abstraction

Create:

``` python
class ForecastModel:
    def predict(self, features, horizon=72):
        ...
```

Implement:

-   `DemoForecastModel`
-   `SurrogateForecastModel`

The API must not know PyTorch internals.

### Rule 4 --- Scenario abstraction

``` python
class ScenarioEngine:
    def run(self, stubble_fraction: float, hour: int):
        ...
```

Validate `0 <= stubble_fraction <= 1`.

### Rule 5 --- Data provenance

Every response should contain:

``` json
{
  "mode": "demo",
  "data_source": "bundled_demo_dataset",
  "model": "DemoForecastModel",
  "model_version": "0.1.0",
  "timestamp": "...",
  "scientific_status": "prototype"
}
```

## Frontend expectations

Make the dashboard look like a serious atmospheric-intelligence
platform.

Avoid:

-   generic admin-dashboard appearance,
-   excessive gradients,
-   random bright colors,
-   giant cards,
-   clutter,
-   tiny labels,
-   fake scientific charts with no units.

Use:

-   dark/neutral map,
-   restrained blue/cyan/orange warning palette,
-   clear typography,
-   strong spatial hierarchy,
-   compact KPI cards,
-   map-first layout.

### Main screen

Top:

-   VayuSangam
-   Delhi NCR
-   Demo/Live
-   model version
-   timestamp

KPI row:

-   PM2.5
-   AQI
-   O3
-   PBLH
-   Inversion

Center:

-   large map
-   PM2.5 layer
-   fire points
-   HCHO clusters
-   wind vectors
-   plume

Bottom:

-   0--72 h timeline

Right:

-   source attribution
-   inversion explanation
-   top drivers
-   uncertainty

Bottom/right:

-   What-if stubble emission slider

## Required API endpoints

Implement:

-   `GET /api/health`
-   `GET /api/forecast?hours=72`
-   `GET /api/forecast/grid?hour=24&variable=pm25`
-   `GET /api/sources?hour=24`
-   `GET /api/inversion?hour=24`
-   `POST /api/scenario`
-   `GET /api/explanation?hour=24`

Use typed Pydantic schemas.

## Demo dataset

Generate a reproducible Delhi NCR dataset.

Do not use arbitrary random noise.

Create spatially coherent synthetic fields:

-   PM2.5 plume
-   O3 field
-   wind field
-   PBLH cycle
-   fire clusters
-   HCHO hotspots
-   source-to-Delhi transport

The demo should have at least one visually obvious pollution episode.

For example:

-   source region north-west of Delhi,
-   stronger fire activity before the episode,
-   wind transporting the plume toward Delhi,
-   shallow PBL/strong inversion around the PM2.5 peak.

Label this as `DEMO / SYNTHETIC`.

## What-if behavior

When user changes:

`100% → 70% → 40%`

the system should:

1.  modify source emission features,
2.  run the fast model,
3.  apply correction,
4.  recompute PM2.5/AQI,
5.  update map/timeline/KPI,
6.  show delta vs baseline.

Target inference time: \<5 seconds.

Do not rerun WRF-Chem.

## AQI

Implement an explicit configurable AQI conversion module.

Do not bury AQI calculations inside frontend code.

Document the pollutant breakpoints/source used for the prototype.

If regulatory breakpoint data is not included in the repository, use a
clearly labeled prototype configuration and do not claim regulatory
certification.

## ML

First make the system work with `DemoForecastModel`.

Then implement:

### Surrogate

A compact temporal model using PyTorch.

Keep it small enough to run locally.

Inputs:

-   PM2.5
-   O3
-   temperature
-   wind u/v
-   RH
-   PBLH
-   fire/FRP
-   HCHO anomaly
-   hour features

Outputs:

-   PM2.5
-   O3
-   PBLH/plume features where useful

### XGBoost

Use it as local correction.

Persist model artifacts under:

`backend/ml/artifacts/`

Do not commit huge model binaries unless necessary.

## Testing

Write tests for:

-   source score
-   wind alignment
-   inversion classification
-   AQI conversion
-   scenario bounds
-   forecast endpoint
-   scenario endpoint
-   model interface

Add one end-to-end test:

`scenario request → forecast response → changed PM2.5`

## Development sequence

Execute in this order:

### Step 1

Create repository structure.

### Step 2

Create demo dataset.

### Step 3

Implement source intelligence.

### Step 4

Implement inversion engine.

### Step 5

Implement DemoForecastModel.

### Step 6

Implement FastAPI endpoints.

### Step 7

Implement dashboard.

### Step 8

Implement scenario slider.

### Step 9

Add explanation/feature importance.

### Step 10

Add optional Transformer surrogate.

### Step 11

Add optional live data adapters.

### Step 12

Write complete setup documentation.

Do not jump to Step 10 before Steps 1--8 work.

## Definition of done

Run:

``` bash
# backend
uvicorn backend.app.main:app --reload

# frontend
npm run dev
```

Then verify:

-   dashboard opens,
-   72h slider works,
-   map changes with time,
-   source clusters appear,
-   plume appears,
-   inversion changes,
-   scenario slider works,
-   PM2.5 changes,
-   baseline/scenario comparison works,
-   explanation works,
-   Demo badge is visible,
-   no API key is required for Demo Mode.

## Final instruction

When you finish each phase, report:

1.  files created,
2.  files changed,
3.  commands executed,
4.  tests passed,
5.  known limitations,
6.  exact next step.

Never silently replace scientific components with fake claims.

If a component cannot be implemented scientifically in the local
environment, implement a clean interface + reproducible demo
implementation and clearly mark it as prototype.
