"use client";

import React, { useState, useEffect } from 'react';
import { Activity, Wind, AlertTriangle, Layers, Play, Pause } from 'lucide-react';

import TopNav from './components/TopNav';
import KPICard from './components/KPICard';
import DashboardMap from './components/DashboardMap';
import ScenarioSidebar from './components/ScenarioSidebar';

const API = 'http://localhost:8000';

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [currentHour, setCurrentHour] = useState(24);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stubbleReduction, setStubbleReduction] = useState(0.0);

  const [scenarioData, setScenarioData] = useState<any>(null);
  const [inversionData, setInversionData] = useState<any>(null);
  const [sourcesData, setSourcesData] = useState<any>(null);
  const [gridData, setGridData] = useState<any>(null);
  const [explanationData, setExplanationData] = useState<any>(null);

  // Playback effect
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentHour(prev => (prev >= 72 ? 0 : prev + 1));
    }, 1000); // 1 second per hour
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Fetch Forecast Grid Data
  useEffect(() => {
    fetch(`${API}/api/forecast/grid?hour=${currentHour}&variable=pm25`)
      .then(r => r.json()).then(setGridData)
      .catch(() => setGridData(null));
  }, [currentHour]);

  // Fetch Scenario
  useEffect(() => {
    fetch(`${API}/api/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stubble_reduction: stubbleReduction, hour: currentHour }),
    })
      .then(r => r.json()).then(setScenarioData)
      .catch(() => setScenarioData(null));
  }, [stubbleReduction, currentHour]);

  // Fetch Inversion
  useEffect(() => {
    fetch(`${API}/api/inversion?hour=${currentHour}`)
      .then(r => r.json()).then(setInversionData)
      .catch(() => setInversionData(null));
  }, [currentHour]);

  // Fetch Sources (Fires)
  useEffect(() => {
    fetch(`${API}/api/sources?hour=${currentHour}`)
      .then(r => r.json()).then(setSourcesData)
      .catch(() => setSourcesData(null));
  }, [currentHour]);

  // Fetch Explanation
  useEffect(() => {
    fetch(`${API}/api/explanation?hour=${currentHour}`)
      .then(r => r.json()).then(setExplanationData)
      .catch(() => setExplanationData(null));
  }, [currentHour]);

  const aqiColor = (aqi: number) => {
    if (!aqi) return 'text-gray-400';
    if (aqi <= 50)  return 'text-green-500';
    if (aqi <= 100) return 'text-lime-500';
    if (aqi <= 200) return 'text-yellow-500';
    if (aqi <= 300) return 'text-orange-500';
    if (aqi <= 400) return 'text-red-500';
    return 'text-purple-500';
  };

  const aqiLabel = (aqi: number) => {
    if (!aqi) return '—';
    if (aqi <= 50)  return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 200) return 'Moderate';
    if (aqi <= 300) return 'Poor';
    if (aqi <= 400) return 'Very Poor';
    return 'Severe';
  };

  const pblHeight = inversionData?.pbl_height_m ?? inversionData?.pblh ?? null;
  const inversionCategory = inversionData?.category ?? inversionData?.trapping_category ?? '—';
  const clusters = sourcesData?.sources ?? null;
  const isDark = theme === 'dark';

  return (
    <div className={`flex flex-col h-screen font-sans overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#0b0e14] text-white' : 'bg-gray-50 text-slate-900'
    }`}>
      <TopNav theme={theme} toggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />

      <div className="flex flex-1 overflow-hidden">
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col p-5 gap-5 overflow-hidden">
          
          <div className="grid grid-cols-4 gap-4 shrink-0">
            <KPICard
              theme={theme}
              title="AQI (Overall)"
              value={scenarioData ? scenarioData.scenario_aqi : '—'}
              subtitle={scenarioData ? aqiLabel(scenarioData.scenario_aqi) : 'Connecting…'}
              icon={<Activity className="w-4 h-4 text-red-500" />}
              colorClass={aqiColor(scenarioData?.scenario_aqi)}
              bgGradient={theme === 'dark' ? 'bg-gradient-to-br from-[#181c25] to-[#25181a]' : 'bg-gradient-to-br from-white to-red-50'}
            />
            <KPICard
              theme={theme}
              title="PM2.5"
              value={scenarioData ? scenarioData.scenario_pm25.toFixed(1) : '—'}
              unit="µg/m³"
              subtitle={scenarioData ? `Daily avg: ${scenarioData.baseline_pm25.toFixed(0)} µg/m³` : 'Connecting…'}
              icon={<Wind className="w-4 h-4 text-orange-500" />}
              colorClass="text-orange-500"
            />
            <KPICard
              theme={theme}
              title="O3 (Ozone)"
              value={scenarioData ? scenarioData.scenario_o3.toFixed(1) : '—'}
              unit="µg/m³"
              subtitle={scenarioData ? `Sub-index: ${scenarioData.scenario_aqi_sub_indices?.o3?.toFixed(0) ?? '—'}` : 'Connecting…'}
              icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
              colorClass="text-yellow-500"
            />
            <KPICard
              theme={theme}
              title="Inversion Layer"
              value={pblHeight !== null ? pblHeight.toFixed(0) : '—'}
              unit="m"
              subtitle={inversionData ? `${inversionCategory} · ${inversionData.wind_speed_mps?.toFixed(1) ?? '—'} m/s` : 'Connecting…'}
              icon={<Layers className="w-4 h-4 text-blue-500" />}
              colorClass="text-blue-500"
              bgGradient={theme === 'dark' ? 'bg-gradient-to-br from-[#181c25] to-[#181e2b]' : 'bg-gradient-to-br from-white to-blue-50'}
            />
          </div>

          {/* Map Area */}
          <div className="flex-1 flex flex-col min-h-0">
            <DashboardMap theme={theme} fireClusters={clusters ?? []} grid={gridData} hour={currentHour} />
          </div>

          {/* Timeline Controls */}
          <div className={`shrink-0 rounded-xl border p-4 flex items-center gap-4 transition-colors ${
            isDark ? 'bg-[#181c25] border-[#2a3140]' : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isDark 
                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              }`}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
            </button>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Now (0h)</span>
                <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>Forecast +{currentHour}h</span>
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>+72h</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="72" 
                value={currentHour}
                onChange={(e) => {
                  setCurrentHour(parseInt(e.target.value, 10));
                  setIsPlaying(false);
                }}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                  isDark ? 'bg-gray-700 accent-blue-500' : 'bg-gray-200 accent-blue-600'
                }`}
              />
            </div>
          </div>

        </div>

        {/* Right Sidebar */}
        <ScenarioSidebar
          theme={theme}
          stubbleReduction={stubbleReduction}
          setStubbleReduction={setStubbleReduction}
          clusters={clusters}
          deltaAQI={scenarioData?.aqi_change ?? 0}
          deltaPM25={scenarioData?.pm25_change ?? 0}
          baselineAQI={scenarioData?.baseline_aqi ?? 0}
          scenarioAQI={scenarioData?.scenario_aqi ?? 0}
          dominantPollutant={scenarioData?.scenario_dominant_pollutant ?? '—'}
          explanation={explanationData}
        />
      </div>
    </div>
  );
}
