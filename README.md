# VayuSangam-AI 🌬️

VayuSangam is an advanced, coupled 72-hour air quality and weather forecasting system for the Delhi NCR region. It combines high-resolution deterministic modeling with satellite intelligence to predict PM2.5, PM10, AQI, and atmospheric trapping events.

## Features
- **72-Hour Deterministic Forecasts**: NetCDF-backed predictions of PM2.5, PM10, O3, and meteorological variables.
- **Inversion & Trapping Intelligence**: Automated detection of Planetary Boundary Layer (PBLH) dynamics and stagnation.
- **Source Intelligence (Fires & HCHO)**: Clustering of active FIRMS biomass burning data and Tropomi formaldehyde anomalies.
- **Interactive Dashboard & Maps**: Real-time KPI tracking and interactive web mapping using Next.js and Leaflet.
- **VayuAI Chatbot**: An AI-powered intelligent assistant built on Groq API and Llama-3.1 to answer dynamic questions about Delhi NCR's air quality, forecasts, and pollution sources.

## Tech Stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Recharts, React-Leaflet
- **Backend**: FastAPI, Python 3.11, Xarray (NetCDF), Pandas, NumPy

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### 1. Backend Setup (FastAPI)
Navigate to the project directory and set up the Python environment:
```bash
cd vayu-sangam
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate   # On Windows
# source venv/bin/activate # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the API server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API will be available at `http://localhost:8000`. You can view the swagger docs at `http://localhost:8000/docs`.

### 2. Frontend Setup (Next.js)
Open a new terminal and navigate to the frontend directory:
```bash
cd vayu-sangam/frontend

# Install Node dependencies
npm install

# Start the development server
npm run dev
```
The frontend application will be available at `http://localhost:3000`.

## Architecture
The system uses a fallback architecture for data sources:
1. **Live Data**: Fetched periodically from external APIs (if configured).
2. **Cache**: Uses the last successful fetch.
3. **Demo Data**: Synthetic, pre-packaged NetCDF and CSV data ensuring the application works reliably in a disconnected or demo environment.

Data mode is controlled via the `DATA_MODE` variable in `.env`.

### Important Architecture Learnings
- **Explicit Data Cleanups**: When fixing a data-corruption bug (like future-dated timestamps caused by API parsing errors), it is fundamentally risky to assume the system will passively overwrite the corrupt data on the next fetch. If the next fetch fails (e.g. network timeout or API stale thresholds preventing fetch), the corrupt data survives in the cache and blocks analytical components indefinitely. **Always write explicit, one-time cleanup/migration scripts to actively purge corrupt data rather than relying on passive overwrites.**

### CAMS Global Cross-Validation (Phase 4)
- **Scope & Limitations**: The system integrates the Copernicus Atmosphere Monitoring Service (CAMS) as a cross-validation baseline to compare against local surrogate models (XGBoost). Due to its ~40km native resolution, CAMS typically underestimates localized episodic spikes (like stubble burning). We expose this limitation honestly rather than hiding it.
- **Bias Correction State**: A localized downscaling bias-correction XGBoost model is planned but explicitly disabled when insufficient overlapping CPCB training data (< 14 days) is available. The system intelligently detects this and honestly flags `"bias_correction": "not_yet_available"`.

### Operational Workarounds
- **OpenAQ Stale Threshold (120h)**: Due to consistent upstream API downtime (`api.data.gov.in`), the `STALE_THRESHOLD_HOURS` for the OpenAQ fallback has been temporarily relaxed from `72h` to `120h`. This ensures the demo dashboard has *some* recent live data explicitly labeled with its age, rather than displaying an empty pipeline. **This is an emergency operational workaround for the demo and must be reverted to `72h` for production once the primary source stabilizes.**

## License
MIT License
