"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../lib/api";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

type GrapResponse = {
  stage: string;
  category: string;
  actions?: string[];
  note?: string;
  disclaimer?: string;
};

export default function GrapBanner() {
  const [grap, setGrap] = useState<GrapResponse | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchJson<GrapResponse>('/api/grap/current')
      .then(data => {
        if (data) {
          setGrap(data);
        }
      })
      .catch(() => {});
  }, []);

  if (!grap) return null;

  const { stage, category, note, actions, disclaimer } = grap;
  const isSevere = stage === 'Stage III' || stage === 'Stage IV';
  const bgColor = stage === 'None' ? 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20' : isSevere ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' : 'bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20';
  const iconColor = stage === 'None' ? 'text-green-500' : isSevere ? 'text-red-500' : 'text-yellow-500';

  return (
    <div 
      className={`mb-6 p-4 rounded-xl shadow-lg border ${bgColor} flex flex-col gap-3 transition-all duration-300 cursor-pointer`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Header section (Always visible) */}
      <div className="flex items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-background/50 rounded-lg shrink-0">
            {stage === 'None' ? (
              <CheckCircle className={`w-5 h-5 ${iconColor}`} />
            ) : (
              <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
            )}
          </div>
          <div>
            <div className="text-base sm:text-lg font-bold text-foreground leading-tight">
              {stage === 'None' ? '✅ Aaj hawa theek hai. Koi pabandi nahi hai.' :
               stage === 'Stage I' || stage === 'Stage II' ? '⚠️ Pradushan badh raha hai. Kripya savdhani bartein.' :
               '🚨 Pradushan bahut kharaab hai! Bahaar jana avoid karein.'}
            </div>
            <div className="text-xs sm:text-sm font-medium mt-0.5 text-gray-700 dark:text-gray-300">
              {stage === 'None' ? 'GRAP inactive' : `Current Status: ${stage} (${category})`}
            </div>
          </div>
        </div>
        <button 
          className="p-1.5 rounded-full hover:bg-background/40 transition-colors shrink-0"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
      </div>

      {/* Expandable section */}
      {isExpanded && (
        <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {note && <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">{note}</div>}
          
          {actions && actions.length > 0 && (
            <div className="bg-background/40 p-3 rounded-lg w-full mb-3">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Mandated Actions:</p>
              <ul className="text-xs space-y-1.5">
                {actions.map((act, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500 mt-[2px] shrink-0">•</span>
                    <span className="text-gray-800 dark:text-gray-200">{act}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {disclaimer && (
            <div className="w-full pt-2 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400 italic">
              {disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
