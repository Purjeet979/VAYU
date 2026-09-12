"use client";

import React from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  colorClass: string; // e.g. "text-orange-400"
  bgGradient?: string;
  theme?: 'light' | 'dark';
}

export default function KPICard({ title, value, unit, subtitle, icon, colorClass, bgGradient, theme = 'dark' }: KPICardProps) {
  const isDark = theme === 'dark';

  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 flex flex-col justify-between transition-colors ${
      isDark 
        ? `bg-[#181c25] border-[#2a3140] shadow-lg ${bgGradient || ''}` 
        : 'bg-white border-gray-200 shadow-sm'
    }`}>
      {/* Optional decorative background glow for dark mode */}
      {isDark && bgGradient && (
        <div className="absolute top-0 right-0 w-32 h-32 opacity-20 blur-3xl -mr-10 -mt-10 rounded-full" style={{ background: 'inherit' }}></div>
      )}

      <div className="flex items-center justify-between z-10">
        <h3 className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {icon}
          {title}
        </h3>
      </div>
      
      <div className="mt-2 z-10">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${colorClass}`}>{value}</span>
          {unit && <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{unit}</span>}
        </div>
        {subtitle && (
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
