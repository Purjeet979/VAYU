# VayuSangam-AI: Detailed Understanding & Implementation Guide

This document provides an in-depth summary of the `VayuSangam-AI.pdf` proposal, breaking down the architecture, algorithms, and features required for implementation.

## 1. Core Philosophy & Innovation
Conventional AQI systems only use meteorology (temperature, wind) as input features to predict pollution. They ignore that **high pollution itself changes the weather** (e.g., aerosols block sunlight, dropping temperatures and preventing pollution from dispersing). 

VayuSangam-AI addresses this with a physics-informed feedback loop:
`Meteorology → Chemistry → Aerosols → Radiation/PBL (Planetary Boundary Layer) → Meteorology`

### The 3-Layer Intelligence Architecture
1. **Layer 1 (Physics)**: **WRF-Chem** runs the coupled meteorological and atmospheric-chemistry simulation. It acts as the physical ground-truth.
2. **Layer 2 (Earth Observation)**: Satellites (Sentinel-5P, MODIS, INSAT) and ground stations detect actual pollutants and active fires in real-time.
3. **Layer 3 (Artificial Intelligence)**: **XGBoost / CNN-LSTM** models are used *only* to correct systematic forecast biases from the physics model, not to replace it.

---

## 2. Multi-Source Data Fusion Layer

| Data Source | Specific Variables / Purpose |
| :--- | :--- |
| **Sentinel-5P / TROPOMI** | NO₂, HCHO (Formaldehyde), CO, O₃, aerosol/cloud info. Identifies biomass burning. |
| **NASA FIRMS (VIIRS/MODIS)** | Active fires, thermal anomalies, fire location, confidence, **Fire Radiative Power (FRP)**. |
| **MODIS** | Aerosol Optical Depth (AOD) for validation. |
| **INSAT-3D/3DS** | Cloud conditions, surface/atmospheric temperature, humidity, radiation. |
| **CPCB Ground Stations** | Surface observations: PM2.5, PM10, NO₂, O₃, CO, SO₂. Used for Ground truth validation & ML bias correction. |
| **Meteorological Forecast** | Boundary initializations: temp, RH, pressure, wind speed/direction, vertical wind, radiation. |

---

## 3. Nested High-Resolution Modelling (WRF-Chem)
Running high-resolution models over all of India is too slow. The system uses a nested approach:
*   **Domain 1 (Regional - North India/IGP)**: Captures long-range pollution transport and Punjab/Haryana crop-burning emissions.
*   **Domain 2 (High-Resolution Delhi NCR)**: Resolves urban emissions, local meteorology, PBL evolution, inversion events, and incoming pollution plumes at a very granular level.

---

## 4. Key Intelligence Engines (To be Implemented)

### A. Dynamic Stubble-Burning Emission Intelligence
- **Mechanism**: Continuously collects NASA FIRMS data for Punjab, Haryana, UP, etc.
- **Computation**: Converts Fire Radiative Power (FRP) into relative biomass-burning intensity.
- **Output**: A **Dynamic Stubble Emission Map** (updating external fire contributions instead of assuming they are constant).

### B. HCHO-Assisted Biomass Burning Identification
- **Mechanism**: Re-uses the BAH (Bio-mass burning) hotspot methodology. 
- **Computation**: Sentinel-5P HCHO anomalies are clustered (using DBSCAN) and combined with VIIRS/MODIS fire data and wind directions.
- **Output**: Validates whether a pollution plume is from agricultural fires or urban sources based on Fire-HCHO Spatial Correlation and Wind Alignment.

### C. Atmospheric Inversion Intelligence Engine
- **Mechanism**: Analyzes vertical atmospheric profiles rather than just surface temp.
- **Computation**: Considers vertical temperature gradient, inversion depth/temperature difference, PBL height, surface wind, vertical mixing, and stability.
- **Output**: An **Atmospheric Trapping / Inversion Index** (e.g., "Inversion Strength: SEVERE, PBL Height: 240m").

### D. Stubble Plume Tracking (HYSPLIT/WRF)
- **Flow**: `Source → Emission strength → Wind trajectory → Vertical mixing → PBL interaction → Delhi-NCR intersection → Expected PM2.5 contribution`.
- **Output**: Actionable insights like: *"A high-intensity Punjab-Haryana plume is forecast to intersect western Delhi between 02:00–06:00 tomorrow."*

### E. AI Forecast Correction Layer
- **Mechanism**: `WRF-Chem → AI Bias Correction → Final Forecast`.
- **Features for ML Model**: WRF PM2.5, WRF PM10, WRF O₃, NOx, temperature, humidity, wind, PBL height, inversion index, fire intensity, HCHO, AOD, time, location.
- **Models**: **XGBoost** (primary interpretable model), **CNN-LSTM** (experimental high-res spatiotemporal model).

---

## 5. System Features & Dashboard

### Counterfactual Analysis (Major USP)
The ability to answer: *"What would Delhi's AQI be without today's stubble-burning plume?"*
- Compares **Scenario A** (Full emissions) vs **Scenario B** (Crop-fire emissions removed).
- Output: `ΔPM2.5 = PM2.5 Full - PM2.5 No-Fire`.

### Source Attribution (Explainable AI - SHAP)
Converts the platform from a number predictor into a decision-support system. It explains *why* the AQI is deteriorating:
- **Primary drivers**: Strong atmospheric inversion, Low PBL height, Weak winds, Incoming plume.

### Dashboard Requirements
1. **Main Map**: Interactive GIS (MapLibre/Leaflet). Toggle layers: AQI, PM2.5, PM10, O₃, NO₂, PBL height, HCHO, active fires, plume, wind vectors, inversion.
2. **72-Hour Forecast Slider**: 
   - `0-24h`: Operational forecast.
   - `24-48h`: Planning forecast.
   - `48-72h`: Early-warning forecast.
3. **Panels**: 
   - *Inversion*: Strength, depth, trapping probability.
   - *Stubble Plume*: Intensity, expected Delhi arrival.
   - *Station Forecast*: Specific CPCB station predictions.
   - *Explainability*: Dominant drivers.
4. **Early Warning Alerts**: E.g., *"ALERT — Severe Pollution Episode Expected (Time: Tomorrow 02:00–10:00, AQI 430-470, Confidence: High)"*
5. **Forecast Uncertainty**: Displays expected concentration intervals and confidence scores (e.g., "Confidence: 84%").

---

## 6. End-to-End Pipeline
1. **Data Preprocessing & Harmonisation**
2. **HCHO + Fire Hotspot Intelligence**
3. **Dynamic Biomass-Burning Emissions**
4. **Regional WRF-Chem Simulation**
5. **Delhi-NCR Nested WRF-Chem Simulation** (Coupling Meteorology ↔ Chemistry)
6. **Inversion Intelligence + HYSPLIT/WRF Plume Tracking**
7. **XGBoost/CNN-LSTM Bias Correction**
8. **AQI Calculation** (Uses Indian AQI breakpoints physically, not ML directly)
9. **SHAP Explainability**
10. **GIS Dashboard + Early Warning (72-hour forecast)**

---

## 7. Model Validation Strategy
The system must be evaluated against CPCB monitoring stations using:
- **Metrics**: MAE, RMSE, R², Mean Bias, AQI-category accuracy, severe-event detection rate.
- **Comparison**: Validate the "Proposed Hybrid" (WRF-Chem + Satellite + Fire + AI) against the "Baseline" (Conventional ML AQI) and "Physics" (WRF-Chem only).
