"use client";

import { useState, useEffect, useMemo } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { fetchJson } from '../lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function StationHeatmap() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchJson<any[]>('/api/cpcb')
      .then(d => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const heatmapGrid = useMemo(() => {
    if (!data.length) return null;
    const stations: Record<string, number[]> = {};
    
    data.forEach(row => {
      if (!stations[row.station_name]) {
        stations[row.station_name] = new Array(24).fill(null);
      }
      if (row.hour >= 0 && row.hour < 24) {
        stations[row.station_name][row.hour] = row.pm25;
      }
    });
    return stations;
  }, [data]);

  const getColor = (pm25: number) => {
    if (pm25 == null) return 'bg-gray-800 text-gray-500';
    if (pm25 < 60) return 'bg-green-500/20 text-green-400';
    if (pm25 < 120) return 'bg-yellow-500/20 text-yellow-400';
    if (pm25 < 250) return 'bg-orange-500/20 text-orange-400';
    return 'bg-red-500/20 text-red-400';
  };

  if (loading) {
    return <div className="h-64 bg-[#131821] rounded-2xl border border-gray-800 animate-pulse mt-6" />;
  }

  if (error || !heatmapGrid) {
    return (
      <div className="mt-6 bg-[#131821] rounded-2xl border border-gray-800 p-8 flex flex-col items-center justify-center text-center shadow-lg">
        <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4 border border-gray-700">
          <MapPin className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-200 mb-2">Station-Level Heatmap</h3>
        <p className="text-gray-400 text-sm max-w-md">
          Granular CPCB station data is unavailable right now. The grid will return when the latest station file is refreshed.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium uppercase tracking-wide">
          <AlertCircle className="w-4 h-4" /> CPCB Data Unavailable
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-[#131821] rounded-2xl border border-gray-800 p-6 shadow-lg overflow-hidden flex flex-col">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-teal-400" /> Station PM2.5 Timeline (00:00 - 23:00)
      </h3>
      
      <div className="overflow-x-auto pb-4">
        <div className="min-w-max">
          <div className="flex mb-2">
            <div className="w-48 flex-shrink-0"></div>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="w-12 text-center text-xs text-gray-500 font-mono">
                {String(i).padStart(2, '0')}
              </div>
            ))}
          </div>

          {Object.entries(heatmapGrid).map(([station, hours]) => (
            <div key={station} className="flex mb-1 group hover:bg-gray-800/50 rounded-md">
              <div className="w-48 flex-shrink-0 text-xs font-medium text-gray-300 py-1 pr-2 truncate">
                {station}
              </div>
              {hours.map((val, i) => (
                <div key={i} className="w-12 p-0.5">
                  <div className={`w-full h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold ${getColor(val)}`}>
                    {val != null ? Math.round(val) : '-'}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
