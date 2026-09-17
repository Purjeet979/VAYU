"use client";

import { useEffect, useState } from 'react';
import { Wind } from 'lucide-react';

import { fetchJson } from '../lib/api';

type CpcbResponse = { Data?: Array<{ aqi?: number }> } | Array<{ aqi?: number }>;

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
    fetchJson<CpcbResponse>('/api/cpcb/latest', { timeoutMs: 2500 })
      .then(data => {
        const rows: Array<{ aqi?: number }> = Array.isArray(data) ? data : (data?.Data ?? []);
        const values = rows.map(row => row.aqi).filter((aqi): aqi is number => typeof aqi === 'number');
        if (values.length === 0) {
          setCurrentAQI(null);
          return;
        }
        setCurrentAQI(Math.round(values.reduce((sum, aqi) => sum + aqi, 0) / values.length));
      })
      .catch(() => setCurrentAQI(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="w-full max-w-md mx-auto px-6 mb-24">
      <div className="rounded-2xl border p-6 flex items-center justify-between shadow-xl" style={{ backgroundColor: 'var(--panel)', borderColor: 'var(--panel-border)' }}>
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Current Delhi NCR AQI</p>
          {loading ? (
            <div className="h-10 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--btn-bg)' }} />
          ) : (
            <h2 className={`text-4xl font-bold ${currentAQI ? aqiColor(currentAQI) : ''}`} style={!currentAQI ? { color: 'var(--text-muted)' } : {}}>
              {currentAQI ?? '-'}
            </h2>
          )}
        </div>
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--icon-bg)' }}>
          <Wind className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </section>
  );
}
