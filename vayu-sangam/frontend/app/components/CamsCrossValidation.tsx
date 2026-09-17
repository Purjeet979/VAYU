"use client";

import { useEffect, useState } from 'react';
import { Globe, GitMerge, Clock } from 'lucide-react';
import { fetchJson } from '../lib/api';

type CamsComparison = {
  xgboost_local_forecast: number | null;
  cams_downscaled: number;
  agreement_pct: number;
  note: string;
  bias_correction: string;
  reason: string;
};

export default function CamsCrossValidation({ hour }: { hour: number }) {
  const [data, setData] = useState<CamsComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchJson<CamsComparison>(`/api/cams-comparison?district=Delhi&hour=${hour}`, { timeoutMs: 5000 })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        // silently fail or log
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hour]);

  if (loading) {
    return (
      <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl animate-pulse">
        <div className="h-6 w-48 bg-gray-700/50 rounded mb-4"></div>
        <div className="h-20 w-full bg-gray-700/30 rounded"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4"><Globe className="w-32 h-32 text-indigo-500/5" /></div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Globe className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            CAMS Global Cross-Validation
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Comparing local surrogate (XGBoost) vs CAMS Copernicus global forecast.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
          <GitMerge className="w-3.5 h-3.5" />
          Cross-Check
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-background border border-panelBorder p-4 rounded-xl text-center relative overflow-hidden">
          <p className="text-sm text-gray-500 mb-1">Local Surrogate (Primary)</p>
          {data.xgboost_local_forecast !== null ? (
            <p className="text-2xl font-bold text-red-500">{data.xgboost_local_forecast} <span className="text-sm font-normal text-gray-400">µg/m³</span></p>
          ) : (
            <div className="flex flex-col items-center justify-center mt-1">
              <span className="text-sm font-bold text-gray-500">N/A</span>
              <span className="text-[10px] text-red-400 mt-1">Data pipeline recovering</span>
            </div>
          )}
        </div>
        <div className="bg-background border border-panelBorder p-4 rounded-xl text-center relative overflow-hidden">
          <p className="text-sm text-gray-500 mb-1">CAMS (Raw Baseline)</p>
          <p className="text-2xl font-bold text-indigo-500">{data.cams_downscaled} <span className="text-sm font-normal text-gray-400">µg/m³</span></p>
          {data.bias_correction === "not_yet_available" && (
            <div className="absolute bottom-0 left-0 right-0 bg-yellow-500/20 text-[10px] text-yellow-600 dark:text-yellow-400 py-0.5 px-2 flex justify-center items-center gap-1 font-semibold border-t border-yellow-500/20">
              <Clock className="w-3 h-3" /> Waiting for history to train downscaling
            </div>
          )}
        </div>
        <div className="bg-background border border-panelBorder p-4 rounded-xl text-center">
          <p className="text-sm text-gray-500 mb-1">Agreement</p>
          {data.xgboost_local_forecast !== null ? (
            <p className="text-2xl font-bold text-green-500">{data.agreement_pct}%</p>
          ) : (
            <p className="text-lg font-bold text-gray-500 mt-1">N/A</p>
          )}
        </div>
      </div>
      
      <p className="text-sm text-gray-500 dark:text-gray-400 border-l-2 border-indigo-500 pl-4 italic">
        {data.xgboost_local_forecast !== null ? data.note : "Comparison unavailable; only raw CAMS baseline shown until local live-data pipeline recovers."}
      </p>
    </div>
  );
}
