"use client";

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Layers, Wind, ShieldAlert, AlertTriangle, Lightbulb, Cpu, TrendingUp, TrendingDown } from 'lucide-react';

import KpiCards from './KpiCards';
import StationHeatmap from './StationHeatmap';
import CorrelationMatrix from './CorrelationMatrix';
import ScenarioWhatIf from './ScenarioWhatIf';
import { fetchJson } from '../lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function DashboardView() {
  const [forecast, setForecast] = useState<any[]>([]);
  const [inversion, setInversion] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [explanation, setExplanation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<any>('/api/dashboard-summary?hours=72&hour=24')
      .then((data) => {
        if (data?.forecast?.forecast) setForecast(data.forecast.forecast);
        if (data?.inversion) setInversion(data.inversion);
        if (data?.sources?.sources) setSources(data.sources.sources);
        if (data?.explanation) setExplanation(data.explanation);
        if (!data?.forecast?.forecast) {
          setDataError('Forecast data could not be loaded. Check that the backend API is running with the latest code.');
        }
      })
      .catch(() => setDataError('Forecast data could not be loaded. Check that the backend API is running with the latest code.'))
      .finally(() => setLoading(false));
  }, []);

  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return `${date.getHours()}:00`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-panel/95 backdrop-blur-sm border border-panelBorder p-4 rounded-xl shadow-2xl">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">{new Date(label).toLocaleString()}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <span className="text-sm font-medium" style={{ color: entry.color }}>
                {entry.name}
              </span>
              <span className="text-sm font-bold text-foreground">
                {entry.value.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 flex flex-col gap-8">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Air Quality Forecast</h1>
        <p className="text-gray-500 dark:text-gray-400">72-hour outlook for Delhi NCR</p>
      </div>

      {loading ? (
        <div className="w-full flex flex-col gap-8">
          <div className="h-96 w-full bg-gray-200 dark:bg-gray-900 rounded-2xl border border-panelBorder animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 dark:bg-gray-900 rounded-2xl border border-panelBorder animate-pulse" />
            <div className="h-64 bg-gray-200 dark:bg-gray-900 rounded-2xl border border-panelBorder animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full gap-6">
          {/* KPI CARDS */}
          {dataError && (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {dataError}
            </div>
          )}
          <KpiCards forecast={forecast} />

          {/* CHART */}
          <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
              <Activity className="w-5 h-5 text-teal-500 dark:text-teal-400" /> 72-Hour Trajectory
            </h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecast} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                  <XAxis dataKey="timestamp" stroke="#6b7280" tickFormatter={formatXAxis} tick={{ fontSize: 12, fill: '#6b7280' }} />

                  {/* Left Axis for AQI & PM2.5 */}
                  <YAxis yAxisId="left" stroke="#6b7280" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  {/* Right Axis for PBLH */}
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" tick={{ fontSize: 12, fill: '#6b7280' }} />

                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                  <Line yAxisId="left" type="monotone" dataKey="aqi" name="AQI" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line yAxisId="left" type="monotone" dataKey="pm25_ug_m3" name="PM2.5 (µg/m³)" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="pbl_height_m" name="PBLH (m)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="temperature_c" name="Temp (°C)" stroke="#14b8a6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* INTELLIGENCE PANELS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Inversion Condition */}
            <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4"><Layers className="w-24 h-24 text-blue-500/5" /></div>
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                <ShieldAlert className="w-5 h-5 text-blue-500 dark:text-blue-400" /> Trapping Conditions (T+24h)
              </h2>

              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Atmospheric Category</p>
                  <p className={`text-2xl font-bold ${inversion?.category === 'Severe' ? 'text-red-500 dark:text-red-400' :
                      inversion?.category === 'High' ? 'text-orange-500 dark:text-orange-400' : 'text-yellow-500 dark:text-yellow-400'
                    }`}>
                    {inversion?.category ?? 'Unknown'} Trapping
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background p-4 rounded-xl border border-panelBorder">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                      <Layers className="w-3 h-3" /> PBL Height
                    </div>
                    <p className="text-lg font-bold text-foreground">{inversion?.pbl_height_m?.toFixed(0) ?? '—'} m</p>
                  </div>
                  <div className="bg-background p-4 rounded-xl border border-panelBorder">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1">
                      <Wind className="w-3 h-3" /> Wind Speed
                    </div>
                    <p className="text-lg font-bold text-foreground">{inversion?.wind_speed_mps?.toFixed(1) ?? '—'} m/s</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Pollution Sources */}
            <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4"><AlertTriangle className="w-24 h-24 text-red-500/5" /></div>
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" /> Top Source Attribution (T+24h)
              </h2>

              <div className="space-y-4">
                {sources.slice(0, 3).map((source: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-background rounded-xl border border-panelBorder group hover:border-red-500/30 transition-colors">
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-red-700 dark:group-hover:text-red-50 transition-colors">
                        Fire Cluster #{source.cluster_id}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {source.fire_count} active fires • {source.wind.speed_mps.toFixed(1)} m/s wind
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Impact Score</p>
                      <p className="text-lg font-bold text-red-500 dark:text-red-400">{source.source_score.toFixed(1)}</p>
                    </div>
                  </div>
                ))}
                {sources.length === 0 && (
                  <div className="p-4 bg-background rounded-xl border border-panelBorder text-center text-gray-500 dark:text-gray-400">
                    No high-impact source clusters detected for this hour.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* AI EXPLANATION & SHAP ATTRIBUTION */}
          {explanation && (
            <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden mt-2">
              <div className="absolute top-0 right-0 p-4"><Lightbulb className="w-32 h-32 text-yellow-500/5" /></div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <Lightbulb className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                    AI Explainability & Physics (SHAP)
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    TreeExplainer feature attributions explaining what drives current PM2.5 predictions.
                  </p>
                </div>

                {explanation?.model && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      {explanation.model}
                    </span>
                    {explanation?.model_metrics?.pm25_r2 && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        R² = {explanation.model_metrics.pm25_r2} (MAE: {explanation.model_metrics.pm25_mae} µg/m³)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 border-l-2 border-yellow-500 pl-4">{explanation.summary}</p>

              {/* SHAP Feature Contribution Bars */}
              {explanation?.top_drivers && explanation.top_drivers.length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-background/60 border border-panelBorder">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    Top SHAP Feature Attributions (µg/m³ impact on PM2.5)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {explanation.top_drivers.map((d: any, idx: number) => {
                      const isPos = d.shap > 0;
                      return (
                        <div key={idx} className="p-3 rounded-lg bg-panel border border-panelBorder flex flex-col justify-between">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-mono font-medium text-foreground truncate max-w-[140px]">{d.feature}</span>
                            <span className={`flex items-center gap-1 font-bold ${isPos ? 'text-red-500' : 'text-teal-500'}`}>
                              {isPos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {isPos ? `+${d.shap.toFixed(2)}` : d.shap.toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isPos ? 'bg-red-500' : 'bg-teal-500'}`}
                              style={{ width: `${Math.min(100, Math.abs(d.shap) * 12)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mechanism Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {explanation.primary_drivers?.map((driver: any, idx: number) => (
                  <div key={idx} className="bg-background rounded-xl border border-panelBorder p-5">
                    <h3 className="font-bold text-foreground mb-2">{driver.factor}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-mono">{driver.evidence}</p>
                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                      <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">Mechanism</p>
                      <p className="text-sm text-blue-800 dark:text-blue-100 mt-1">{driver.mechanism}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WHAT-IF SCENARIO SIMULATION */}
          <ScenarioWhatIf />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <StationHeatmap />
            <CorrelationMatrix forecast={forecast} />
          </div>

        </div>
      )}
    </div>
  );
}
