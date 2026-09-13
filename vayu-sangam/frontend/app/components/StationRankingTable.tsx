"use client";

import { useState, useEffect } from 'react';
import { MapPin, AlertCircle, ArrowUpDown } from 'lucide-react';
import { fetchJson } from '../lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function StationRankingTable() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortCol, setSortCol] = useState<string>('aqi');
  const [sortDesc, setSortDesc] = useState<boolean>(true);

  useEffect(() => {
    fetchJson<any[]>('/api/cpcb/latest')
      .then(d => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const valA = a[sortCol];
    const valB = b[sortCol];
    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });

  const getStatus = (aqi: number) => {
    if (aqi < 50) return { label: 'Good', color: 'text-green-400 bg-green-500/20 border-green-500/30' };
    if (aqi < 100) return { label: 'Satisfactory', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' };
    if (aqi < 200) return { label: 'Moderate', color: 'text-orange-400 bg-orange-500/20 border-orange-500/30' };
    if (aqi < 300) return { label: 'Poor', color: 'text-red-400 bg-red-500/20 border-red-500/30' };
    if (aqi < 400) return { label: 'Very Poor', color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' };
    return { label: 'Severe', color: 'text-red-600 bg-red-900/40 border-red-800' };
  };

  if (loading) {
    return <div className="h-64 bg-[#131821]/95 backdrop-blur-md rounded-2xl border border-gray-800 animate-pulse absolute bottom-4 left-4 z-[400] w-[400px]" />;
  }

  if (error || data.length === 0) {
    return (
      <div className="absolute bottom-4 left-4 z-[400] w-[400px] max-h-[400px] bg-[#131821]/95 backdrop-blur-md rounded-2xl border border-gray-800 p-6 flex flex-col items-center justify-center text-center shadow-2xl">
        <div className="w-12 h-12 bg-gray-800/50 rounded-full flex items-center justify-center mb-4 border border-gray-700">
          <MapPin className="w-6 h-6 text-gray-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-200 mb-2">Station Rankings</h3>
        <p className="text-gray-400 text-xs mb-4">
          Station-level rankings are unavailable right now. Please try again after the latest CPCB file is refreshed.
        </p>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-medium uppercase tracking-wide">
          <AlertCircle className="w-3.5 h-3.5" /> CPCB Data Unavailable
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-4 z-[400] w-[450px] max-h-[400px] flex flex-col bg-[#131821]/95 backdrop-blur-md rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-gray-800 bg-[#0b0e14]/50">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-teal-400" /> Ground Station Live Rankings
        </h3>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#131821] border-b border-gray-800 text-xs text-gray-400">
            <tr>
              <th className="p-3 font-medium cursor-pointer hover:text-gray-200" onClick={() => handleSort('station_name')}>
                Station <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-50" />
              </th>
              <th className="p-3 font-medium cursor-pointer hover:text-gray-200" onClick={() => handleSort('aqi')}>
                AQI <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-50" />
              </th>
              <th className="p-3 font-medium cursor-pointer hover:text-gray-200" onClick={() => handleSort('pm25')}>
                PM2.5 <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-50" />
              </th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-800/50">
            {sortedData.map((row, i) => {
              const status = getStatus(row.aqi);
              return (
                <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                  <td className="p-3 font-medium text-gray-300">{row.station_name}</td>
                  <td className="p-3 font-bold font-mono">{row.aqi}</td>
                  <td className="p-3 font-mono text-gray-400">
                    {typeof row.pm25 === 'number' ? row.pm25.toFixed(1) : '-'}
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
