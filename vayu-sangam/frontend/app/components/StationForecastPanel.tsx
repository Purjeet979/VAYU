
import React, { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';
import { Activity } from 'lucide-react';

type StationForecastPoint = {
  hour: number;
  aqi: number;
  pm25: number;
};

type StationForecast = {
  station_id: string;
  station_name: string;
  forecast?: StationForecastPoint[];
};

export default function StationForecastPanel({ hour }: { hour: number }) {
  const [stations, setStations] = useState<StationForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<string>('');

  useEffect(() => {
    fetchJson<StationForecast[]>('/api/forecast/stations').then(data => {
      if (data && data.length > 0) {
        setStations(data);
        setSelectedStation(data[0].station_id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stationData = stations.find(s => s.station_id === selectedStation);
  const currentForecast = stationData?.forecast?.find((f) => f.hour === hour);

  return (
    <div className="bg-[#131821] rounded-2xl border border-gray-800 p-6 shadow-xl relative mt-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-teal-400" /> Station-Level Forecast
      </h2>
      <p className="text-xs text-gray-500 mb-4">(Spatial interpolation of existing grid, not a new prediction)</p>
      
      {loading ? (
        <div className="animate-pulse h-16 bg-gray-800 rounded"></div>
      ) : stations.length > 0 ? (
        <div className="flex flex-col gap-4">
          <select 
            className="w-full bg-gray-900 border border-gray-700 text-white rounded p-2 text-sm"
            value={selectedStation}
            onChange={e => setSelectedStation(e.target.value)}
          >
            {stations.map(s => (
              <option key={s.station_id} value={s.station_id}>{s.station_name}</option>
            ))}
          </select>
          {currentForecast && (
            <div className="grid grid-cols-2 gap-4 text-center mt-2">
              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                <div className="text-gray-400 text-xs uppercase tracking-wide">AQI (T+{hour})</div>
                <div className="text-2xl font-bold text-white">{currentForecast.aqi}</div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                <div className="text-gray-400 text-xs uppercase tracking-wide">PM2.5 (T+{hour})</div>
                <div className="text-2xl font-bold text-white">{currentForecast.pm25.toFixed(1)}</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-500 text-sm">Station forecast not available yet.</div>
      )}
    </div>
  );
}
