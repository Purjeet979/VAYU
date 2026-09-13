"use client";

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Cpu, Layers, Lightbulb, ShieldAlert, TrendingDown, TrendingUp, Wind } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import CorrelationMatrix from './CorrelationMatrix';
import DataConfidenceBadge from './DataConfidenceBadge';
import ForecastSlider from './ForecastSlider';
import KpiCards from './KpiCards';
import ScenarioWhatIf from './ScenarioWhatIf';
import StationHeatmap from './StationHeatmap';
import { fetchJson } from '../lib/api';

type ForecastPoint = {
  timestamp: string;
  aqi: number;
  pm25_ug_m3: number;
  pm10_ug_m3?: number;
  pbl_height_m?: number;
  temperature_c?: number;
  wind_speed_mps?: number;
};

type Inversion = {
  category?: string;
  pbl_height_m?: number;
  wind_speed_mps?: number;
};

type Source = {
  cluster_id: number | string;
  fire_count: number;
  source_score?: number;
  wind?: {
    speed_mps?: number;
  };
};

type ExplanationDriver = {
  feature?: string;
  shap?: number;
  factor?: string;
  evidence?: string;
  mechanism?: string;
};

type Explanation = {
  summary?: string;
  model?: string;
  model_metrics?: {
    pm25_r2?: number;
    pm25_mae?: number;
  };
  top_drivers?: ExplanationDriver[];
  primary_drivers?: ExplanationDriver[];
};

type DashboardSummary = {
  forecast?: {
    forecast?: ForecastPoint[];
  };
  inversion?: Inversion;
  sources?: {
    sources?: Source[];
  };
  explanation?: Explanation;
};

function MetricShell() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div className="h-64 bg-panel rounded-2xl border border-panelBorder animate-pulse" />
      <div className="h-64 bg-panel rounded-2xl border border-panelBorder animate-pulse" />
    </div>
  );
}

export default function DashboardView() {
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [inversion, setInversion] = useState<Inversion | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [hour, setHour] = useState(24);
  const [showSecondaryPanels, setShowSecondaryPanels] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDataError(null);

    fetchJson<DashboardSummary>(`/api/dashboard-summary?hours=72&hour=${hour}`, { timeoutMs: 5000 })
      .then((data) => {
        if (cancelled) return;

        const nextForecast = data?.forecast?.forecast ?? [];
        setForecast(nextForecast);
        setInversion(data?.inversion ?? null);
        setSources(data?.sources?.sources ?? []);
        setExplanation(data?.explanation ?? null);

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

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSecondaryPanels(true), 350);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 flex flex-col gap-8">
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
              <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl h-full">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                  <Activity className="w-5 h-5 text-teal-500 dark:text-teal-400" /> 72-Hour Trajectory
                </h2>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecast} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                      <XAxis dataKey="timestamp" stroke="#6b7280" tickFormatter={(tickItem: string) => `${new Date(tickItem).getHours()}:00`} tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <YAxis yAxisId="left" stroke="#6b7280" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#6b7280" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;

                          return (
                            <div className="bg-panel/95 backdrop-blur-sm border border-panelBorder p-4 rounded-xl shadow-2xl">
                              <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">{new Date(label ?? '').toLocaleString()}</p>
                              {payload.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between gap-4 mb-1">
                                  <span className="text-sm font-medium" style={{ color: entry.color }}>{entry.name}</span>
                                  <span className="text-sm font-bold text-foreground">{Number(entry.value ?? 0).toFixed(1)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="aqi" name="AQI" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                      <Line yAxisId="left" type="monotone" dataKey="pm25_ug_m3" name="PM2.5 (ug/m3)" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="pbl_height_m" name="PBLH (m)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="temperature_c" name="Temp (C)" stroke="#14b8a6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4"><Layers className="w-24 h-24 text-blue-500/5" /></div>
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                  <ShieldAlert className="w-5 h-5 text-blue-500 dark:text-blue-400" /> Trapping Conditions
                </h2>
                <p className="text-sm text-gray-500 mb-1">Atmospheric Category</p>
                <p className="text-2xl font-bold text-yellow-500 dark:text-yellow-400 mb-4">{inversion?.category ?? 'Unknown'} Trapping</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background p-4 rounded-xl border border-panelBorder">
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Layers className="w-3 h-3" /> PBL Height</div>
                    <p className="text-lg font-bold text-foreground">{inversion?.pbl_height_m?.toFixed(0) ?? '-'} m</p>
                  </div>
                  <div className="bg-background p-4 rounded-xl border border-panelBorder">
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Wind className="w-3 h-3" /> Wind Speed</div>
                    <p className="text-lg font-bold text-foreground">{inversion?.wind_speed_mps?.toFixed(1) ?? '-'} m/s</p>
                  </div>
                </div>
              </div>

              <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" /> Top Sources
                </h2>
                <div className="space-y-3">
                  {sources.slice(0, 3).map((source) => (
                    <div key={source.cluster_id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-panelBorder">
                      <div>
                        <p className="font-semibold text-foreground">Fire Cluster #{source.cluster_id}</p>
                        <p className="text-xs text-gray-500 mt-1">{source.fire_count} active fires, {source.wind?.speed_mps?.toFixed(1) ?? '-'} m/s wind</p>
                      </div>
                      <p className="text-lg font-bold text-red-500 dark:text-red-400">{source.source_score?.toFixed(1) ?? '-'}</p>
                    </div>
                  ))}
                  {sources.length === 0 && <div className="p-4 bg-background rounded-xl border border-panelBorder text-center text-gray-500">No source clusters detected.</div>}
                </div>
              </div>
            </div>
          </div>

          {explanation && (
            <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4"><Lightbulb className="w-32 h-32 text-yellow-500/5" /></div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <Lightbulb className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                    Explainability & Physics
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Feature attributions explaining what drives current PM2.5 predictions.</p>
                </div>
                {explanation.model && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    {explanation.model}
                  </span>
                )}
              </div>

              {explanation.summary && <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 border-l-2 border-yellow-500 pl-4">{explanation.summary}</p>}

              {explanation.top_drivers?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {explanation.top_drivers.slice(0, 6).map((driver, idx) => {
                    const shap = driver.shap ?? 0;
                    const isPositive = shap > 0;
                    return (
                      <div key={`${driver.feature}-${idx}`} className="p-3 rounded-lg bg-background border border-panelBorder">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-mono font-medium text-foreground truncate max-w-[140px]">{driver.feature}</span>
                          <span className={`flex items-center gap-1 font-bold ${isPositive ? 'text-red-500' : 'text-teal-500'}`}>
                            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {isPositive ? `+${shap.toFixed(2)}` : shap.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isPositive ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(100, Math.abs(shap) * 12)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}

          {showSecondaryPanels ? (
            <>
              <ScenarioWhatIf />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <StationHeatmap />
                <CorrelationMatrix forecast={forecast} />
              </div>
            </>
          ) : (
            <MetricShell />
          )}
        </div>
      )}
    </div>
  );
}
