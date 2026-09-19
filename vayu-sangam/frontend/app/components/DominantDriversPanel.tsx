
import React, { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';
import { Lightbulb, Info } from 'lucide-react';

type ExplainResponse = {
  dominant_drivers?: string[];
};

export default function DominantDriversPanel({ hour }: { hour: number }) {
  const [drivers, setDrivers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchJson<ExplainResponse>(`/api/explain/${hour}`).then(data => {
      if (data?.dominant_drivers) setDrivers(data.dominant_drivers);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [hour]);

  return (
    <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl relative overflow-hidden flex flex-col justify-center h-full transition-all hover:shadow-2xl">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
        <Lightbulb className="w-6 h-6 text-yellow-400 drop-shadow-md" /> 
        <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">Rule-based Key Contributing Factors</span>
      </h2>
      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-5 font-medium">
        <Info className="w-4 h-4 text-blue-500" /> (Heuristic based, not ML/SHAP)
      </div>
      
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded-md w-3/4"></div>
          <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded-md w-1/2"></div>
        </div>
      ) : drivers.length > 0 ? (
        <div className="space-y-3">
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background border border-panelBorder shadow-sm hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
              <div className="mt-1.5 min-w-[6px] w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:scale-150 transition-transform"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{d}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center p-6 bg-background rounded-xl border border-dashed border-panelBorder">
          <div className="text-gray-500 dark:text-gray-400 text-sm italic font-medium">No severe dominant drivers identified for this hour.</div>
        </div>
      )}
    </div>
  );
}
