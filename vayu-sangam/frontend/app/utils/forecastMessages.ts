export const categoryToEmoji: Record<string, string> = {
  'Good': '😊', 
  'Satisfactory': '🙂', 
  'Moderate': '😐',
  'Poor': '😷', 
  'Very Poor': '🤢', 
  'Severe': '☠️',
  'Severe+': '☣️'
};

export function getTrendArrow(currentAQI: number, forecast24hAvgAQI: number) {
  if (currentAQI <= 0 || forecast24hAvgAQI <= 0) return { icon: '➡️', text: 'Data missing' };
  const pctChange = ((forecast24hAvgAQI - currentAQI) / currentAQI) * 100;
  if (pctChange > 10) return { icon: '📈', text: 'Badhegi (AQI badhega)' };
  if (pctChange < -10) return { icon: '📉', text: 'Kam-hogi (Sudhar aayega)' };
  return { icon: '➡️', text: 'Waisi-hi-rahegi' };
}

export function getUncertaintyMessage(lowerBound: number, upperBound: number, aqi: number) {
  if (aqi <= 0) return 'Data missing';
  const bandWidthPct = ((upperBound - lowerBound) / aqi) * 100;
  
  // NOTE: These thresholds (15%, 40%) are heuristic thresholds.
  // They are NOT measured from the actual residual distribution of the XGBoost held-out test set.
  // They represent a generic expectation of confidence where a tight band (<15%) implies strong local wind/fire stability.
  if (bandWidthPct < 15) return 'Hum is forecast ke baare mein KAAFI SURE hain';
  if (bandWidthPct < 40) return 'Hum is forecast ke baare mein THODA SURE hain';
  return 'Ye EK ROUGH ANDAAZA hai, moshkil mausam ke karan exact nahi';
}

export function getScientificStatus(dataSource: string, scientificStatus: string, currentAQI: number | null, historyCount: number | null) {
  if (dataSource === 'bundled_demo_dataset' || scientificStatus.includes('insufficient_data')) {
    // Explicitly ignore currentAQI during fallback
    if (historyCount !== null) {
      return {
        simple: `⏳ Hum abhi purana data ikattha kar rahe hain (${historyCount}/24 ghante)`,
        technical: scientificStatus
      };
    } else {
      // Non-numeric reason like "Exception in live inference"
      return {
        simple: `⚠️ Abhi technical issue ki wajah se sample data dikha rahe hain`,
        technical: scientificStatus
      };
    }
  }
  
  // Live case
  const safeAQI = currentAQI ?? 'Unknown';
  return {
    simple: `✅ Live Forecast (Abhi ka AQI ${safeAQI} hai, aur model naye data par run ho raha hai)`,
    technical: scientificStatus
  };
}

interface ForecastData {
  pm25_ug_m3?: number | null;
  pm10_ug_m3?: number | null;
  no2_ug_m3?: number | null;
  o3_ug_m3?: number | null;
  so2_ug_m3?: number | null;
  co_mg_m3?: number | null;
}

export function getPollutantAvailability(forecast: ForecastData[]) {
  return {
    pm25: forecast.some(f => f.pm25_ug_m3 != null),
    pm10: forecast.some(f => f.pm10_ug_m3 != null),
    no2: forecast.some(f => f.no2_ug_m3 != null),
    o3: forecast.some(f => f.o3_ug_m3 != null),
    so2: forecast.some(f => f.so2_ug_m3 != null),
    co: forecast.some(f => f.co_mg_m3 != null),
  };
}
