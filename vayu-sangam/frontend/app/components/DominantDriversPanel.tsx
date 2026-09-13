
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
    <div className="bg-[#131821] rounded-2xl border border-gray-800 p-6 shadow-xl relative overflow-hidden">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-yellow-400" /> Rule-based Key Contributing Factors
      </h2>
      <div className="text-xs text-gray-500 flex items-center gap-1 mb-4">
        <Info className="w-4 h-4" /> (Heuristic based, not ML/SHAP)
      </div>
      
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-800 rounded w-3/4"></div>
          <div className="h-4 bg-gray-800 rounded w-1/2"></div>
        </div>
      ) : drivers.length > 0 ? (
        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-300">
          {drivers.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      ) : (
        <div className="text-gray-500 text-sm italic">No severe dominant drivers identified for this hour.</div>
      )}
    </div>
  );
}
