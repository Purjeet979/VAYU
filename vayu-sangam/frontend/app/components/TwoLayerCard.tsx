import React, { useState } from 'react';
import { Info } from 'lucide-react';

type TwoLayerCardProps = {
  icon: React.ReactNode;
  title: string;
  laymanMessage: string | React.ReactNode;
  technicalDetails: React.ReactNode;
  bgColor?: string;
  borderColor?: string;
};

export default function TwoLayerCard({
  icon,
  title,
  laymanMessage,
  technicalDetails,
  bgColor = 'bg-panel',
  borderColor = 'border-panelBorder'
}: TwoLayerCardProps) {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <div className={`${bgColor} rounded-2xl border ${borderColor} p-6 shadow-xl relative overflow-hidden transition-all duration-300`}>
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
          {icon} {title}
        </h2>
        <button 
          onClick={() => setShowTechnical(!showTechnical)}
          className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${showTechnical ? 'bg-gray-200 dark:bg-gray-800 text-teal-600 dark:text-teal-400' : 'text-gray-500'}`}
          title="Toggle Expert Details"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Layer 1: Layman Default */}
      <div className={`${showTechnical ? 'hidden' : 'block'} animate-in fade-in duration-300`}>
        <div className="text-xl font-bold text-gray-800 dark:text-gray-200 mt-2">
          {laymanMessage}
        </div>
      </div>

      {/* Layer 2: Technical On-Demand */}
      <div className={`${showTechnical ? 'block' : 'hidden'} animate-in slide-in-from-top-2 duration-300`}>
        <div className="text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 pt-4 mt-2">
          {technicalDetails}
        </div>
      </div>
    </div>
  );
}
