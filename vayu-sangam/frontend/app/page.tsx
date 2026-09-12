"use client";

import React, { useState, useEffect } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Wind, Thermometer, Flame, AlertTriangle, Layers, Map as MapIcon, Activity } from 'lucide-react';

export default function Home() {
  const [forecast, setForecast] = useState<any[]>([]);
  const [explainability, setExplainability] = useState<any>(null);
  
  useEffect(() => {
    // Fetch mock data from our FastAPI backend
    fetch('http://localhost:8000/api/forecast/72-hours')
      .then(res => res.json())
      .then(data => setForecast(data.forecast))
      .catch(err => console.error(err));

    fetch('http://localhost:8000/api/explainability')
      .then(res => res.json())
      .then(data => setExplainability(data))
      .catch(err => console.error(err));
  }, []);

  const currentData = forecast.length > 0 ? forecast[0] : null;

  return (
    <div className="flex h-screen bg-[#0b0e14] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-[#151a23] border-r border-gray-800 flex flex-col z-10 shadow-xl">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center gap-2">
            <Wind className="w-6 h-6 text-blue-400" />
            VayuSangam
          </h1>
          <p className="text-xs text-gray-400 mt-1">Physics-Informed AI AQI Dashboard</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Main Stats */}
          {currentData && (
            <div className="bg-[#1e2532] p-4 rounded-xl border border-gray-700/50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <h2 className="text-sm text-gray-400 font-medium mb-1 uppercase tracking-wider">Current AQI</h2>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-black text-red-400">{currentData.aqi}</span>
                <span className="text-red-400 font-semibold mb-1">SEVERE</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-[#151a23] p-2 rounded-lg">
                  <div className="text-xs text-gray-400">PM2.5</div>
                  <div className="font-semibold">{currentData.pm25.toFixed(1)}</div>
                </div>
                <div className="bg-[#151a23] p-2 rounded-lg">
                  <div className="text-xs text-gray-400">PM10</div>
                  <div className="font-semibold">{currentData.pm10.toFixed(1)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Explainability Panel */}
          {explainability && (
            <div className="bg-[#1e2532] p-4 rounded-xl border border-gray-700/50">
              <h2 className="text-sm text-gray-400 font-medium mb-3 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4" /> Primary Drivers
              </h2>
              <div className="space-y-3">
                {explainability.primary_drivers.map((driver: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm bg-[#151a23] p-2 rounded-lg">
                    <span className="text-gray-300">{driver.factor}</span>
                    <span className="text-red-400 font-bold">{driver.impact}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-gray-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                {explainability.summary}
              </div>
            </div>
          )}

          {/* Plume & Inversion Panel */}
          {currentData && (
            <div className="space-y-4">
              <div className="bg-[#1e2532] p-4 rounded-xl border border-gray-700/50">
                <h2 className="text-sm text-gray-400 font-medium mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Atmospheric State
                </h2>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-gray-400">PBL Height</span>
                  <span className="font-mono">{currentData.pbl_height} m</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-gray-400">Inversion Strength</span>
                  <span className={`font-bold ${currentData.inversion_strength === 'SEVERE' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {currentData.inversion_strength}
                  </span>
                </div>
              </div>

              <div className="bg-[#1e2532] p-4 rounded-xl border border-gray-700/50">
                <h2 className="text-sm text-gray-400 font-medium mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" /> Stubble Plume
                </h2>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Plume Influence</span>
                  <span className="font-bold text-orange-400">{currentData.plume_influence ? "HIGH" : "LOW"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <div className="bg-[#151a23]/90 backdrop-blur border border-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
            <MapIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium">Delhi-NCR High-Resolution Domain</span>
          </div>
        </div>

        {/* MapLibre Map */}
        <div className="flex-1 bg-gray-900">
          <Map
            initialViewState={{
              longitude: 77.2090,
              latitude: 28.6139,
              zoom: 8
            }}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          >
            <NavigationControl position="bottom-right" />
          </Map>
        </div>

        {/* 72 Hour Forecast Timeline Slider */}
        <div className="h-32 bg-[#151a23] border-t border-gray-800 p-4">
          <h3 className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">72-Hour Forecast Timeline</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {forecast.map((f, i) => (
              <div key={i} className="min-w-[80px] bg-[#1e2532] rounded-lg p-2 flex flex-col items-center justify-center border border-gray-700/50 hover:border-blue-500 cursor-pointer transition-colors">
                <div className="text-[10px] text-gray-400">+{i}h</div>
                <div className={`text-lg font-bold ${f.aqi > 400 ? 'text-red-500' : f.aqi > 300 ? 'text-red-400' : 'text-orange-400'}`}>
                  {f.aqi}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
