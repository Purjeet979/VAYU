"use client";

import { useState, useEffect } from 'react';
import { MapPin, AlertCircle, ArrowUpDown } from 'lucide-react';
import { fetchJson } from '../lib/api';
import { getCityTheme, NCR_CITIES } from '../lib/cityColors';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function StationRankingTable({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortCol, setSortCol] = useState<string>('aqi');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [selectedCity, setSelectedCity] = useState<string>('All');

  useEffect(() => {
    fetchJson<any>('/api/cpcb/latest')
      .then(d => setData(Array.isArray(d) ? d : (d?.Data ?? [])))
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

  const filteredData = sortedData.filter(row => {
    if (selectedCity === 'All') return true;
    return row.city === selectedCity;
  });

  const getStatus = (aqi: number) => {
    if (aqi < 50) return { label: 'Good', color: 'text-brandGreen bg-brandGreen/10 border-brandGreen/20' };
    if (aqi < 100) return { label: 'Satisfactory', color: 'text-brandYellow bg-brandYellow/10 border-brandYellow/20' };
    if (aqi < 200) return { label: 'Moderate', color: 'text-brandOrange bg-brandOrange/10 border-brandOrange/20' };
    if (aqi < 300) return { label: 'Poor', color: 'text-brandRed bg-brandRed/10 border-brandRed/20' };
    if (aqi < 400) return { label: 'Very Poor', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
    return { label: 'Severe', color: 'text-red-600 bg-red-900/40 border-red-800' };
  };

  if (loading) {
    if (isEmbedded) return <div className="h-64 animate-pulse bg-gray-500/10 rounded-lg" />;
    return <div className="h-64 bg-panel/95 backdrop-blur-md rounded-2xl border border-panelBorder animate-pulse absolute bottom-4 left-4 z-[400] w-[400px]" />;
  }

  if (error || data.length === 0) {
    const ErrorContent = (
      <>
        <div className="w-12 h-12 bg-gray-500/10 rounded-full flex items-center justify-center mb-4 border border-gray-500/20">
          <MapPin className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">Station Rankings</h3>
        <p className="text-gray-500 text-xs mb-4">
          Station-level rankings are unavailable right now. Please try again after the latest CPCB file is refreshed.
        </p>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brandOrange/10 border border-brandOrange/20 text-brandOrange text-[10px] font-medium uppercase tracking-wide">
          <AlertCircle className="w-3.5 h-3.5" /> CPCB Data Unavailable
        </div>
      </>
    );

    if (isEmbedded) {
      return <div className="flex flex-col items-center justify-center text-center p-4">{ErrorContent}</div>;
    }

    return (
      <div className="absolute bottom-4 left-4 z-[400] w-[400px] max-h-[400px] bg-panel/95 backdrop-blur-md rounded-2xl border border-panelBorder p-6 flex flex-col items-center justify-center text-center shadow-2xl">
        {ErrorContent}
      </div>
    );
  }

  const TableContent = (
    <div className="flex flex-col h-full">
      {/* CITY FILTER TABS */}
      <div className="flex items-center gap-1.5 px-2.5 py-2 overflow-x-auto custom-scrollbar border-b border-panelBorder bg-panel/70 flex-shrink-0">
        <button
          onClick={() => setSelectedCity('All')}
          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all flex-shrink-0 ${
            selectedCity === 'All'
              ? 'bg-cyan/20 text-cyan border-cyan/40'
              : 'text-gray-500 hover:text-foreground border-transparent'
          }`}
        >
          All ({data.length})
        </button>
        {NCR_CITIES.map(city => {
          const theme = getCityTheme(city);
          const count = data.filter(d => d.city === city).length;
          if (count === 0) return null;
          const isSelected = selectedCity === city;
          return (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-all flex items-center gap-1 flex-shrink-0 ${
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

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-panel/95 backdrop-blur-md border-b border-panelBorder text-[11px] text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="p-2 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('station_name')}>
                Station <ArrowUpDown className="w-3 h-3 inline opacity-50" />
              </th>
              <th className="p-2 font-medium cursor-pointer hover:text-foreground" onClick={() => handleSort('aqi')}>
                AQI <ArrowUpDown className="w-3 h-3 inline opacity-50" />
              </th>
              <th className="p-2 font-medium cursor-pointer hover:text-foreground hidden sm:table-cell" onClick={() => handleSort('pm25')}>
                PM2.5 <ArrowUpDown className="w-3 h-3 inline opacity-50" />
              </th>
              <th className="p-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-panelBorder">
            {filteredData.map((row, i) => {
              const status = getStatus(row.aqi);
              const cityTheme = row.city ? getCityTheme(row.city) : null;
              return (
                <tr key={i} className="hover:bg-gray-500/10 transition-colors text-foreground">
                  <td className="p-2 text-xs font-medium max-w-[150px]" title={row.station_name}>
                    <div className="truncate font-medium">{row.station_name}</div>
                    {cityTheme && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cityTheme.hex }} />
                        <span 
                          className="text-[10px] font-semibold truncate"
                          style={{ color: cityTheme.hex }}
                        >
                          {row.city}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-sm font-bold font-mono">{row.aqi}</td>
                  <td className="p-2 text-xs font-mono text-gray-500 hidden sm:table-cell">
                    {typeof row.pm25 === 'number' ? row.pm25.toFixed(1) : '-'}
                  </td>
                  <td className="p-2 text-right">
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${status.color}`}>
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

  if (isEmbedded) {
    return TableContent;
  }

  return (
    <div className="absolute bottom-4 left-4 z-[400] w-[450px] max-h-[450px] flex flex-col bg-panel/95 backdrop-blur-md rounded-2xl border border-panelBorder shadow-2xl overflow-hidden">
      <div className="p-3.5 border-b border-panelBorder bg-background/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <MapPin className="w-4 h-4 text-cyan" /> Ground Station Live Rankings
        </h3>
        <span className="text-xs text-gray-500 font-medium">
          {filteredData.length} stations
        </span>
      </div>
      
      <div className="flex-1 overflow-hidden">
        {TableContent}
      </div>
    </div>
  );
}
