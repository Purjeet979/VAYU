from typing import Any

# Source: CAQM Revised GRAP Schedule (caqm.nic.in)
# Breakpoints correspond to the official revised GRAP (Graded Response Action Plan) stages for Delhi NCR.

def get_grap_stage(aqi: int) -> dict[str, Any]:
    """
    Returns the GRAP stage and mandated actions for a given AQI.
    Note: These are summary measures; refer to the official CAQM order for the complete list.
    """
    if aqi <= 200:
        return {
            "stage": "None",
            "category": "Moderate/Satisfactory/Good",
            "actions": [],
            "note": "AQI is below GRAP Stage I thresholds."
        }
    elif 201 <= aqi <= 300:
        return {
            "stage": "Stage I",
            "category": "Poor",
            "actions": [
                "Strict enforcement of PUC norms",
                "Ban on C&D activities (unregistered sites)",
                "Anti-smog guns at large sites"
            ],
            "note": "Summary of key measures; refer to official CAQM order for complete list"
        }
    elif 301 <= aqi <= 400:
        return {
            "stage": "Stage II",
            "category": "Very Poor",
            "actions": [
                "Ban on use of coal/firewood in tandoors",
                "Increased parking fees to discourage private transport",
                "Augment CNG/electric bus and metro services"
            ],
            "note": "Summary of key measures; refer to official CAQM order for complete list"
        }
    elif 401 <= aqi <= 450:
        return {
            "stage": "Stage III",
            "category": "Severe",
            "actions": [
                "Strict ban on non-essential construction and demolition",
                "Ban on BS-III petrol and BS-IV diesel LMVs in NCR",
                "Closure of stone crushers and mining activities"
            ],
            "note": "Summary of key measures; refer to official CAQM order for complete list"
        }
    else:  # AQI > 450
        return {
            "stage": "Stage IV",
            "category": "Severe+",
            "actions": [
                "Ban on entry of truck traffic into Delhi (except essential commodities)",
                "Ban on plying of Delhi-registered diesel MGVs/HGVs",
                "Closure of schools/colleges; online mode mandated"
            ],
            "note": "Summary of key measures; refer to official CAQM order for complete list"
        }
