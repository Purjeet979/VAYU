
import React, { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';
import { Activity } from 'lucide-react';

type StationForecastPoint = {
  hour: number;
  aqi: number;
  pm25: number;
};

type StationForecast = {
  station_id: string;
  station_name: string;
  last_updated_hours_ago?: number;
  partial_pollutant_set?: boolean;
  forecast?: StationForecastPoint[];
};

export default function StationForecastPanel({ hour }: { hour: number }) {
  const [stations, setStations] = useState<StationForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<string>('');

  useEffect(() => {
    fetchJson<StationForecast[]>('/api/forecast/stations').then(data => {
      if (data && data.length > 0) {
        setStations(data);
        setSelectedStation(data[0].station_id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stationData = stations.find(s => s.station_id === selectedStation);
  const currentForecast = stationData?.forecast?.find((f) => f.hour === hour);

  return (
    <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden flex flex-col h-full max-h-[500px] transition-all hover:shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Activity className="w-5 h-5 text-teal-500 dark:text-teal-400 drop-shadow-sm" /> 
          Station-Level Forecast
        </h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 font-medium bg-background px-3 py-1.5 rounded-lg border border-panelBorder inline-block w-fit flex-shrink-0">(Spatial interpolation of existing grid, not a new prediction)</p>
      
      {loading ? (
        <div className="animate-pulse h-16 bg-gray-200 dark:bg-gray-800 rounded-xl mt-4"></div>
      ) : stations.length > 0 ? (
        <div className="flex flex-col gap-5 flex-grow overflow-y-auto custom-scrollbar pr-2 pb-2">
          <div className="relative group flex-shrink-0">
            <select 
              className="w-full bg-background border border-panelBorder text-foreground rounded-xl p-3 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all cursor-pointer shadow-sm group-hover:border-teal-500/50"
              value={selectedStation}
              onChange={e => setSelectedStation(e.target.value)}
            >
              {stations.map(s => (
                <option key={s.station_id} value={s.station_id}>{s.station_name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          {stationData && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stationData.last_updated_hours_ago !== undefined && stationData.last_updated_hours_ago >= 110 ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/30' : 'bg-background border border-panelBorder text-gray-600 dark:text-gray-400'}`}>
                {stationData.last_updated_hours_ago !== undefined ? `Updated ${Math.round(stationData.last_updated_hours_ago)}h ago` : 'Updated recently'}
              </span>
              {stationData.partial_pollutant_set && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30 font-medium">
                  ⚠️ Kuch sensors band hain (Partial Data)
                </span>
              )}
            </div>
          )}

          {currentForecast && (
            <div className="grid grid-cols-2 gap-4 text-center mt-auto">
              <div className="bg-background/80 p-5 rounded-2xl border border-panelBorder shadow-sm transition-transform hover:scale-105 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1 z-10">AQI (T+{hour})</div>
                <div className="text-4xl font-black text-foreground z-10">{currentForecast.aqi}</div>
              </div>
              <div className="bg-background/80 p-5 rounded-2xl border border-panelBorder shadow-sm transition-transform hover:scale-105 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1 z-10">PM2.5 (T+{hour})</div>
                <div className="text-4xl font-black text-foreground z-10">
                  {currentForecast.pm25 !== null && currentForecast.pm25 !== undefined 
                    ? currentForecast.pm25.toFixed(1) 
                    : <span className="text-gray-400 dark:text-gray-600 text-lg">No Data</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center p-8 bg-background rounded-xl border border-dashed border-panelBorder mt-4">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">Station forecast not available yet.</div>
        </div>
      )}
    </div>
  );
}
