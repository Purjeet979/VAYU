
import React, { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';
import { AlertTriangle } from 'lucide-react';

type AlertItem = {
  start_time: string;
  end_time: string;
  predicted_aqi_range: string;
  severity_label: string;
};

type AlertsResponse = {
  alerts?: AlertItem[];
};

export default function EarlyWarningBanner() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    fetchJson<AlertsResponse>('/api/alerts').then(data => {
      if (data?.alerts) setAlerts(data.alerts);
    }).catch(() => {});
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="w-full bg-red-900/50 border border-red-500/50 p-4 rounded-xl shadow-lg mb-6 flex flex-col gap-2 animate-pulse">
      <div className="flex items-center gap-2 font-bold text-red-400">
        <AlertTriangle className="w-5 h-5" /> Severe AQI Alerts Detected
      </div>
      {alerts.map((alert, i) => (
        <div key={i} className="text-red-200 text-sm">
          <span className="font-semibold">{new Date(alert.start_time).toLocaleString()} to {new Date(alert.end_time).toLocaleString()}</span>: 
          Predicted AQI {alert.predicted_aqi_range} ({alert.severity_label})
        </div>
      ))}
    </div>
  );
}
