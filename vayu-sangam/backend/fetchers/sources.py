import logging
import requests
import datetime
from typing import List, Dict, Any, Tuple, Optional
from abc import ABC, abstractmethod
import pandas as pd

logger = logging.getLogger(__name__)

class AirQualitySource(ABC):
    def __init__(self, name: str, timeout: Tuple[int, int], max_age_minutes: int):
        self.name = name
        self.timeout = timeout
        self.max_age_minutes = max_age_minutes

    @abstractmethod
    def fetch(self, **kwargs) -> List[Dict[str, Any]]:
        """Fetch data from the source and return a list of normalized observations."""
        pass

    def validate_and_filter(self, records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Filter out stale/invalid records and return valid records + metadata."""
        valid_records = []
        now = datetime.datetime.now(datetime.timezone.utc)
        
        metrics = {
            "received": len(records),
            "fresh": 0,
            "stale": 0,
            "invalid": 0
        }
        
        for record in records:
            ts_str = record.get("timestamp")
            if not ts_str:
                metrics["invalid"] += 1
                continue
                
            try:
                dt = datetime.datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=datetime.timezone.utc)
                age_minutes = (now - dt).total_seconds() / 60.0
            except ValueError:
                metrics["invalid"] += 1
                continue

            if age_minutes > self.max_age_minutes or age_minutes < -60:
                metrics["stale"] += 1
                continue
                
            # Defensive clamping against sensor calibration drift
            # If values are slightly negative, clamp them to 0 rather than dropping
            # the entire row (which would lose other valid pollutants)
            for pol in ["pm25", "pm10", "no2", "o3", "so2", "co"]:
                val = record.get(pol)
                if val is not None:
                    if val < 0:
                        record[pol] = 0.0
                    # For extreme spikes (>3000), we probably want to drop the whole record 
                    # as the sensor is completely busted, but we'll just drop the field for safety
                    elif val > 3000:
                        record[pol] = None
                
            # Normalize
            record["source"] = self.name
            record["data_type"] = "observed"
            record["quality"] = "fresh"
            record["confidence"] = "high"
            record["age_minutes"] = round(age_minutes, 1)
            
            valid_records.append(record)
            metrics["fresh"] += 1
            
        return valid_records, metrics


class CPCBSource(AirQualitySource):
    def __init__(self, api_key: str):
        super().__init__(name="CPCB", timeout=(5, 35), max_age_minutes=120)
        self.api_key = api_key
        
    def fetch(self, states: List[str] = ["Delhi", "Haryana", "Uttar Pradesh"]) -> List[Dict[str, Any]]:
        if not self.api_key or "your_" in self.api_key:
            raise ValueError("CPCB_API_KEY is not set or valid.")
            
        url_base = "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
        limit = 2000
        raw_records = []
        
        for state in states:
            offset = 0
            while True:
                url = f"{url_base}?api-key={self.api_key}&format=json&limit={limit}&offset={offset}&filters[state]={state}"
                try:
                    resp = requests.get(url, timeout=self.timeout)
                    resp.raise_for_status()
                    data = resp.json()
                except ValueError:
                    raise ValueError(f"Invalid JSON received from data.gov.in for {state}")
                    
                batch = data.get('records', [])
                raw_records.extend(batch)
                
                total = int(data.get('total', 0))
                if offset + limit >= total or not batch:
                    break
                offset += limit

        # CPCB data needs pivoting because it comes as one row per pollutant
        return self._pivot_cpcb_records(raw_records)
        
    def _pivot_cpcb_records(self, raw_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not raw_records:
            return []
        df = pd.DataFrame(raw_records)
        if 'pollutant_avg' not in df.columns or 'pollutant_id' not in df.columns:
            return []
            
        df = df.dropna(subset=['pollutant_avg'])
        df['pollutant_avg'] = pd.to_numeric(df['pollutant_avg'], errors='coerce')
        
        pivoted = df.pivot_table(
            index=['last_update', 'station', 'city', 'latitude', 'longitude'], 
            columns='pollutant_id', 
            values='pollutant_avg',
            aggfunc='first'
        ).reset_index()
        
        rename_map = {"PM2.5": "pm25", "PM10": "pm10", "NO2": "no2", "OZONE": "o3", "CO": "co", "SO2": "so2"}
        pivoted = pivoted.rename(columns=rename_map)
        
        records = []
        for _, row in pivoted.iterrows():
            # Date format: 12-09-2026 10:00:00 (IST) -> Convert to ISO UTC
            ts_str = row.get("last_update")
            iso_ts = None
            if pd.notna(ts_str):
                try:
                    dt = pd.to_datetime(ts_str, format='%d-%m-%Y %H:%M:%S', errors='coerce')
                    if pd.isna(dt):
                        dt = pd.to_datetime(ts_str, dayfirst=True, errors='coerce')
                    if not pd.isna(dt):
                        dt = dt.tz_localize("Asia/Kolkata").tz_convert("UTC")
                        iso_ts = dt.strftime('%Y-%m-%dT%H:%M:%SZ')
                except Exception:
                    pass

            rec = {
                "timestamp": iso_ts,
                "station": row.get("station"),
                "city": row.get("city"),
                "latitude": float(row.get("latitude")) if pd.notna(row.get("latitude")) else None,
                "longitude": float(row.get("longitude")) if pd.notna(row.get("longitude")) else None,
            }
            for p in rename_map.values():
                if p in row and pd.notna(row[p]):
                    rec[p] = float(row[p])
            records.append(rec)
            
        return records


class OpenAQSource(AirQualitySource):
    def __init__(self, api_key: str):
        super().__init__(name="OpenAQ", timeout=(5, 25), max_age_minutes=120)
        self.api_key = api_key
        
    def fetch(self) -> List[Dict[str, Any]]:
        if not self.api_key or "your_" in self.api_key:
            raise ValueError("OPENAQ_API_KEY is not set or valid.")
            
        url = "https://api.openaq.org/v3/locations"
        headers = {"X-API-Key": self.api_key}
        params = {"coordinates": "28.6,77.2", "radius": 25000, "limit": 100}
        
        resp = requests.get(url, headers=headers, params=params, timeout=self.timeout)
        resp.raise_for_status()
        locations = resp.json().get('results', [])
        
        records = []
        for loc in locations:
            loc_id = loc.get("id")
            if not loc_id: continue
            
            try:
                r = requests.get(f"https://api.openaq.org/v3/locations/{loc_id}/latest", headers=headers, timeout=self.timeout)
                r.raise_for_status()
                sensors = r.json().get('results', [])
            except Exception:
                continue
                
            loc_name = loc.get("name", "Unknown")
            coords = loc.get("coordinates", {})
            lat = coords.get("latitude")
            lon = coords.get("longitude")
            
            rec = {
                "station": loc_name,
                "latitude": lat,
                "longitude": lon,
            }
            
            # Extract latest timestamp and pollutants
            latest_ts = None
            for s in sensors:
                param = s.get("parameter", {}).get("name", "").lower()
                val = s.get("value")
                ts = s.get("datetime", {}).get("utc")
                if param == "pm25": param = "pm25"
                if param == "pm10": param = "pm10"
                if param == "o3": param = "o3"
                if val is not None and ts:
                    rec[param] = val
                    if not latest_ts or ts > latest_ts:
                        latest_ts = ts
                        
            if latest_ts:
                rec["timestamp"] = latest_ts
                records.append(rec)
                
        return records


class WAQISource(AirQualitySource):
    def __init__(self, api_key: str):
        super().__init__(name="WAQI", timeout=(5, 15), max_age_minutes=120)
        self.api_key = api_key
        
    def fetch(self) -> List[Dict[str, Any]]:
        if not self.api_key or "your_" in self.api_key:
            self.api_key = "9e69c6d371ba235a3cc46059eab00da765e1eb41" # Fallback public token
            
        bounds = [
            "28.4,77.0,28.9,77.5", # Delhi
            "28.3,76.8,28.6,77.1", # Gurugram
            "28.4,77.3,28.7,77.6", # Noida/Greater Noida
            "28.6,77.3,28.8,77.6", # Ghaziabad
            "28.3,77.2,28.5,77.4", # Faridabad
        ]
        
        stations_dict = {}
        for b in bounds:
            url = f"https://api.waqi.info/map/bounds/?latlng={b}&token={self.api_key}"
            try:
                resp = requests.get(url, timeout=self.timeout)
                resp.raise_for_status()
                data = resp.json()
                if data.get("status") == "ok":
                    for st in data.get("data", []):
                        uid = st.get("uid")
                        if uid:
                            stations_dict[uid] = st
            except Exception:
                pass
                
        stations = list(stations_dict.values())
        records = []
        
        for st in stations:
            uid = st.get("uid")
            if not uid: continue
            
            # Fetch detailed station data to get individual pollutants and timestamp
            try:
                detail_url = f"https://api.waqi.info/feed/@{uid}/?token={self.api_key}"
                d_resp = requests.get(detail_url, timeout=self.timeout)
                d_resp.raise_for_status()
                d_data = d_resp.json().get("data", {})
            except Exception:
                continue
                
            iaqi = d_data.get("iaqi", {})
            time_obj = d_data.get("time", {})
            ts = time_obj.get("iso")
            
            station_name = d_data.get("city", {}).get("name", "Unknown")
            parts = [p.strip() for p in station_name.split(',')]
            # Many WAQI stations in India are format: 'Name, City, State, Country'
            city_val = parts[1] if len(parts) > 1 else 'Delhi'
            
            rec = {
                "timestamp": ts,
                "station": station_name,
                "city": city_val,
                "latitude": d_data.get("city", {}).get("geo", [None, None])[0],
                "longitude": d_data.get("city", {}).get("geo", [None, None])[1],
            }
            
            # WAQI returns IAQI (Index) for pollutants, but some return concentrations. 
            # We assume 'pm25.v' is concentration or closely mapped.
            if "pm25" in iaqi: rec["pm25"] = iaqi["pm25"].get("v")
            if "pm10" in iaqi: rec["pm10"] = iaqi["pm10"].get("v")
            if "no2" in iaqi: rec["no2"] = iaqi["no2"].get("v")
            if "o3" in iaqi: rec["o3"] = iaqi["o3"].get("v")
            if "co" in iaqi: rec["co"] = iaqi["co"].get("v")
            if "so2" in iaqi: rec["so2"] = iaqi["so2"].get("v")
            
            records.append(rec)
            
        return records


class LastKnownGoodSource(AirQualitySource):
    def __init__(self, cache_file_path: str):
        super().__init__(name="LKG", timeout=(1, 1), max_age_minutes=1440) # 24 hours max
        self.cache_file_path = cache_file_path
        
    def fetch(self) -> List[Dict[str, Any]]:
        try:
            df = pd.read_csv(self.cache_file_path)
        except Exception as e:
            raise ValueError(f"Could not read LKG cache: {e}")
            
        if df.empty:
            return []
            
        records = df.to_dict(orient="records")
        # Ensure we return them in the expected dict format
        return records
        
    def validate_and_filter(self, records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        # Override to mark as degraded
        valid_records, metrics = super().validate_and_filter(records)
        for r in valid_records:
            r["quality"] = "degraded"
            r["confidence"] = "low"
            r["fallback_reason"] = "all_live_sources_unavailable"
        return valid_records, metrics
