"use client";

import { useRef, useState, useMemo } from 'react';
import Map, { NavigationControl, MapRef, Source, Layer, Marker, type LayerProps } from 'react-map-gl/maplibre';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { Layers } from 'lucide-react';

export interface Cluster {
  cluster_id: number;
  centroid: { lat: number; lon: number };
  fire_count: number;
  frp_sum: number;
  source_score?: number;
  hcho_anomaly?: number;
  wind?: { u_mps: number; v_mps: number; speed_mps: number };
}

export interface ForecastGrid {
  lat: number[];
  lon: number[];
  values: number[][];
}

interface DashboardMapProps {
  theme?: 'light' | 'dark';
  fireClusters?: Cluster[];
  grid?: ForecastGrid | null;
  hour?: number;
}

const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const LIGHT_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// Smooth, continuous Air Quality Heatmap matching the visual mockup
const heatmapLayer: LayerProps = {
  id: 'pm25-forecast-heatmap-layer-v2',
  type: 'heatmap',
  source: 'pm25-forecast-source-v2',
  maxzoom: 15,
  paint: {
    'heatmap-weight': [
      'interpolate',
      ['linear'],
      ['get', 'pm25'],
      0, 0,
      50, 0.15,
      100, 0.35,
      200, 0.65,
      350, 0.9,
      500, 1
    ],
    'heatmap-intensity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      6, 0.9,
      8, 1.5,
      10, 2.8,
      12, 4.0
    ],
    // Continuous spectrum: Transparent Green -> Lime -> Yellow -> Orange -> Red -> Hazardous Purple
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0, 'rgba(34, 197, 94, 0)',
      0.1, 'rgba(34, 197, 94, 0.45)',
      0.25, 'rgba(163, 230, 53, 0.65)',
      0.45, 'rgba(250, 204, 21, 0.8)',
      0.65, 'rgba(249, 115, 22, 0.9)',
      0.82, 'rgba(239, 68, 68, 0.95)',
      1.0, 'rgba(147, 51, 234, 1.0)'
    ],
    'heatmap-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      6, 25,
      8, 55,
      10, 90,
      12, 140
    ],
    'heatmap-opacity': 0.82
  }
};

// AQI legend colours (CPCB)
const AQI_LEGEND = [
  { label: '0–50 Good', color: '#22c55e' },
  { label: '51–100 Satisfactory', color: '#a3e635' },
  { label: '101–200 Moderate', color: '#facc15' },
  { label: '201–300 Poor', color: '#f97316' },
  { label: '301–400 Very Poor', color: '#ef4444' },
  { label: '400+ Severe', color: '#7c3aed' },
];

const LAYER_OPTIONS = [
  { key: 'heatmap', label: 'PM2.5 forecast grid' },
  { key: 'fires', label: 'Active Fires' },
  { key: 'hcho', label: 'HCHO hotspots' },
  { key: 'wind', label: 'Wind vectors' },
  { key: 'plume', label: 'Transport plumes' },
] as const;

export default function DashboardMap({ theme = 'dark', fireClusters = [], grid = null, hour = 24 }: DashboardMapProps) {
  const mapRef = useRef<MapRef>(null);
  const isDark = theme === 'dark';
  const [mapLoaded, setMapLoaded] = useState(false);
  const [layersVisible, setLayersVisible] = useState({
    heatmap: true,
    fires: true,
    hcho: true,
    wind: true,
    plume: true
  });

  // Generate 2D Grid Points from Forecast NetCDF
  const gridPoints: FeatureCollection<Point> = useMemo(() => {
    if (!grid) return { type: 'FeatureCollection' as const, features: [] };
    return {
      type: 'FeatureCollection' as const,
      features: grid.lat.flatMap((lat, row) =>
        grid.lon.map((lon, column) => ({
          type: 'Feature' as const,
          properties: { pm25: grid.values[row]?.[column] ?? 0 },
          geometry: { type: 'Point' as const, coordinates: [lon, lat] },
        }))
      ),
    };
  }, [grid]);

  // Plumes from Fire Clusters towards Delhi NCR
  const plumes: FeatureCollection<LineString> = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: fireClusters.map((cluster) => ({
        type: 'Feature' as const,
        properties: { score: cluster.source_score ?? 0 },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [cluster.centroid.lon, cluster.centroid.lat],
            [77.209, 28.6139],
          ],
        },
      })),
    };
  }, [fireClusters]);

  // Dispersed fire points across the cluster zone (matching mockup)
  const fireMarkers = useMemo(() => {
    if (!fireClusters.length) return [];
    const offsets = [
      { dlat: 0, dlon: 0, count: 22 },
      { dlat: 0.08, dlon: -0.06, count: 12 },
      { dlat: -0.07, dlon: 0.05, count: 9 },
      { dlat: 0.12, dlon: 0.08, count: 7 },
    ];
    return fireClusters.flatMap((c) =>
      offsets.map((off, idx) => ({
        id: `fire-${c.cluster_id}-${idx}`,
        lat: c.centroid.lat + off.dlat,
        lon: c.centroid.lon + off.dlon,
        count: off.count,
        isPrimary: idx === 0,
      }))
    );
  }, [fireClusters]);

  // Dynamic wind vector grid across Delhi-NCR region
  const windVectors = useMemo(() => {
    const lats = [28.15, 28.45, 28.75, 29.05];
    const lons = [76.7, 77.0, 77.3, 77.6];
    const w = fireClusters[0]?.wind ?? { u_mps: 2.45, v_mps: -1.23, speed_mps: 2.74 };
    const baseAngle = (Math.atan2(w.v_mps, w.u_mps) * 180) / Math.PI;

    return lats.flatMap((lat, i) =>
      lons.map((lon, j) => ({
        id: `wind-${i}-${j}`,
        lat: lat + Math.sin(i * 2 + j) * 0.02,
        lon: lon + Math.cos(i + j * 2) * 0.02,
        speed: Math.max(1.2, w.speed_mps + ((i + j) % 3) * 0.3),
        angle: baseAngle + (i - j) * 3,
      }))
    );
  }, [fireClusters]);

  return (
    <div
      className={`relative flex-1 min-h-[420px] rounded-xl border overflow-hidden transition-colors ${
        isDark ? 'bg-[#0b0e14] border-[#2a3140]' : 'bg-gray-100 border-gray-200'
      }`}
    >
      {/* Layer toggle overlay */}
      <div
        className={`absolute top-4 left-4 z-10 backdrop-blur-md border p-3 rounded-xl shadow-lg transition-colors ${
          isDark ? 'bg-[#181c25]/90 border-[#2a3140]' : 'bg-white/90 border-gray-200'
        }`}
      >
        <div
          className={`flex items-center gap-2 text-sm font-semibold mb-2 ${
            isDark ? 'text-gray-200' : 'text-gray-800'
          }`}
        >
          <Layers className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-blue-500'}`} />
          Map Layers
        </div>
        <div className="space-y-1.5 text-xs">
          {LAYER_OPTIONS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layersVisible[key]}
                onChange={() => setLayersVisible((prev) => ({ ...prev, [key]: !prev[key] }))}
                className="accent-teal-500 w-3.5 h-3.5"
              />
              <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                {key === 'fires' ? `${label} (${fireClusters.length} clusters)` : label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Hour readout */}
      <div
        className={`absolute top-4 right-4 z-10 rounded-lg px-3 py-2 text-xs font-medium shadow ${
          isDark ? 'bg-[#181c25]/90 text-gray-300' : 'bg-white/90 text-gray-700'
        }`}
      >
        Delhi NCR · +{hour} h
      </div>

      {/* AQI Legend */}
      <div
        className={`absolute bottom-10 left-4 z-10 backdrop-blur-md border p-3 rounded-xl shadow-lg transition-colors ${
          isDark ? 'bg-[#181c25]/90 border-[#2a3140]' : 'bg-white/90 border-gray-200'
        }`}
      >
        <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Air Quality Index
        </div>
        <div className="space-y-1">
          {AQI_LEGEND.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: color }}></div>
              <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <Map
        key={theme}
        ref={mapRef}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        initialViewState={{ longitude: 77.209, latitude: 28.6139, zoom: 8.2 }}
        mapStyle={isDark ? DARK_STYLE : LIGHT_STYLE}
        onLoad={() => setMapLoaded(true)}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" />

        {mapLoaded && (
          <>
            {/* PM2.5 Continuous Heatmap layer */}
            {layersVisible.heatmap && (
              <Source id="pm25-forecast-source-v2" type="geojson" data={gridPoints}>
                <Layer {...heatmapLayer} />
              </Source>
            )}

            {/* Transport plume trajectories */}
            {layersVisible.plume && (
              <Source id="plumes" type="geojson" data={plumes}>
                <Layer
                  id="plume-lines"
                  type="line"
                  paint={{
                    'line-color': '#f59e0b',
                    'line-opacity': 0.75,
                    'line-width': ['interpolate', ['linear'], ['get', 'score'], 0, 1.5, 1, 4.5],
                    'line-dasharray': [3, 2],
                  }}
                />
              </Source>
            )}

            {/* Active Fire Markers with glow */}
            {layersVisible.fires &&
              fireMarkers.map((m) => (
                <Marker key={m.id} longitude={m.lon} latitude={m.lat}>
                  <div
                    className="relative group cursor-pointer"
                    title={`Active fire hotspot: ${m.count} fires detected`}
                  >
                    <div className="text-[1.5rem] leading-none drop-shadow-[0_0_14px_rgba(239,68,68,1)] transform hover:scale-125 transition-transform animate-pulse">
                      🔥
                    </div>
                    <span className="absolute -bottom-2 -right-2 bg-red-600/90 text-white text-[9px] font-bold px-1 rounded-full border border-red-300/50 shadow">
                      {m.count}
                    </span>
                  </div>
                </Marker>
              ))}

            {/* HCHO hotspots */}
            {layersVisible.hcho &&
              fireClusters
                .filter((cluster) => (cluster.hcho_anomaly ?? 0) > 0)
                .map((cluster) => (
                  <Marker
                    key={`hcho-${cluster.cluster_id}`}
                    longitude={cluster.centroid.lon + 0.05}
                    latitude={cluster.centroid.lat + 0.03}
                  >
                    <div
                      title={`HCHO anomaly: ${cluster.hcho_anomaly}`}
                      className="w-4 h-4 rounded-full bg-fuchsia-500/80 border-2 border-fuchsia-100 shadow-[0_0_12px_#d946ef] animate-ping"
                    />
                  </Marker>
                ))}

            {/* Dynamic wind vectors across the NCR domain */}
            {layersVisible.wind &&
              windVectors.map((vec) => (
                <Marker key={vec.id} longitude={vec.lon} latitude={vec.lat}>
                  <span
                    title={`Wind: ${vec.speed.toFixed(1)} m/s`}
                    className="block text-sm text-cyan-300/60 select-none pointer-events-none drop-shadow"
                    style={{ transform: `rotate(${-vec.angle}deg)` }}
                  >
                    ➜
                  </span>
                </Marker>
              ))}
          </>
        )}
      </Map>
    </div>
  );
}
