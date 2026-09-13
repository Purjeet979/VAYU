"use client";

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import CorrelationMatrix from './CorrelationMatrix';
import DataConfidenceBadge from './DataConfidenceBadge';
import DominantDriversPanel from './DominantDriversPanel';
import EarlyWarningBanner from './EarlyWarningBanner';
import ForecastSlider from './ForecastSlider';
import KpiCards from './KpiCards';
import StationForecastPanel from './StationForecastPanel';
import StationHeatmap from './StationHeatmap';
import { fetchJson } from '../lib/api';

type ForecastPoint = {
  timestamp: string;
  aqi: number;
  pm25_ug_m3: number;
  temperature_c?: number;
  wind_speed_mps?: number;
  pm10_ug_m3?: number;
};

type DashboardSummary = {
  forecast?: {
    forecast?: ForecastPoint[];
  };
};

export default function DashboardView() {
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [hour, setHour] = useState(24);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setDataError(null);

    fetchJson<DashboardSummary>(`/api/dashboard-summary?hours=72&hour=${hour}`)
      .then((data) => {
        if (cancelled) return;

        const nextForecast = data?.forecast?.forecast ?? [];
        setForecast(nextForecast);

        if (nextForecast.length === 0) {
          setDataError('Forecast data could not be loaded.');
        }
      })
      .catch(() => {
        if (!cancelled) setDataError('Forecast data could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hour]);

  return (
    <div className="max-w-7xl mx-auto px-6 flex flex-col gap-8">
      <EarlyWarningBanner />

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Air Quality Forecast</h1>
          <p className="text-gray-400">72-hour outlook for Delhi NCR</p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" disabled className="rounded bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed" />
            <span className="opacity-50 cursor-not-allowed" title="Source contribution modeling in progress">
              Show without stubble-burning
            </span>
          </label>
          <DataConfidenceBadge />
        </div>
      </div>

      <ForecastSlider hour={hour} setHour={setHour} />

      {loading && forecast.length === 0 ? (
        <div className="w-full flex flex-col gap-8">
          <div className="h-96 w-full bg-gray-900 rounded-2xl border border-gray-800 animate-pulse" />
        </div>
      ) : (
        <div className="flex flex-col h-full gap-6">
          {dataError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {dataError}
            </div>
          )}

          <KpiCards forecast={forecast} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-[#131821] rounded-2xl border border-gray-800 p-6 shadow-xl h-full">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-400" /> 72-Hour Trajectory
                </h2>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecast} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a3140" vertical={false} />
                      <XAxis
                        dataKey="timestamp"
                        stroke="#6b7280"
                        tickFormatter={(tickItem: string) => `${new Date(tickItem).getHours()}:00`}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis yAxisId="left" stroke="#6b7280" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#6b7280" tick={{ fontSize: 12 }} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;

                          return (
                            <div className="bg-[#131821]/95 backdrop-blur-sm border border-gray-800 p-4 rounded-xl shadow-2xl">
                              <p className="text-gray-400 text-xs mb-2">{new Date(label ?? '').toLocaleString()}</p>
                              {payload.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between gap-4 mb-1">
                                  <span className="text-sm font-medium" style={{ color: entry.color }}>{entry.name}</span>
                                  <span className="text-sm font-bold text-gray-100">{Number(entry.value ?? 0).toFixed(1)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="aqi" name="AQI" stroke="#ef4444" strokeWidth={3} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="pm25_ug_m3" name="PM2.5 (ug/m3)" stroke="#f97316" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div>
              <DominantDriversPanel hour={hour} />
              <StationForecastPanel hour={hour} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <StationHeatmap />
            <CorrelationMatrix forecast={forecast} />
          </div>
        </div>
      )}
    </div>
  );
}
