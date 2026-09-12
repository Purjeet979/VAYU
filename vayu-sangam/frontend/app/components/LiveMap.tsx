"use client";

import { useEffect, useMemo, useState } from 'react';
import { Layers, Flame, CloudFog, Wind, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import LocationSearch from './LocationSearch';
import StationRankingTable from './StationRankingTable';
import { fetchJson } from '../lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DELHI_CENTER: [number, number] = [28.6139, 77.209];
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
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
  const [sources, setSources] = useState<any[]>([]);
  const [grid, setGrid] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState<[number, number] | null>(null);
  const [layers, setLayers] = useState({
    cpcb: false,
    heatmap: true,
    fires: true,
    hcho: true,
  });

  useEffect(() => {
    fetchJson<any>('/api/map-data?hour=24&variable=pm25')
      .then((data) => {
        if (data?.sources?.sources) setSources(data.sources.sources);
        if (data?.grid?.values) setGrid(data.grid);
        if (!data?.sources?.sources && !data?.grid?.values) {
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
    <div className="relative flex flex-1 w-full min-h-[calc(100vh-65px)] overflow-hidden bg-[#070b11]">
      <LocationSearch onLocationFound={(lat, lon) => setSearchedLocation([lat, lon])} />

      <MapContainer
        center={DELHI_CENTER}
        zoom={7}
        minZoom={5}
        maxZoom={13}
        scrollWheelZoom
        zoomControl
        className="absolute inset-0 z-10 h-full w-full"
      >
        <MapController sources={sources} searchedLocation={searchedLocation} />
        <TileLayer
          url={TILE_URL}
          attribution='&copy; OpenStreetMap contributors'
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

      <div className="absolute top-4 right-4 z-[400] w-64 bg-[#131821]/95 backdrop-blur-md border border-gray-800 rounded-xl p-4 shadow-2xl mt-14">
        <div className="flex items-center gap-2 font-bold mb-4 text-gray-100">
          <Layers className="w-5 h-5 text-teal-400" /> Map Layers
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-not-allowed opacity-50 group">
            <div className="flex items-center gap-2">
              <input type="checkbox" disabled checked={layers.cpcb} className="rounded bg-gray-800 border-gray-700 text-teal-500" readOnly />
              <span className="text-sm">CPCB Stations</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">Coming Soon</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:text-teal-400 transition-colors">
            <input type="checkbox" checked={layers.heatmap} onChange={() => setLayers(prev => ({ ...prev, heatmap: !prev.heatmap }))} className="rounded bg-gray-800 border-gray-700 text-teal-500 cursor-pointer" />
            <span className="text-sm flex items-center gap-2">
              <CloudFog className="w-4 h-4 text-purple-400" /> PM2.5 Grid
            </span>
          </label>

          <label className="flex items-center justify-between cursor-pointer hover:text-teal-400 transition-colors">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={layers.fires} onChange={() => setLayers(prev => ({ ...prev, fires: !prev.fires }))} className="rounded bg-gray-800 border-gray-700 text-teal-500 cursor-pointer" />
              <span className="text-sm flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500" /> Active Fires
              </span>
            </div>
            <span className="text-xs text-gray-500">{sources.length}</span>
          </label>

          <label className="flex items-center justify-between cursor-pointer hover:text-teal-400 transition-colors">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={layers.hcho} onChange={() => setLayers(prev => ({ ...prev, hcho: !prev.hcho }))} className="rounded bg-gray-800 border-gray-700 text-teal-500 cursor-pointer" />
              <span className="text-sm flex items-center gap-2">
                <Wind className="w-4 h-4 text-fuchsia-500" /> HCHO Hotspots
              </span>
            </div>
          </label>
        </div>
      </div>

      {(dataError || tileError) && (
        <div className="absolute left-1/2 top-28 z-[450] w-[min(90vw,460px)] -translate-x-1/2 rounded-lg border border-orange-500/20 bg-[#131821]/95 p-4 text-sm text-orange-100 shadow-2xl backdrop-blur-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
            <p>{dataError ?? 'Basemap tiles are slow or unavailable. Data overlays are still active.'}</p>
          </div>
        </div>
      )}

      {!loading && !dataError && (
        <div className="absolute bottom-4 right-4 z-[400] w-64 rounded-lg border border-gray-800 bg-[#131821]/95 p-4 shadow-2xl backdrop-blur-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Layer Status</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">PM2.5 cells</p>
              <p className="font-bold text-teal-300">{gridCells.length}</p>
            </div>
            <div>
              <p className="text-gray-500">Avg PM2.5</p>
              <p className="font-bold text-orange-300">{gridAverage == null ? '-' : `${gridAverage.toFixed(1)} µg/m³`}</p>
            </div>
            <div>
              <p className="text-gray-500">Sources</p>
              <p className="font-bold text-red-300">{sources.length}</p>
            </div>
            <div>
              <p className="text-gray-500">Hour</p>
              <p className="font-bold text-blue-300">T+24</p>
            </div>
          </div>
        </div>
      )}

      <StationRankingTable />

      {loading && (
          <div className="absolute inset-0 bg-[#0b0e14] z-[1000] flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-gray-800 border-t-teal-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400 font-medium">Syncing live data layers...</p>
          </div>
        )}
    </div>
  );
}
