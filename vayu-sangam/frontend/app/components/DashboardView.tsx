"use client";

import { useEffect, useState, useMemo } from 'react';
import { Activity, AlertTriangle, Cpu, Layers, Lightbulb, ShieldAlert, TrendingDown, TrendingUp, Wind, Info } from 'lucide-react';
import { CartesianGrid, Legend, Line, ComposedChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';

import CorrelationMatrix from './CorrelationMatrix';
import DataConfidenceBadge from './DataConfidenceBadge';
import ForecastSlider from './ForecastSlider';
import KpiCards from './KpiCards';
import ScenarioWhatIf from './ScenarioWhatIf';
import StationHeatmap from './StationHeatmap';
import StationForecastPanel from './StationForecastPanel';
import DominantDriversPanel from './DominantDriversPanel';
import EarlyWarningBanner from './EarlyWarningBanner';
import CamsCrossValidation from './CamsCrossValidation';
import TwoLayerCard from './TwoLayerCard';
import { fetchJson } from '../lib/api';
import { getTrendArrow, getUncertaintyMessage, getScientificStatus, getPollutantAvailability, categoryToEmoji } from '../utils/forecastMessages';

type ForecastPoint = {
  timestamp: string;
  aqi: number;
  aqi_lower?: number | null;
  aqi_upper?: number | null;
  pm25_ug_m3?: number | null;
  pm10_ug_m3?: number | null;
  no2_ug_m3?: number | null;
  o3_ug_m3?: number | null;
  so2_ug_m3?: number | null;
  co_mg_m3?: number | null;
  pbl_height_m?: number | null;
  temperature_c?: number | null;
  wind_speed_mps?: number | null;
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
  fallback?: boolean;
  forecast?: {
    forecast?: ForecastPoint[];
    fallback?: boolean;
    confidence?: string;
    note?: string;
    scientific_status?: string;
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
  const [confidence, setConfidence] = useState<string | null>(null);
  const [scientificStatus, setScientificStatus] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [inversion, setInversion] = useState<Inversion | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [hour, setHour] = useState(24);
  const [selectedPollutant, setSelectedPollutant] = useState("pm25");
  const [showSecondaryPanels, setShowSecondaryPanels] = useState(false);
  const [usingBackup, setUsingBackup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDataError(null);

    fetchJson<DashboardSummary>(`/api/dashboard-summary?hours=72&hour=${hour}`, { timeoutMs: 8000 })
      .then((data) => {
        if (cancelled) return;

        const nextForecast = data?.forecast?.forecast ?? [];
        setUsingBackup(Boolean(data?.fallback || data?.forecast?.fallback));
        setForecast(nextForecast);
        setConfidence(data?.forecast?.confidence ?? null);
        setScientificStatus(data?.forecast?.scientific_status ?? null);
        setNote(data?.forecast?.note ?? null);
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

  // --- DYNAMIC FORECAST COMPUTATIONS ---
  const pollutantAvail = useMemo(() => getPollutantAvailability(forecast), [forecast]);
  
  const currentAQI = forecast[0]?.aqi ?? null;
  const forecast24h = forecast.slice(0, 24);
  const avg24h = forecast24h.length ? forecast24h.reduce((acc, curr) => acc + (curr.aqi || 0), 0) / forecast24h.length : 0;
  
  const trendArrow = useMemo(() => getTrendArrow(currentAQI || 0, avg24h), [currentAQI, avg24h]);

  const uncertaintyMsg = useMemo(() => {
    if (!forecast.length) return '';
    const avgLower = forecast.reduce((acc, f) => acc + (f.aqi_lower || 0), 0) / forecast.length;
    const avgUpper = forecast.reduce((acc, f) => acc + (f.aqi_upper || 0), 0) / forecast.length;
    return getUncertaintyMessage(avgLower, avgUpper, avg24h || currentAQI || 1);
  }, [forecast, avg24h, currentAQI]);

  const historyMatch = scientificStatus?.match(/(\d+)\/24h/);
  const actualHistoryCount = historyMatch ? parseInt(historyMatch[1]) : 24;

  const dynamicSciStatus = useMemo(() => getScientificStatus(
    usingBackup ? 'bundled_demo_dataset' : 'xgboost_live_inference',
    scientificStatus || '',
    currentAQI,
    actualHistoryCount
  ), [usingBackup, scientificStatus, currentAQI, actualHistoryCount]);


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

      <EarlyWarningBanner />
      <ForecastSlider hour={hour} setHour={setHour} />

      {loading && forecast.length === 0 ? (
        <div className="w-full flex flex-col gap-8">
          <div className="h-96 w-full bg-gray-900 rounded-2xl border border-gray-800 animate-pulse" />
        </div>
      ) : (
        <div className="flex flex-col h-full gap-6">
          {usingBackup && !dataError && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-200">
              Live refresh is temporarily unavailable. Showing the latest saved forecast so the dashboard remains useful.
            </div>
          )}
          {dataError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {dataError}
            </div>
          )}

          <KpiCards forecast={forecast} hour={hour} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl h-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                      <Activity className="w-5 h-5 text-teal-500 dark:text-teal-400" /> 
                      72-Hour Trajectory 
                      <span className="text-sm font-medium ml-1 text-gray-500 dark:text-gray-400 border border-panelBorder px-2 py-0.5 rounded-full bg-background">{trendArrow.icon} {trendArrow.text}</span>
                    </h2>
                    <div className="flex items-center gap-4">
                      <select 
                        className="bg-background border border-panelBorder rounded-lg px-3 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                        value={selectedPollutant}
                        onChange={(e) => setSelectedPollutant(e.target.value)}
                      >
                        {pollutantAvail.pm25 && <option value="pm25">🌫️ PM2.5</option>}
                        {pollutantAvail.pm10 && <option value="pm10">🌫️ PM10</option>}
                        {pollutantAvail.no2 && <option value="no2">🚗 NO2</option>}
                        {pollutantAvail.o3 && <option value="o3">☀️ O3</option>}
                        {pollutantAvail.so2 && <option value="so2">🏭 SO2</option>}
                        {pollutantAvail.co && <option value="co">🚘 CO</option>}
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <TwoLayerCard
                      icon={<Info className="w-4 h-4 text-indigo-400" />}
                      title="Forecast Status & Confidence"
                      laymanMessage={<span className="text-sm font-semibold text-foreground">{dynamicSciStatus.simple}</span>}
                      technicalDetails={
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-gray-400 border-l-2 border-indigo-500 pl-2">
                            {dynamicSciStatus.technical}
                          </p>
                          {confidence && (
                            <div className={`px-2 py-1 w-fit rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                              confidence === 'low' 
                              ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                              : 'bg-green-500/10 border-green-500/30 text-green-400'
                            }`}>
                              {confidence === 'low' ? '⚠️ Low Statistical Confidence' : '✅ High Statistical Confidence'}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </div>
                
                {(() => {
                  const pollutantKey = `${selectedPollutant}_ug_m3` as keyof ForecastPoint;
                  const hasData = selectedPollutant === 'co' 
                    ? forecast.some(f => f.co_mg_m3 != null)
                    : forecast.some(f => f[pollutantKey] != null);
                    
                  if (!hasData) {
                    return (
                      <div className="h-80 w-full flex items-center justify-center bg-background rounded-lg border border-dashed border-panelBorder p-4">
                        <div className="text-center">
                          <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-3 opacity-50" />
                          <p className="text-lg font-bold text-gray-400">ℹ️ Iske baare mein abhi jaankari nahi hai.</p>
                          <p className="text-xs text-gray-500 mt-2">(Insufficient sensor data for {selectedPollutant.toUpperCase()})</p>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="h-80 w-full flex flex-col">
                      <div className="flex-grow min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={forecast} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                                    {payload.map((entry, index) => {
                                      // Dynamic emoji matching for AQI from category mapping
                                      const cat = forecast.find(f => f.timestamp === label)?.category;
                                      const emoji = cat && categoryToEmoji[cat] ? categoryToEmoji[cat] : '';
                                      return (
                                        <div key={index} className="flex items-center justify-between gap-4 mb-1">
                                          <span className="text-sm font-medium" style={{ color: entry.color }}>{entry.name === 'AQI' && emoji ? `${emoji} ${entry.name}` : entry.name}</span>
                                          <span className="text-sm font-bold text-foreground">
                                            {entry.value !== null && entry.value !== undefined ? Number(entry.value).toFixed(1) : '-'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            {forecast.some(point => typeof point.aqi_lower === 'number' && typeof point.aqi_upper === 'number') && (
                              <Area yAxisId="left" type="monotone" dataKey={(data) => (
                                typeof data.aqi_lower === 'number' && typeof data.aqi_upper === 'number'
                                  ? [data.aqi_lower, data.aqi_upper]
                                  : undefined
                              )} fill="#ef4444" stroke="none" fillOpacity={0.15} name="AQI Uncertainty" />
                            )}
                            <Line yAxisId="left" type="monotone" dataKey="aqi" name="AQI" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            {forecast[hour]?.timestamp && <ReferenceLine x={forecast[hour].timestamp} stroke="#14b8a6" strokeDasharray="4 4" label={{ value: `T+${hour}`, fill: '#14b8a6', fontSize: 11 }} />}
                            
                            {selectedPollutant === 'pm25' && <Line yAxisId="left" type="monotone" dataKey="pm25_ug_m3" name="PM2.5" stroke="#f97316" strokeWidth={2} dot={false} />}
                            {selectedPollutant === 'pm10' && <Line yAxisId="left" type="monotone" dataKey="pm10_ug_m3" name="PM10" stroke="#f97316" strokeWidth={2} dot={false} />}
                            {selectedPollutant === 'no2' && <Line yAxisId="left" type="monotone" dataKey="no2_ug_m3" name="NO2" stroke="#f97316" strokeWidth={2} dot={false} />}
                            {selectedPollutant === 'o3' && <Line yAxisId="left" type="monotone" dataKey="o3_ug_m3" name="O3" stroke="#f97316" strokeWidth={2} dot={false} />}
                            {selectedPollutant === 'so2' && <Line yAxisId="left" type="monotone" dataKey="so2_ug_m3" name="SO2" stroke="#f97316" strokeWidth={2} dot={false} />}
                            {selectedPollutant === 'co' && <Line yAxisId="left" type="monotone" dataKey="co_mg_m3" name="CO" stroke="#f97316" strokeWidth={2} dot={false} />}
                            
                            <Line yAxisId="right" type="monotone" dataKey="pbl_height_m" name="PBLH (m)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            <Line yAxisId="left" type="monotone" dataKey="temperature_c" name="Temp (C)" stroke="#14b8a6" strokeWidth={2} dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      {uncertaintyMsg && (
                        <div className="mt-2 text-center text-xs text-gray-500 italic bg-background border border-panelBorder rounded py-1 px-3 w-fit mx-auto">
                          💡 {uncertaintyMsg}
                        </div>
                      )}
                    </div>
                  );
              })()}
                {note && (
                  <p className="mt-4 text-[10px] text-gray-500/70 dark:text-gray-400/70 italic text-center border-t border-panelBorder pt-2">
                    * {note}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <TwoLayerCard
                icon={<ShieldAlert className="w-5 h-5 text-blue-500 dark:text-blue-400" />}
                title="Hawa ki Sthiti (Ventilation)"
                laymanMessage={
                  <div className="text-xl font-bold">
                    {(() => {
                      const cat = inversion?.category?.toLowerCase() || '';
                      if (cat.includes('severe') || cat.includes('strong')) return <span className="text-red-400">🚨 Kharaab (Ghutaan hai, dhuaa upar nahi ja paa raha)</span>;
                      if (cat.includes('moderate')) return <span className="text-yellow-400">⚠️ Thodi Ghutaan (Hawa dhimi hai)</span>;
                      if (cat.includes('good') || cat.includes('weak')) return <span className="text-green-400">✅ Saaf (Hawa theek chal rahi hai)</span>;
                      return <span className="text-gray-400">ℹ️ Mausam ki sthiti samanya hai</span>;
                    })()}
                  </div>
                }
                technicalDetails={
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-background p-4 rounded-xl border border-panelBorder">
                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Layers className="w-3 h-3" /> PBL Height</div>
                      <p className="text-lg font-bold text-foreground">{inversion?.pbl_height_m?.toFixed(0) ?? '-'} m</p>
                    </div>
                    <div className="bg-background p-4 rounded-xl border border-panelBorder">
                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Wind className="w-3 h-3" /> Wind Speed</div>
                      <p className="text-lg font-bold text-foreground">{inversion?.wind_speed_mps?.toFixed(1) ?? '-'} m/s</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Category: {inversion?.category ?? 'Unknown'}</p>
                    </div>
                  </div>
                }
              />

              <TwoLayerCard
                icon={<AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />}
                title="Dhuaa Kahan Se Aa Raha Hai?"
                laymanMessage={
                  <div className="text-xl font-bold">
                    {sources.length > 0 
                      ? <span className="text-orange-400">🔥 Padosi Rajyo Se (Kheti ka dhuaa aa raha hai)</span>
                      : <span className="text-teal-400">🚗 Sirf Local (Bahaar se dhuaa nahi aa raha)</span>
                    }
                  </div>
                }
                technicalDetails={
                  <div className="space-y-3 mt-2">
                    {sources.slice(0, 3).map((source) => (
                      <div key={source.cluster_id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-panelBorder">
                        <div>
                          <p className="font-semibold text-foreground text-sm">Fire Cluster #{source.cluster_id}</p>
                          <p className="text-xs text-gray-500 mt-1">{source.fire_count} active fires, {source.wind?.speed_mps?.toFixed(1) ?? '-'} m/s wind</p>
                        </div>
                        <p className="text-lg font-bold text-red-500 dark:text-red-400">{source.source_score?.toFixed(1) ?? '-'}</p>
                      </div>
                    ))}
                    {sources.length === 0 && <div className="text-xs text-gray-500">No external source clusters detected by satellites.</div>}
                  </div>
                }
              />
            </div>
          </div>

          {explanation && (
            <TwoLayerCard
              icon={<Lightbulb className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />}
              title="Pradushan Kyun Badh Raha Hai?"
              laymanMessage={
                <div className="flex flex-col gap-3">
                  {explanation.top_drivers?.slice(0, 3).map((driver, idx) => {
                    const feat = driver.feature?.toLowerCase() || '';
                    if (feat.includes('pbl') || feat.includes('wind')) return <div key={idx} className="text-lg font-bold text-blue-600 dark:text-blue-400">🌫️ Mausam (Hawa band hai)</div>;
                    if (feat.includes('fire') || feat.includes('stubble')) return <div key={idx} className="text-lg font-bold text-red-600 dark:text-red-400">🔥 Parali (Dhuaa idhar aa raha hai)</div>;
                    if (feat.includes('pm25_lag')) return <div key={idx} className="text-lg font-bold text-orange-600 dark:text-orange-400">🚗 Local Pollution (Traffic/Dust)</div>;
                    return <div key={idx} className="text-lg font-bold text-gray-700 dark:text-gray-400">❓ Anya kaaran</div>;
                  })}
                  {!explanation.top_drivers?.length && explanation.primary_drivers?.map((driver, idx) => (
                    <div key={idx} className="text-lg font-bold text-gray-700 dark:text-gray-300">
                      {driver.factor?.includes('trapping') ? '🌫️ Mausam (Hawa band hai)' : 
                       driver.factor?.includes('source cluster') ? '🔥 Parali (Dhuaa idhar aa raha hai)' :
                       driver.factor?.includes('Demo') ? '🚗 Local Pollution' : '❓ Anya kaaran'}
                    </div>
                  ))}
                </div>
              }
              technicalDetails={
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-foreground">SHAP Feature Attributions</h3>
                    {explanation.model && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" />
                        {explanation.model}
                      </span>
                    )}
                  </div>
                  {explanation.summary && <p className="text-xs text-gray-500 mb-6 italic">{explanation.summary}</p>}

                  {explanation.top_drivers?.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {explanation.top_drivers.slice(0, 6).map((driver, idx) => {
                        const shap = driver.shap ?? 0;
                        const isPositive = shap > 0;
                        return (
                          <div key={`${driver.feature}-${idx}`} className="p-3 rounded-lg bg-background border border-panelBorder">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-mono font-medium text-foreground truncate max-w-[140px]" title={driver.feature}>{driver.feature}</span>
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
                  ) : explanation.primary_drivers?.length ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {explanation.primary_drivers.map((driver, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-background border border-panelBorder shadow-sm flex flex-col gap-2">
                          <p className="font-bold text-foreground text-sm">{driver.factor}</p>
                          <p className="text-xs text-cyan-400 mt-1">{driver.evidence}</p>
                          <p className="text-xs text-gray-500 italic mt-1">{driver.mechanism}</p>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-800 overflow-hidden" title="Relative priority from transparent rules">
                            <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(35, 100 - idx * 25)}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500">Relative rule priority</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              }
            />
          )}

          {showSecondaryPanels ? (
            <>
              <DominantDriversPanel hour={hour} />
              <ScenarioWhatIf />
              <CamsCrossValidation hour={hour} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <StationHeatmap />
                <StationForecastPanel hour={hour} />
              </div>
              <div className="mt-6">
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
