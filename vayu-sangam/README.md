# VayuSangam-AI 🌬️

VayuSangam is an advanced, coupled 72-hour air quality and weather forecasting system for the Delhi NCR region. It combines high-resolution deterministic modeling with satellite intelligence to predict PM2.5, PM10, AQI, and atmospheric trapping events.

## Features
- **72-Hour Deterministic Forecasts**: NetCDF-backed predictions of PM2.5, PM10, O3, and meteorological variables.
- **Inversion & Trapping Intelligence**: Automated detection of Planetary Boundary Layer (PBLH) dynamics and stagnation.
- **Source Intelligence (Fires & HCHO)**: Clustering of active FIRMS biomass burning data and Tropomi formaldehyde anomalies.
- **Interactive Dashboard & Maps**: Real-time KPI tracking and interactive web mapping using Next.js and Leaflet.

## Tech Stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Recharts, React-Leaflet
- **Backend**: FastAPI, Python 3.11, Xarray (NetCDF), Pandas, NumPy

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### 1. Backend Setup (FastAPI)
Navigate to the root directory and set up the Python environment:
```bash
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
cd frontend

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

## License
MIT License
