"use client";

import { useEffect, useMemo, useState } from 'react';
import { Layers, Flame, CloudFog, Wind, AlertTriangle, Activity } from 'lucide-react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';

import LocationSearch from './LocationSearch';
import StationRankingTable from './StationRankingTable';
import KpiCards from './KpiCards';
import { fetchJson } from '../lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DELHI_CENTER: [number, number] = [28.6139, 77.209];
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAX_HEAT_CIRCLES = 220;

function colorForPm25(value: number) {
  if (value > 300) return '#9333ea';
  if (value > 150) return '#ef4444';
  if (value > 60) return '#eab308';
  return '#14b8a6';
}

function MapController({
  sources,
  searchedLocation,
}: {
  sources: any[];
  searchedLocation: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);

  useEffect(() => {
    if (searchedLocation) {
      map.flyTo(searchedLocation, 11, { duration: 1.2 });
      return;
    }

    if (sources.length > 0) {
      const points: [number, number][] = [
        DELHI_CENTER,
        ...sources.map(source => [source.centroid.lat, source.centroid.lon] as [number, number]),
      ];
      map.fitBounds(points, { padding: [80, 80], maxZoom: 8 });
    }
  }, [map, searchedLocation, sources]);

  return null;
}

export default function LiveMap() {
  const { theme } = useTheme();
  const [sources, setSources] = useState<any[]>([]);
  const [grid, setGrid] = useState<any>(null);
  const [forecast, setForecast] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState<[number, number] | null>(null);
  const [layers, setLayers] = useState({
    heatmap: true,
    fires: true,
    hcho: true,
  });

  useEffect(() => {
    Promise.all([
      fetchJson<any>('/api/map-data?hour=24&variable=pm25'),
      fetchJson<any>('/api/dashboard-summary?hours=72&hour=24')
    ])
      .then(([mapData, summaryData]) => {
        if (mapData?.sources?.sources) setSources(mapData.sources.sources);
        if (mapData?.grid?.values) setGrid(mapData.grid);
        if (summaryData?.forecast?.forecast) setForecast(summaryData.forecast.forecast);
        
        if (!mapData?.sources?.sources && !mapData?.grid?.values) {
          setDataError('Map data could not be loaded. Check that the backend API is running.');
        }
      })
      .catch(() => setDataError('Map data could not be loaded. Check that the backend API is running.'))
      .finally(() => setLoading(false));
  }, []);

  const gridCells = useMemo(() => {
    if (!grid?.lat || !grid?.lon || !grid?.values) return [];

    const latStep = grid.lat.length > 1 ? Math.abs(grid.lat[1] - grid.lat[0]) : 0.1;
    const lonStep = grid.lon.length > 1 ? Math.abs(grid.lon[1] - grid.lon[0]) : 0.1;
    const cells = [];

    for (let i = 0; i < grid.lat.length; i++) {
      for (let j = 0; j < grid.lon.length; j++) {
        const value = grid.values[i]?.[j];
        if (typeof value !== 'number' || value < 10) continue;
        cells.push({
          id: `${i}-${j}`,
          value,
          center: [grid.lat[i], grid.lon[j]] as [number, number],
          radiusMeters: Math.max(latStep, lonStep) * 111000 * 0.72,
        });
      }
    }

    return cells
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_HEAT_CIRCLES);
  }, [grid]);

  const gridAverage = useMemo(() => {
    if (!grid?.values) return null;
    const values = grid.values.flat().filter((value: unknown): value is number => typeof value === 'number');
    if (values.length === 0) return null;
    return values.reduce((sum: number, value: number) => sum + value, 0) / values.length;
  }, [grid]);

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-65px)] bg-background p-4 gap-4">
      
      {/* Top Bar: Search + KPIs */}
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center w-full z-[400]">
        <div className="w-full xl:w-[320px] flex-shrink-0">
          <LocationSearch onLocationFound={(lat, lon) => setSearchedLocation([lat, lon])} />
        </div>
        <div className="flex-1 w-full">
          {!loading && <KpiCards forecast={forecast} />}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[500px]">
        
        {/* Left Sidebar: Station Rankings */}
        <div className="w-full lg:w-[340px] flex flex-col gap-4 flex-shrink-0">
          <div className="bg-panel border border-panelBorder rounded-2xl shadow-lg p-4 flex-1 flex flex-col min-h-[350px] max-h-[600px]">
            <div className="flex items-center gap-2 font-bold mb-4 text-foreground shrink-0">
              <Activity className="w-5 h-5 text-cyan" /> Ground Station Live Rankings
            </div>
            <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
              <StationRankingTable isEmbedded={true} />
            </div>
          </div>
        </div>

        {/* Center Map */}
        <div className="flex-1 relative rounded-2xl overflow-hidden border border-panelBorder shadow-lg min-h-[400px] z-10 bg-[#cbd5e1] dark:bg-[#1a1a1a]">
          <MapContainer
            center={DELHI_CENTER}
            zoom={7}
            minZoom={5}
            maxZoom={13}
            scrollWheelZoom
            zoomControl={true}
            className="absolute inset-0 h-full w-full z-0"
          >
            <MapController sources={sources} searchedLocation={searchedLocation} />
            <TileLayer
              url={TILE_URL}
              attribution='&copy; OpenStreetMap contributors'
              className={theme === 'dark' ? 'map-tiles-dark' : ''}
              eventHandlers={{ tileerror: () => setTileError(true) }}
            />

            {layers.heatmap && gridCells.map(cell => (
              <Circle
                key={cell.id}
                center={cell.center}
                radius={cell.radiusMeters}
                pathOptions={{
                  color: colorForPm25(cell.value),
                  fillColor: colorForPm25(cell.value),
                  fillOpacity: 0.22,
                  opacity: 0,
                  weight: 0,
                }}
              >
                <Popup>PM2.5: {cell.value.toFixed(1)} µg/m³</Popup>
              </Circle>
            ))}

            {layers.fires && sources.map(source => (
              <CircleMarker
                key={`fire-${source.cluster_id}`}
                center={[source.centroid.lat, source.centroid.lon]}
                radius={Math.min(18, 8 + source.fire_count * 2)}
                pathOptions={{
                  color: '#fee2e2',
                  fillColor: '#ef4444',
                  fillOpacity: 0.9,
                  opacity: 0.95,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>Fire Source #{source.cluster_id}</strong>
                    <br />
                    Fires: {source.fire_count}
                    <br />
                    FRP: {source.frp_sum?.toFixed(1) ?? '-'}
                    <br />
                    Score: {source.source_score?.toFixed(2) ?? '-'}
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {layers.hcho && sources.filter(source => source.hcho_anomaly > 0).map(source => (
              <CircleMarker
                key={`hcho-${source.cluster_id}`}
                center={[source.centroid.lat - 0.04, source.centroid.lon + 0.04]}
                radius={10}
                pathOptions={{
                  color: '#fdf4ff',
                  fillColor: '#d946ef',
                  fillOpacity: 0.72,
                  opacity: 0.9,
                  weight: 1,
                }}
              >
                <Popup>HCHO anomaly: {source.hcho_anomaly?.toFixed(2) ?? '-'}</Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {(dataError || tileError) && (
            <div className="absolute left-1/2 top-4 z-[450] -translate-x-1/2 rounded-lg border border-brandOrange/20 bg-panel/95 p-4 text-sm text-brandOrange shadow-lg backdrop-blur-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brandOrange" />
                <p>{dataError ?? 'Basemap tiles are slow or unavailable. Data overlays are still active.'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Layers & Scenarios */}
        <div className="w-full lg:w-[280px] flex flex-col gap-4 flex-shrink-0">
          <div className="bg-panel border border-panelBorder rounded-2xl p-4 shadow-lg flex-1">
            <div className="flex items-center gap-2 font-bold mb-4 text-foreground">
              <Layers className="w-5 h-5 text-cyan" /> Map Layers
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer hover:text-cyan transition-colors text-foreground">
                <input type="checkbox" checked={layers.heatmap} onChange={() => setLayers(prev => ({ ...prev, heatmap: !prev.heatmap }))} className="rounded bg-gray-200 dark:bg-gray-800 border-panelBorder text-cyan cursor-pointer" />
                <span className="text-sm flex items-center gap-2">
                  <CloudFog className="w-4 h-4 text-purple-500" /> PM2.5 Grid
                </span>
              </label>

              <label className="flex items-center justify-between cursor-pointer hover:text-cyan transition-colors text-foreground">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={layers.fires} onChange={() => setLayers(prev => ({ ...prev, fires: !prev.fires }))} className="rounded bg-gray-200 dark:bg-gray-800 border-panelBorder text-cyan cursor-pointer" />
                  <span className="text-sm flex items-center gap-2">
                    <Flame className="w-4 h-4 text-brandRed" /> Active Fires
                  </span>
                </div>
                <span className="text-xs text-gray-400">{sources.length}</span>
              </label>

              <label className="flex items-center justify-between cursor-pointer hover:text-cyan transition-colors text-foreground">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={layers.hcho} onChange={() => setLayers(prev => ({ ...prev, hcho: !prev.hcho }))} className="rounded bg-gray-200 dark:bg-gray-800 border-panelBorder text-cyan cursor-pointer" />
                  <span className="text-sm flex items-center gap-2">
                    <Wind className="w-4 h-4 text-fuchsia-500" /> HCHO Hotspots
                  </span>
                </div>
              </label>
            </div>
            
            {/* Layer Status Inline */}
            {!loading && !dataError && (
              <div className="mt-6 pt-4 border-t border-panelBorder">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Layer Status</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">PM2.5 cells</p>
                    <p className="font-bold text-cyan">{gridCells.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Avg PM2.5</p>
                    <p className="font-bold text-brandOrange">{gridAverage == null ? '-' : `${gridAverage.toFixed(1)} µg/m³`}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-panelBorder border-t-cyan rounded-full animate-spin mb-4" />
          <p className="text-foreground font-medium">Syncing live data layers...</p>
        </div>
      )}
    </div>
  );
}
