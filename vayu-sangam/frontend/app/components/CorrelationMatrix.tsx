"use client";

import { useMemo } from 'react';
import { Network } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

function pearsonCorrelation(x: number[], y: number[]) {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (den === 0) return 0;
  return num / den;
}

export default function CorrelationMatrix({ forecast }: { forecast: any[] }) {
  const { parameters, matrix } = useMemo(() => {
    if (!forecast || forecast.length === 0) return { parameters: [], matrix: [] };

    const params = [
      { key: 'temperature_c', label: 'Temp' },
      { key: 'wind_speed_mps', label: 'Wind' },
      { key: 'pm25_ug_m3', label: 'PM2.5' },
      { key: 'pm10_ug_m3', label: 'PM10' },
      { key: 'aqi', label: 'AQI' },
    ];

    const mat = params.map(p1 => 
      params.map(p2 => {
        const x: number[] = [];
        const y: number[] = [];
        forecast.forEach(f => {
          if (f[p1.key] != null && f[p2.key] != null) {
            x.push(f[p1.key]);
            y.push(f[p2.key]);
          }
        });
        return x.length > 1 ? pearsonCorrelation(x, y) : 0;
      })
    );

    return { parameters: params, matrix: mat };
  }, [forecast]);

  const getColor = (val: number) => {
    // Viridis-style diverging scale: -1 (purple/blue) to +1 (yellow/green)
    if (val > 0.8) return 'bg-[#fde725] text-black';
    if (val > 0.5) return 'bg-[#5ec962] text-black';
    if (val > 0.2) return 'bg-[#21918c] text-white';
    if (val > -0.2) return 'bg-[#3b528b] text-white';
    if (val > -0.5) return 'bg-[#440154] text-white';
    return 'bg-[#440154] text-white'; // Deep purple for negative correlation
  };

  if (!matrix.length) {
    return (
      <div className="h-64 bg-panel rounded-2xl border border-panelBorder mt-6 p-6 flex flex-col justify-center">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-foreground">
          <Network className="w-5 h-5 text-teal-500 dark:text-teal-400" /> Parameter Correlation
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Forecast data is unavailable, so correlations cannot be calculated.</p>
      </div>
    );
  }

  return (
    <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-lg">
      <h3 className="text-lg font-semibold mb-1 flex items-center gap-2 text-foreground">
        <Network className="w-5 h-5 text-teal-500 dark:text-teal-400" /> Parameter Correlation
      </h3>
      
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Header */}
          <div className="flex mb-1">
            <div className="w-16"></div>
            {parameters.map((p, i) => (
              <div key={i} className="w-12 text-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                {p.label}
              </div>
            ))}
          </div>

          {/* Rows */}
          {parameters.map((p1, i) => (
            <div key={i} className="flex items-center mb-1">
              <div className="w-16 text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider text-right pr-3">
                {p1.label}
              </div>
              {parameters.map((p2, j) => {
                const val = matrix[i][j];
                return (
                  <div key={j} className="w-12 p-0.5">
                    <div className={`w-full h-8 rounded flex items-center justify-center text-[10px] font-mono font-medium ${getColor(val)}`}>
                      {typeof val === 'number' ? val.toFixed(2) : '-'}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
