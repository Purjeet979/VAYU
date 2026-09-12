"use client";

import React from 'react';
import { Sliders, Flame, Info, ShieldAlert } from 'lucide-react';

interface Cluster {
  cluster_id: number;
  centroid: { lat: number; lon: number };
  fire_count: number;
  frp_sum: number;
  distance_to_delhi_km?: number;
  source_score?: number;
  wind_alignment_score?: number;
  travel_time_hours?: number;
}

interface ScenarioSidebarProps {
  stubbleReduction: number;       // 0 to 1
  setStubbleReduction: (val: number) => void;
  clusters: Cluster[] | null;     // from /api/sources
  deltaAQI: number;
  deltaPM25: number;
  baselineAQI: number;
  scenarioAQI: number;
  dominantPollutant: string;
  explanation?: { primary_drivers?: Array<{ factor: string; evidence: string; mechanism: string }>; scientific_status?: string } | null;
  uncertainty?: string | null;
  theme?: 'light' | 'dark';
}

export default function ScenarioSidebar({
  stubbleReduction, setStubbleReduction,
  clusters, deltaAQI, deltaPM25,
  baselineAQI, scenarioAQI, dominantPollutant,
  explanation, uncertainty,
  theme = 'dark'
}: ScenarioSidebarProps) {
  const isDark = theme === 'dark';
  const emissionsPct = Math.round((1 - stubbleReduction) * 100);
  const reductionPct = Math.round(stubbleReduction * 100);

  const card = `rounded-xl border p-4 shadow-md transition-colors ${isDark ? 'bg-[#181c25] border-[#2a3140]' : 'bg-white border-gray-200'}`;
  const dimText = `text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`;
  const bodyText = isDark ? 'text-gray-300' : 'text-gray-700';

  return (
    <div className={`w-full border-t p-5 flex flex-col gap-6 shrink-0 lg:w-[340px] lg:border-l lg:border-t-0 lg:overflow-y-auto transition-colors ${
      isDark ? 'bg-[#11141c] border-[#1e2532]' : 'bg-slate-50 border-gray-200'
    }`}>

      {/* ── What-If Scenario Panel ── */}
      <section>
        <h2 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <Sliders className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-blue-500'}`} />
          What-If Scenario
        </h2>
        <div className={card}>
          <div className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Stubble Burning Emissions
          </div>
          <div className={`text-xs mb-3 ${dimText}`}>Adjust Punjab/Haryana activity (Nov burning season)</div>

          {/* Current emission level readout */}
          <div className="flex justify-between items-baseline mb-2">
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Full emissions</span>
            <span className={`text-2xl font-black ${isDark ? 'text-purple-400' : 'text-blue-600'}`}>{emissionsPct}%</span>
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Zero</span>
          </div>

          <input
            type="range" min="0" max="100"
            value={reductionPct}
            onChange={e => setStubbleReduction(parseInt(e.target.value, 10) / 100)}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isDark ? 'bg-gray-700 accent-purple-500' : 'bg-gray-200 accent-blue-500'}`}
          />
          <div className={`text-center text-xs mt-1 ${dimText}`}>
            Reduction applied: <span className="font-semibold">{reductionPct}%</span>
          </div>

          {/* Impact summary */}
          <div className={`mt-4 pt-4 border-t ${isDark ? 'border-[#2a3140]' : 'border-gray-200'}`}>
            <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Predicted Impact</div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-lg p-2.5 text-center ${isDark ? 'bg-[#0b0e14]' : 'bg-gray-50'}`}>
                <div className={`text-xs mb-1 ${dimText}`}>AQI</div>
                <div className="flex items-center justify-center gap-1">
                  <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'} line-through`}>{baselineAQI}</span>
                  <span className={`text-lg font-black ${scenarioAQI < baselineAQI ? 'text-emerald-500' : 'text-gray-400'}`}>{scenarioAQI}</span>
                </div>
                {deltaAQI < 0 && <div className="text-xs font-semibold text-emerald-500">{deltaAQI} pts</div>}
              </div>
              <div className={`rounded-lg p-2.5 text-center ${isDark ? 'bg-[#0b0e14]' : 'bg-gray-50'}`}>
                <div className={`text-xs mb-1 ${dimText}`}>PM2.5</div>
                <div className={`text-lg font-black ${deltaPM25 < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {deltaPM25 !== 0 ? (deltaPM25 > 0 ? '+' : '') + deltaPM25.toFixed(1) : '0'}
                </div>
                <div className={`text-xs ${dimText}`}>µg/m³</div>
              </div>
            </div>
            {reductionPct > 0 && (
              <div className={`mt-3 text-xs rounded-lg p-2 ${isDark ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                🌱 {reductionPct}% stubble reduction → dominant: <strong>{dominantPollutant}</strong>
              </div>
            )}
            <div className={`mt-3 rounded-lg border p-2.5 ${isDark ? 'border-emerald-900/50 bg-emerald-950/20' : 'border-emerald-100 bg-emerald-50/50'}`}>
              <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Change from baseline</div>
              <div className={`h-2 overflow-hidden rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.abs(deltaPM25) * 3)}%` }} /></div>
              <div className={`mt-1 text-xs ${deltaPM25 < 0 ? 'text-emerald-500' : dimText}`}>{deltaPM25 < 0 ? `${Math.abs(deltaPM25).toFixed(1)} µg/m³ lower PM2.5` : 'No reduction selected'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fire Source Clusters (real data from /api/sources) ── */}
      <section>
        <h2 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <Flame className="w-4 h-4 text-orange-500" />
          Active Fire Clusters
          {clusters && <span className={`text-xs font-normal rounded-full px-2 py-0.5 ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>{clusters.length}</span>}
        </h2>
        <div className="flex flex-col gap-3">
          {clusters && clusters.length > 0 ? (
            clusters.slice(0, 5).map(c => (
              <div key={c.cluster_id} className={card}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    Cluster #{c.cluster_id}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    (c.source_score ?? 0) > 0.6
                      ? (isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-600')
                      : (isDark ? 'bg-yellow-900/40 text-yellow-400' : 'bg-yellow-100 text-yellow-600')
                  }`}>
                    Score: {c.source_score !== undefined ? c.source_score.toFixed(2) : 'N/A'}
                  </span>
                </div>
                <div className={`grid grid-cols-3 gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <div>
                    <div className="font-medium">🔥 Fires</div>
                    <div className={`font-bold text-sm ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{c.fire_count}</div>
                  </div>
                  <div>
                    <div className="font-medium">FRP Sum</div>
                    <div className={`font-bold text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{c.frp_sum.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Distance</div>
                    <div className={`font-bold text-sm ${bodyText}`}>{c.distance_to_delhi_km?.toFixed(0) ?? '—'} km</div>
                  </div>
                </div>
                {c.travel_time_hours !== undefined && (
                  <div className={`mt-2 pt-2 border-t text-xs ${isDark ? 'border-[#2a3140] text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                    ⏱ Est. arrival: ~{c.travel_time_hours.toFixed(1)} hrs
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className={`${card} py-6 text-center`}>
              <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {clusters === null ? 'Connecting to backend...' : 'No active fire clusters detected.'}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}><Info className="w-4 h-4 text-cyan-500" />Why this outlook</h2>
        <div className={card}>
          {explanation?.primary_drivers?.length ? <div className="space-y-3">
            {explanation.primary_drivers.slice(0, 3).map((driver, index) => <div key={driver.factor} className={index ? `pt-3 border-t ${isDark ? 'border-[#2a3140]' : 'border-gray-100'}` : ''}>
              <div className={`text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>{driver.factor}</div>
              <div className={`mt-1 text-xs ${dimText}`}>{driver.evidence}</div>
            </div>)}
          </div> : <div className={`text-sm ${dimText}`}>Loading transparent driver evidence…</div>}
        </div>
      </section>

      <section>
        <h2 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}><ShieldAlert className="w-4 h-4 text-amber-500" />Uncertainty</h2>
        <div className={`${card} text-xs ${bodyText}`}>
          <p>{uncertainty ?? 'Forecast confidence is loading…'}</p>
          <p className={`mt-2 ${dimText}`}>Demo outputs are synthetic prototype estimates, not validated operational forecasts.</p>
        </div>
      </section>

    </div>
  );
}
