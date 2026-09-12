# VayuSangam Technical Demo Starter

This package contains the engineering specification for the VayuSangam
SIH26082 technical demo.

## Scientific repositories

-   WRF: https://github.com/wrf-model/WRF
-   WPS: https://github.com/wrf-model/WPS
-   NOAA ARL utilhysplit: https://github.com/noaa-oar-arl/utilhysplit

## Recommended setup

Use Linux or WSL2 for the scientific stack.

``` bash
mkdir -p third_party
git clone --recurse-submodules https://github.com/wrf-model/WRF.git third_party/WRF
git clone https://github.com/wrf-model/WPS.git third_party/WPS
git clone https://github.com/noaa-oar-arl/utilhysplit.git third_party/utilhysplit
```

Do not require WRF compilation for the first dashboard demo.

## Demo-first strategy

Start with:

``` text
Bundled demo data
       ↓
FastAPI
       ↓
Next.js dashboard
       ↓
72h forecast
       ↓
Source + inversion
       ↓
What-if slider
```

Then replace individual modules with research-grade implementations.

## Important scientific positioning

WRF-Chem is the physics/chemistry engine used for offline/batch
experiments and generation/validation of training data.

The interactive dashboard uses a fast surrogate model.

XGBoost performs local bias correction against observations.

The demo must never imply that WRF-Chem is being rerun for every slider
movement.
