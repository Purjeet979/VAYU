"""
Official CPCB AQI Calculator.
Implements the exact multi-pollutant maximum sub-index logic with CPCB breakpoints.
Note: Since our model predicts hourly outputs, we apply these breakpoints assuming the predicted hour
acts as a block-average proxy (a known simplification for the demo).
"""
import math
from typing import Dict, Tuple

# Format: (B_LO, B_HI, I_LO, I_HI)
BREAKPOINTS = {
    "pm25": [
        (0, 30, 0, 50),
        (31, 60, 51, 100),
        (61, 90, 101, 200),
        (91, 120, 201, 300),
        (121, 250, 301, 400),
        (250.1, 1000, 401, 500)  # CPCB says >250 mapped to 401-500
    ],
    "pm10": [
        (0, 50, 0, 50),
        (51, 100, 51, 100),
        (101, 250, 101, 200),
        (251, 350, 201, 300),
        (351, 430, 301, 400),
        (430.1, 1000, 401, 500)
    ],
    "no2": [
        (0, 40, 0, 50),
        (41, 80, 51, 100),
        (81, 180, 101, 200),
        (181, 280, 201, 300),
        (281, 400, 301, 400),
        (400.1, 1000, 401, 500)
    ],
    "o3": [
        (0, 50, 0, 50),
        (51, 100, 51, 100),
        (101, 168, 101, 200),
        (169, 208, 201, 300),
        (209, 748, 301, 400),
        (748.1, 1000, 401, 500) # O3 has complex ranges, simplified upper bounds
    ],
    "co": [
        (0, 1.0, 0, 50),
        (1.1, 2.0, 51, 100),
        (2.1, 10.0, 101, 200),
        (10.1, 17.0, 201, 300),
        (17.1, 34.0, 301, 400),
        (34.1, 100, 401, 500)
    ],
    "so2": [
        (0, 40, 0, 50),
        (41, 80, 51, 100),
        (81, 380, 101, 200),
        (381, 800, 201, 300),
        (801, 1600, 301, 400),
        (1600.1, 3000, 401, 500)
    ]
}

def calculate_sub_index(pollutant: str, concentration: float) -> int:
    """Calculates the sub-index for a given pollutant according to CPCB formula."""
    if concentration < 0 or pollutant not in BREAKPOINTS:
        return 0
        
    for b_lo, b_hi, i_lo, i_hi in BREAKPOINTS[pollutant]:
        if concentration <= b_hi:
            # Handle values falling in the precision gap (e.g., 60.5 between 60 and 61)
            # by snapping to the lower bound of the current bracket
            if concentration < b_lo:
                concentration = b_lo
                
            # Ip = [(I_HI - I_LO) / (B_HI - B_LO)] * (Cp - B_LO) + I_LO
            val = ((i_hi - i_lo) / (b_hi - b_lo)) * (concentration - b_lo) + i_lo
            return int(round(val))
    
    # If concentration exceeds max defined bound, clamp to 500
    return 500

def calculate_overall_aqi(pollutants_dict: Dict[str, float]) -> Tuple[int, str]:
    """
    Returns the maximum AQI and the prominent pollutant.
    Expects dict like {"pm25": 45.2, "pm10": 120.5}
    """
    max_aqi = 0
    prominent = "none"
    
    # Needs at least one of PM2.5 or PM10 to form a valid overall AQI (CPCB rule)
    if pollutants_dict.get("pm25") is None and pollutants_dict.get("pm10") is None:
        return 0, "none"
        
    for p_name, p_val in pollutants_dict.items():
        if p_val is None:
            continue
        sub_index = calculate_sub_index(p_name.lower(), p_val)
        if sub_index > max_aqi:
            max_aqi = sub_index
            prominent = p_name
            
    return max_aqi, prominent
