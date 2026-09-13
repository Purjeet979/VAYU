"use client";

import { useState, useEffect, useCallback } from 'react';
import { Sliders, Sparkles, TrendingDown, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ScenarioData {
  mode: string;
  scientific_status: string;
  note: string;
  stubble_reduction: number;
  hour: number;
  baseline_pm25: number;
  scenario_pm25: number;
  pm25_change: number;
  baseline_pm10: number;
  scenario_pm10: number;
  pm10_change: number;
  baseline_o3: number;
  scenario_o3: number;
  baseline_aqi: number;
  scenario_aqi: number;
  aqi_change: number;
  dominant_pollutant: string;
  scenario_dominant_pollutant: string;
  baseline_aqi_sub_indices?: {
    pm25: number;
    pm10: number;
    o3: number;
  };
  scenario_aqi_sub_indices?: {
    pm25: number;
    pm10: number;
    o3: number;
  };
}

export default function ScenarioWhatIf() {
  const [reduction, setReduction] = useState<number>(0.3); // 30% default
  const [data, setData] = useState<ScenarioData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async (redVal: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stubble_reduction: redVal,
          hour: 24,
        }),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json: ScenarioData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Failed to compute scenario');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSimulation(reduction);
  }, [reduction, runSimulation]);

  const reductionPct = Math.round(reduction * 100);
  const emissionsPct = 100 - reductionPct;

  return (
    <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-5">
        <Sliders className="w-40 h-40 text-teal-400" />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-500 dark:text-teal-400" />
              What-If Scenario Simulation
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              XGBoost Corrected
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Simulate agricultural emission reductions in Punjab/Haryana to predict Delhi NCR air quality response.
          </p>
        </div>

        {data?.scientific_status && (
          <div className="text-xs px-3 py-1 rounded-lg bg-background border border-panelBorder text-gray-500 dark:text-gray-400 flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
            <span>{data.scientific_status}</span>
          </div>
        )}
      </div>

      {/* Controls: Slider + Presets */}
      <div className="bg-background/80 rounded-xl p-5 border border-panelBorder mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Stubble Burning Reduction
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-extrabold text-foreground">{reductionPct}%</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                reduction ({emissionsPct}% remaining emissions)
              </span>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Baseline (0%)', val: 0.0 },
              { label: 'Moderate (30%)', val: 0.3 },
              { label: 'Aggressive (60%)', val: 0.6 },
              { label: 'Max (100%)', val: 1.0 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => setReduction(preset.val)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                  Math.abs(reduction - preset.val) < 0.01
                    ? 'bg-teal-600 text-white border-teal-500 shadow-sm'
                    : 'bg-panel border-panelBorder text-foreground hover:border-teal-500/40'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Range Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={reductionPct}
            onChange={e => setReduction(Number(e.target.value) / 100)}
            className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
          <div className="flex justify-between text-[11px] text-gray-400 font-mono">
            <span>0% (Full Burn)</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100% (Zero Fire)</span>
          </div>
        </div>
      </div>

      {/* Results Comparison Grid */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-6">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* PM2.5 Card */}
          <div className="bg-background rounded-xl border border-panelBorder p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                PM2.5 Concentration
              </span>
              <div className="flex items-center gap-3 mt-2">
                <div className="text-2xl font-bold text-gray-400 line-through">
                  {data.baseline_pm25.toFixed(1)}
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div className="text-3xl font-extrabold text-foreground">
                  {data.scenario_pm25.toFixed(1)}
                </div>
                <span className="text-xs text-gray-500">µg/m³</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-panelBorder flex items-center justify-between">
              <span className="text-xs text-gray-500">Change vs Baseline</span>
              <span
                className={`text-sm font-bold flex items-center gap-1 ${
                  data.pm25_change < 0 ? 'text-teal-500' : 'text-gray-400'
                }`}
              >
                {data.pm25_change < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                {data.pm25_change.toFixed(1)} µg/m³
              </span>
            </div>
          </div>

          {/* AQI Card */}
          <div className="bg-background rounded-xl border border-panelBorder p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Predicted AQI
              </span>
              <div className="flex items-center gap-3 mt-2">
                <div className="text-2xl font-bold text-gray-400 line-through">
                  {data.baseline_aqi}
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div
                  className={`text-3xl font-extrabold ${
                    data.scenario_aqi <= 100
                      ? 'text-green-500'
                      : data.scenario_aqi <= 200
                      ? 'text-yellow-500'
                      : data.scenario_aqi <= 300
                      ? 'text-orange-500'
                      : 'text-red-500'
                  }`}
                >
                  {data.scenario_aqi}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-panelBorder flex items-center justify-between">
              <span className="text-xs text-gray-500">AQI Reduction</span>
              <span
                className={`text-sm font-bold flex items-center gap-1 ${
                  data.aqi_change < 0 ? 'text-teal-500' : 'text-gray-400'
                }`}
              >
                {data.aqi_change < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                {data.aqi_change} pts
              </span>
            </div>
          </div>

          {/* Dominant Pollutant & Policy Takeaway */}
          <div className="bg-background rounded-xl border border-panelBorder p-5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Dominant Driver & Sub-Indices
              </span>
              <div className="mt-2 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  {data.scenario_dominant_pollutant}
                </span>
                <span className="text-xs text-gray-500">governs primary air quality</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-panelBorder grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-gray-400 text-[10px]">PM2.5 Sub</div>
                <div className="font-bold text-foreground">
                  {data.scenario_aqi_sub_indices?.pm25?.toFixed(0) ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-[10px]">PM10 Sub</div>
                <div className="font-bold text-foreground">
                  {data.scenario_aqi_sub_indices?.pm10?.toFixed(0) ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-[10px]">O3 Sub</div>
                <div className="font-bold text-foreground">
                  {data.scenario_aqi_sub_indices?.o3?.toFixed(0) ?? '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note & Physics Transparency */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span>{data?.note}</span>
        {loading && (
          <span className="flex items-center gap-1 text-teal-500">
            <RefreshCw className="w-3 h-3 animate-spin" /> Recalculating...
          </span>
        )}
      </div>
    </div>
  );
}
