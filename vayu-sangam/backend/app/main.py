from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
from datetime import datetime, timedelta

app = FastAPI(title="VayuSangam-AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to VayuSangam-AI Backend API"}

@app.get("/api/forecast/72-hours")
def get_72_hour_forecast():
    """
    Returns mock 72-hour forecast data for Delhi NCR.
    """
    forecast = []
    base_time = datetime.now()
    
    for i in range(72):
        time = base_time + timedelta(hours=i)
        
        # Simulate diurnal cycle
        hour = time.hour
        if 0 <= hour < 8:
            aqi_base = 350 # higher at night due to inversion
        elif 8 <= hour < 16:
            aqi_base = 250 # lower in day
        else:
            aqi_base = 300
            
        # Add random noise and trend
        aqi = int(aqi_base + random.uniform(-20, 50) + (i * 0.5))
        
        forecast.append({
            "time": time.isoformat(),
            "aqi": aqi,
            "pm25": aqi * 0.6,
            "pm10": aqi * 1.2,
            "temperature": round(15 + random.uniform(-2, 5) + (5 if 8 < hour < 18 else 0), 1),
            "wind_speed": round(random.uniform(0.5, 3.5), 1),
            "pbl_height": int(random.uniform(100, 300) if hour < 8 else random.uniform(500, 1500)),
            "inversion_strength": "SEVERE" if hour < 8 else "MODERATE" if hour > 18 else "WEAK",
            "plume_influence": random.choice([True, False, False])
        })
        
    return {"forecast": forecast}

@app.get("/api/map-layers")
def get_map_layers():
    """
    Returns mock map data points for visualization.
    """
    return {
        "active_fires": [
            {"lat": 30.3, "lon": 75.8, "frp": 12.5, "confidence": 85},
            {"lat": 29.9, "lon": 76.1, "frp": 8.0, "confidence": 70},
        ],
        "stubble_plume": {
            "origin": "Punjab",
            "trajectory": [
                {"lat": 30.3, "lon": 75.8},
                {"lat": 29.5, "lon": 76.5},
                {"lat": 28.7, "lon": 77.1} # Reaching Delhi
            ]
        }
    }

@app.get("/api/explainability")
def get_explainability():
    """
    Mock SHAP values/drivers.
    """
    return {
        "primary_drivers": [
            {"factor": "Strong atmospheric inversion", "impact": "+45 AQI"},
            {"factor": "Incoming crop-burning plume", "impact": "+80 AQI"},
            {"factor": "Low wind speed", "impact": "+20 AQI"}
        ],
        "summary": "Severe pollution episode expected due to nocturnal inversion combined with incoming biomass burning plume from North-West."
    }
