import { Thermometer, Activity, CloudFog, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function KpiCards({ forecast }: { forecast: any[] }) {
  const metrics = useMemo(() => {
    if (!forecast || forecast.length === 0) return null;

    let tempSum = 0;
    let pm25Sum = 0;
    let peakAqi = 0;
    let severeHours = 0;

    forecast.forEach(f => {
      tempSum += f.temperature_c ?? 0;
      pm25Sum += f.pm25_ug_m3 ?? 0;
      if (f.aqi > peakAqi) peakAqi = f.aqi;
      if (f.aqi >= 300) severeHours++;
    });

    const count = forecast.length;
    return {
      avgTemp: (tempSum / count).toFixed(1),
      avgPm25: (pm25Sum / count).toFixed(1),
      peakAqi: Math.round(peakAqi),
      severeHours,
    };
  }, [forecast]);

  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {['Avg Temperature', 'Peak AQI', 'Avg PM2.5', 'Severe Hours'].map(label => (
          <div key={label} className="h-28 bg-[#131821] rounded-2xl border border-gray-800 p-5 flex flex-col justify-center">
            <p className="text-xs text-gray-400 font-medium mb-2">{label}</p>
            <p className="text-sm font-semibold text-gray-500">Data unavailable</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-[#131821] rounded-2xl border border-gray-800 p-5 flex items-center justify-between shadow-lg">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">Avg Temperature</p>
          <p className="text-2xl font-bold text-gray-100">{metrics.avgTemp}°C</p>
        </div>
        <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
          <Thermometer className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-[#131821] rounded-2xl border border-gray-800 p-5 flex items-center justify-between shadow-lg">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">Peak AQI</p>
          <p className="text-2xl font-bold text-gray-100">{metrics.peakAqi}</p>
        </div>
        <div className="p-3 bg-red-500/10 rounded-full text-red-400">
          <Activity className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-[#131821] rounded-2xl border border-gray-800 p-5 flex items-center justify-between shadow-lg">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">Avg PM2.5</p>
          <p className="text-2xl font-bold text-gray-100">{metrics.avgPm25} µg/m³</p>
        </div>
        <div className="p-3 bg-orange-500/10 rounded-full text-orange-400">
          <CloudFog className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-[#131821] rounded-2xl border border-gray-800 p-5 flex items-center justify-between shadow-lg">
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">Severe Hours (AQI 300+)</p>
          <p className="text-2xl font-bold text-gray-100">{metrics.severeHours}</p>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-full text-purple-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
