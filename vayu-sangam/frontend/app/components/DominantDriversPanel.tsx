
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
          {drivers.map((d, i) => {
            const isFire = d.toLowerCase().includes('fire') || d.toLowerCase().includes('biomass');
            const isWeather = d.toLowerCase().includes('trapping') || d.toLowerCase().includes('wind') || d.toLowerCase().includes('pblh');
            const isPollution = d.toLowerCase().includes('pm2.5') || d.toLowerCase().includes('aqi');
            
            let icon = <Info className="w-5 h-5 text-gray-500" />;
            let bgClass = "bg-gray-500/10";
            let colorClass = "text-gray-500";
            
            if (isFire) {
              icon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;
              bgClass = "bg-orange-500/10 border-orange-500/20";
              colorClass = "text-orange-500";
            } else if (isWeather) {
              icon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>;
              bgClass = "bg-blue-500/10 border-blue-500/20";
              colorClass = "text-blue-500";
            } else if (isPollution) {
              icon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>;
              bgClass = "bg-purple-500/10 border-purple-500/20";
              colorClass = "text-purple-500";
            }

            const parts = d.split(':');
            const title = parts[0];
            const desc = parts.length > 1 ? parts.slice(1).join(':').trim() : '';

            return (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-xl bg-background border shadow-sm transition-all hover:scale-[1.02] ${bgClass}`}>
                <div className={`mt-0.5 p-1.5 rounded-lg bg-background shadow-sm border ${bgClass.split(' ')[1]}`}>
                  {icon}
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${colorClass}`}>{title}</span>
                  {desc && <span className="text-xs text-gray-600 dark:text-gray-300 mt-1 font-medium leading-relaxed">{desc}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center p-6 bg-background rounded-xl border border-dashed border-panelBorder">
          <div className="text-gray-500 dark:text-gray-400 text-sm italic font-medium">No severe dominant drivers identified for this hour.</div>
        </div>
      )}
    </div>
  );
}
