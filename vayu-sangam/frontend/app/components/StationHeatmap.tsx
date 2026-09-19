"use client";

import { useState, useEffect, useMemo } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { fetchJson } from '../lib/api';
import { getCityTheme, NCR_CITIES } from '../lib/cityColors';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function StationHeatmap() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>('All');

  useEffect(() => {
    fetchJson<any>('/api/cpcb')
      .then(d => setData(Array.isArray(d) ? d : (d?.Data ?? [])))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const { heatmapGrid, stationCityMap } = useMemo(() => {
    if (!data.length) return { heatmapGrid: null, stationCityMap: {} };
    const stations: Record<string, number[]> = {};
    const cityMap: Record<string, string> = {};
    
    data.forEach(row => {
      if (!stations[row.station_name]) {
        stations[row.station_name] = new Array(24).fill(null);
      }
      if (row.hour >= 0 && row.hour < 24) {
        stations[row.station_name][row.hour] = row.pm25;
      }
      if (row.city) {
        cityMap[row.station_name] = row.city;
      }
    });
    return { heatmapGrid: stations, stationCityMap: cityMap };
  }, [data]);

  const getColor = (pm25: number) => {
    if (pm25 == null) return 'bg-gray-200 dark:bg-gray-800 text-gray-500';
    if (pm25 < 60) return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400';
    if (pm25 < 120) return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
    if (pm25 < 250) return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400';
    return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400';
  };

  if (loading) {
    return <div className="h-64 bg-panel rounded-2xl border border-panelBorder animate-pulse mt-6" />;
  }

  if (error || !heatmapGrid) {
    return (
      <div className="mt-6 bg-panel rounded-2xl border border-panelBorder p-8 flex flex-col items-center justify-center text-center shadow-lg">
        <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mb-4 border border-panelBorder">
          <MapPin className="w-8 h-8 text-gray-500 dark:text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Station-Level Heatmap</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md">
          Granular CPCB station data is unavailable right now. The grid will return when the latest station file is refreshed.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium uppercase tracking-wide">
          <AlertCircle className="w-4 h-4" /> CPCB Data Unavailable
        </div>
      </div>
    );
  }

  const filteredStations = Object.entries(heatmapGrid).filter(([station]) => {
    if (selectedCity === 'All') return true;
    return stationCityMap[station] === selectedCity;
  });

  return (
    <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden flex flex-col h-full transition-all hover:shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <MapPin className="w-5 h-5 text-teal-500 dark:text-teal-400 drop-shadow-sm" /> Station PM2.5 Timeline (00:00 - 23:00)
        </h3>

        {/* CITY FILTER TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
          <button
            onClick={() => setSelectedCity('All')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-all flex-shrink-0 ${
              selectedCity === 'All'
                ? 'bg-cyan/20 text-cyan border-cyan/40'
                : 'text-gray-500 hover:text-foreground border-panelBorder bg-background'
            }`}
          >
            All ({Object.keys(heatmapGrid).length})
          </button>
          {NCR_CITIES.map(city => {
            const theme = getCityTheme(city);
            const count = Object.keys(heatmapGrid).filter(s => stationCityMap[s] === city).length;
            if (count === 0) return null;
            const isSelected = selectedCity === city;
            return (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  isSelected ? 'font-bold ring-1' : 'hover:opacity-90'
                }`}
                style={{
                  borderColor: isSelected ? theme.hex : theme.hex + '35',
                  color: theme.hex,
                  backgroundColor: isSelected ? theme.hex + '25' : theme.hex + '0d',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.hex }} />
                {city} ({count})
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div className="min-w-max">
          <div className="flex mb-2">
            <div className="w-56 flex-shrink-0"></div>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="w-12 text-center text-xs text-gray-500 font-mono">
                {String(i).padStart(2, '0')}
              </div>
            ))}
          </div>

          {filteredStations.map(([station, hours]) => {
            const city = stationCityMap[station];
            const cityTheme = city ? getCityTheme(city) : null;
            return (
              <div key={station} className="flex mb-1 group hover:bg-gray-200 dark:hover:bg-gray-800/50 rounded-md">
                <div className="w-56 flex-shrink-0 text-xs font-medium text-gray-600 dark:text-gray-300 py-1 pr-2">
                  <div className="truncate font-medium text-foreground" title={station}>{station}</div>
                  {cityTheme && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cityTheme.hex }} />
                      <span className="text-[10px] font-semibold truncate" style={{ color: cityTheme.hex }}>
                        {city}
                      </span>
                    </div>
                  )}
                </div>
                {hours.map((val, i) => (
                  <div key={i} className="w-12 p-0.5">
                    <div className={`w-full h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold ${getColor(val)}`}>
                      {val != null ? Math.round(val) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
