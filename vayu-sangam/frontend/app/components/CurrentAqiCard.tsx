"use client";

import { useEffect, useState } from 'react';
import { Wind } from 'lucide-react';

import { fetchJson } from '../lib/api';

function aqiColor(aqi: number) {
  if (aqi <= 50) return 'text-green-400';
  if (aqi <= 100) return 'text-lime-400';
  if (aqi <= 200) return 'text-yellow-400';
  if (aqi <= 300) return 'text-orange-400';
  if (aqi <= 400) return 'text-red-400';
  return 'text-purple-400';
}

export default function CurrentAqiCard() {
  const [currentAQI, setCurrentAQI] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<{ forecast?: Array<{ aqi?: number }> }>('/api/forecast?hours=1')
      .then(data => setCurrentAQI(data.forecast?.[0]?.aqi ?? null))
      .catch(() => setCurrentAQI(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="w-full max-w-md mx-auto px-6 mb-24">
      <div className="bg-[#131821] rounded-2xl border border-gray-800 p-6 flex items-center justify-between shadow-xl">
        <div>
          <p className="text-sm text-gray-400 font-medium mb-1">Current Delhi NCR AQI</p>
          {loading ? (
            <div className="h-10 w-24 bg-gray-800 rounded animate-pulse" />
          ) : (
            <h2 className={`text-4xl font-bold ${currentAQI ? aqiColor(currentAQI) : 'text-gray-500'}`}>
              {currentAQI ?? '-'}
            </h2>
          )}
        </div>
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
          <Wind className="w-6 h-6 text-gray-400" />
        </div>
      </div>
    </section>
  );
}
