"use client";

import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { Activity, CloudFog, Zap } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function KpiCards({ forecast }: { forecast: any[] }) {
  const metrics = useMemo(() => {
    if (!forecast || forecast.length === 0) return null;

    let pm25Sum = 0;
    let pm25Count = 0;
    let maxO3 = 0;
    const currentAqi = forecast[0].aqi;
    
    const pm25Sparkline: { value: number | null }[] = [];
    const o3Sparkline: { value: number | null }[] = [];

    forecast.forEach(f => {
      if (f.pm25_ug_m3 != null) {
        pm25Sum += f.pm25_ug_m3;
        pm25Count++;
      }
      if (f.o3_ppb != null && f.o3_ppb > maxO3) maxO3 = f.o3_ppb;
      
      pm25Sparkline.push({ value: f.pm25_ug_m3 ?? null });
      o3Sparkline.push({ value: f.o3_ppb ?? null });
    });

    return {
      currentAqi: currentAqi != null ? Math.round(currentAqi) : null,
      avgPm25: pm25Count > 0 ? Math.round(pm25Sum / pm25Count) : null,
      currentO3: forecast[0].o3_ppb != null ? Math.round(forecast[0].o3_ppb) : null,
      maxO3: Math.round(maxO3),
      pm25Sparkline,
      o3Sparkline
    };
  }, [forecast]);

  const getAqiCategory = (aqi: number | null) => {
    if (aqi == null) return { label: 'No Data', color: 'text-gray-500' };
    if (aqi < 50) return { label: 'Good', color: 'text-brandGreen' };
    if (aqi < 100) return { label: 'Satisfactory', color: 'text-brandYellow' };
    if (aqi < 200) return { label: 'Moderate', color: 'text-brandOrange' };
    if (aqi < 300) return { label: 'Poor', color: 'text-brandRed' };
    if (aqi < 400) return { label: 'Very Poor', color: 'text-purple-400' };
    return { label: 'Severe', color: 'text-red-600' };
  };

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full px-4">
        {['AQI (Overall)', 'PM2.5', 'O3 (Ozone)'].map(label => (
          <div key={label} className="h-28 md:h-32 bg-panel/90 backdrop-blur-md rounded-2xl border border-panelBorder p-4 md:p-5 flex flex-col justify-center shadow-lg">
            <p className="text-sm font-medium text-gray-500 mb-2">{label}</p>
            <p className="text-lg font-semibold text-gray-400">Loading...</p>
          </div>
        ))}
      </div>
    );
  }

  const aqiCategory = getAqiCategory(metrics.currentAqi);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full px-4 pointer-events-auto">
      
      {/* AQI Card */}
      <div className="bg-panel/90 backdrop-blur-md rounded-2xl border border-panelBorder p-4 md:p-5 shadow-lg relative overflow-hidden flex flex-col justify-between gap-3">
        <div className="flex justify-between items-start">
          <p className="text-foreground font-medium text-sm md:text-base">AQI (Overall)</p>
          <div className={`bg-opacity-10 p-1.5 rounded-lg ${aqiCategory.color}`}>
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1 md:gap-2">
              <span className={`${aqiCategory.color} font-bold text-lg md:text-xl`}>&apos;{aqiCategory.label}&apos;</span>
              <span className={`${aqiCategory.color} font-black text-2xl md:text-3xl`}>{metrics.currentAqi ?? '-'}</span>
            </div>
          </div>
          {/* Simple Mock Gauge Arc using SVG */}
          <svg viewBox="0 0 100 50" className="w-12 h-6 md:w-16 md:h-8 overflow-visible flex-shrink-0">
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="currentColor" className="text-gray-300 dark:text-[#2a3140]" strokeWidth="8" strokeLinecap="round" />
            <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="currentColor" className={aqiCategory.color} strokeWidth="8" strokeLinecap="round" />
            <circle cx="70" cy="20" r="4" fill="currentColor" className="text-foreground" />
          </svg>
        </div>
        <div className="text-[10px] md:text-xs text-gray-500">
          PM2.5: {metrics.avgPm25 ?? '-'} µg/m³, O₃: {metrics.currentO3 ?? '-'} ppb
        </div>
      </div>

      {/* PM2.5 Card */}
      <div className="bg-panel/90 backdrop-blur-md rounded-2xl border border-panelBorder p-4 md:p-5 shadow-lg flex flex-col justify-between gap-3 relative overflow-hidden">
        <div className="flex justify-between items-start z-10">
          <p className="text-foreground font-medium text-sm md:text-base flex items-center gap-2">
            <CloudFog className="w-4 h-4 text-brandOrange" /> PM2.5
          </p>
          <div className="bg-orange-500/10 p-1.5 rounded-lg text-brandOrange">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end justify-between z-10">
          <div>
            <span className="text-brandOrange font-bold text-xl md:text-3xl">{metrics.avgPm25}</span>
            <span className="text-brandOrange text-xs md:text-sm ml-1">µg/m³</span>
          </div>
          <div className="w-16 h-8 md:w-24 md:h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.pm25Sparkline}>
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                <Line type="monotone" dataKey="value" stroke="#ff8a00" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="text-[10px] md:text-xs text-gray-500 mt-2 z-10">
          Daily average: {metrics.avgPm25}
        </div>
        <div className="absolute bottom-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-brandOrange/10 blur-2xl rounded-full -mr-10 -mb-10 pointer-events-none" />
      </div>

      {/* O3 Card */}
      <div className="bg-panel/90 backdrop-blur-md rounded-2xl border border-panelBorder p-4 md:p-5 shadow-lg flex flex-col justify-between gap-3 relative overflow-hidden">
        <div className="flex justify-between items-start z-10">
          <p className="text-foreground font-medium text-sm md:text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-brandYellow" /> O3 (Ozone)
          </p>
          <div className="bg-yellow-500/10 p-1.5 rounded-lg text-brandYellow">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-end justify-between z-10">
          <div>
            <span className="text-brandYellow font-bold text-xl md:text-3xl">{metrics.currentO3}</span>
            <span className="text-brandYellow text-xs md:text-sm ml-1">ppb</span>
          </div>
          <div className="w-16 h-8 md:w-24 md:h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.o3Sparkline}>
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                <Line type="monotone" dataKey="value" stroke="#facc15" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="text-[10px] md:text-xs text-gray-500 mt-2 z-10">
          Daily max: {metrics.maxO3}
        </div>
        <div className="absolute bottom-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-brandYellow/10 blur-2xl rounded-full -mr-10 -mb-10 pointer-events-none" />
      </div>
    </div>
  );
}
