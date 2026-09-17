"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from 'react';
import { Layers, Flame, CloudFog, Wind, CloudRain, Shield, AlertOctagon } from 'lucide-react';
import { GridData, computeChoropleth, pointInGeoJSONFeature } from '../lib/spatial';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvent, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import LocationSearch from './LocationSearch';
import { fetchJson } from '../lib/api';

const DELHI_CENTER: [number, number] = [28.6139, 77.209];
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

type SourcePoint = {
  cluster_id: number | string;
  centroid: {
    lat: number;
    lon: number;
  };
  fire_count: number;
  source_score?: number;
  hcho_anomaly?: number;
};

type NowcastResponse = {
  fallback?: boolean;
  grid: {
    lats: number[];
    lons: number[];
  };
  layers: {
    pm25: (number | null)[][];
    aqi: (number | null)[][];
  };
  meta?: { is_live?: boolean; note?: string };
};

type StubbleFeature = {
  geometry: {
    coordinates: [number, number];
  };
  properties: {
    stubble_intensity_score?: number;
  };
};

type StubbleResponse = {
  features?: StubbleFeature[];
};

type InversionResponse = {
  category?: string;
  inversion_index?: number;
};

function colorForPm25(value: number | null | undefined) {
  if (value === null || value === undefined) return '#4b5563';
  if (value > 250) return '#9333ea';
  if (value > 120) return '#ef4444';
  if (value > 90) return '#f97316';
  if (value > 60) return '#eab308';
  if (value > 30) return '#84cc16';
  return '#22c55e';
}

function colorForPblh(value: number | null | undefined) {
  if (value === null || value === undefined) return '#4b5563';
  if (value < 200) return '#dc2626';
  if (value < 500) return '#ea580c';
  if (value < 1000) return '#ca8a04';
  return '#16a34a';
}

function colorForAqi(value: number | null | undefined): string {
  if (value === null || value === undefined) return '#4b5563';
  if (value > 400) return '#9333ea';
  if (value > 300) return '#ef4444';
  if (value > 200) return '#f97316';
  if (value > 100) return '#eab308';
  if (value > 50)  return '#84cc16';
  return '#22c55e';
}
function MapController({ searchedLocation, onZoomOut, setMapInstance }: { searchedLocation: [number, number] | null, onZoomOut: () => void, setMapInstance: (m: any) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (map) setMapInstance(map);
  }, [map, setMapInstance]);

  useMapEvent('zoomend', () => {
    if (map.getZoom() < 9) setTimeout(() => onZoomOut(), 0); // Defer state update to avoid Leaflet race conditions
  });
  
  useMapEvent('click', () => {
    setTimeout(() => onZoomOut(), 0); // Clear selection if user clicks on empty map background
  });

  useEffect(() => { 
    const t = setTimeout(() => {
      try { if (map && map.getContainer()) map.invalidateSize(); } catch {}
    }, 100); 
    return () => clearTimeout(t);
  }, [map]);
  useEffect(() => {
    if (searchedLocation) map.flyTo(searchedLocation, 11, { duration: 1.2 });
  }, [map, searchedLocation]);
  return null;
}


export default function LiveMap() {
  const [sources, setSources] = useState<SourcePoint[]>([]);
  const [grid, setGrid] = useState<GridData | null>(null);
  const [aqiGrid, setAqiGrid] = useState<GridData | null>(null);
  const [pblhGrid, setPblhGrid] = useState<GridData | null>(null);
  const [stubbleFeatures, setStubbleFeatures] = useState<StubbleFeature[]>([]);
  const [inversion, setInversion] = useState<InversionResponse | null>(null);
  const [districtsGeoJson, setDistrictsGeoJson] = useState<any>(null);
  
  const mapMode = 'nowcast';
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<[number, number] | null>(null);
  const [layers, setLayers] = useState({
    aqi: true,
    heatmap: false,
    fires: true,
    hcho: true,
    pblh: false,
    wind: false,
    inversion: false,
    stubble: false
  });

  useEffect(() => {
    setLoading(true);
    setDataError(null);

    Promise.all([
      fetchJson<NowcastResponse>('/api/nowcast', { timeoutMs: 4000 }).catch(() => null),
      fetchJson<{ sources?: SourcePoint[] }>('/api/sources', { timeoutMs: 3000 }).catch(() => null)
    ]).then(([nowcast, sourcesData]) => {
      if (sourcesData?.sources) setSources(sourcesData.sources);

      if (nowcast?.grid && nowcast.layers) {
        setGrid({ lat: nowcast.grid.lats, lon: nowcast.grid.lons, values: nowcast.layers.pm25 });
        setAqiGrid({ lat: nowcast.grid.lats, lon: nowcast.grid.lons, values: nowcast.layers.aqi });
        if (nowcast.fallback || nowcast.meta?.is_live === false) {
          setDataError('Live refresh unavailable. Showing the latest saved map data.');
        }
      } else {
        setGrid(null);
        setAqiGrid(null);
        setDataError('Map data could not be loaded.');
      }
    }).catch(() => {
      setDataError('Map data could not be loaded.');
    }).finally(() => setLoading(false));
  }, [mapMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch('/ncr_districts.geojson', { cache: 'force-cache' })
        .then(r => r.json())
        .then(setDistrictsGeoJson)
        .catch(() => setDistrictsGeoJson(null));
    }, 100);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!layers.pblh || pblhGrid) return;
    fetchJson<GridData>('/api/forecast/grid?hour=24&variable=pblh', { timeoutMs: 3500 })
      .then(data => {
        if (data?.values) setPblhGrid(data);
      })
      .catch(() => {});
  }, [layers.pblh, pblhGrid]);

  useEffect(() => {
    if (!layers.stubble || stubbleFeatures.length > 0) return;
    fetchJson<StubbleResponse>('/api/emissions/stubble?hour=24', { timeoutMs: 3500 })
      .then(data => {
        if (data?.features) setStubbleFeatures(data.features);
      })
      .catch(() => {});
  }, [layers.stubble, stubbleFeatures.length]);

  useEffect(() => {
    if (!layers.inversion || inversion) return;
    fetchJson<InversionResponse>('/api/inversion?hour=24', { timeoutMs: 3500 })
      .then(data => setInversion(data))
      .catch(() => {});
  }, [layers.inversion, inversion]);

  const pm25GeoJson = useMemo(() => computeChoropleth(districtsGeoJson, grid), [districtsGeoJson, grid]);
  const aqiGeoJson = useMemo(() => computeChoropleth(districtsGeoJson, aqiGrid), [districtsGeoJson, aqiGrid]);
  const pblhGeoJson = useMemo(() => computeChoropleth(districtsGeoJson, pblhGrid), [districtsGeoJson, pblhGrid]);

  const selectedDistrictMesh = useMemo(() => {
    if (!selectedDistrict || !districtsGeoJson || !grid) return { pm25: [], aqi: [], pblh: [] };
    
    const feature = districtsGeoJson.features.find((f: any) => f.properties.name === selectedDistrict);
    if (!feature) return { pm25: [], aqi: [], pblh: [] };

    const pm25Points: any[] = [];
    const aqiPoints: any[] = [];
    const pblhPoints: any[] = [];
    
    for (let i = 0; i < grid.lat.length; i++) {
      for (let j = 0; j < grid.lon.length; j++) {
        const lat = grid.lat[i], lon = grid.lon[j];
        if (pointInGeoJSONFeature(lon, lat, feature.geometry)) {
          if (typeof grid.values[i]?.[j] === 'number') {
            pm25Points.push({ lat, lon, value: grid.values[i][j] as number });
          }
          if (aqiGrid && typeof aqiGrid.values[i]?.[j] === 'number') {
            aqiPoints.push({ lat, lon, value: aqiGrid.values[i][j] as number });
          }
          if (pblhGrid && typeof pblhGrid.values[i]?.[j] === 'number') {
            pblhPoints.push({ lat, lon, value: pblhGrid.values[i][j] as number });
          }
        }
      }
    }
    return { pm25: pm25Points, aqi: aqiPoints, pblh: pblhPoints };
  }, [selectedDistrict, districtsGeoJson, grid, aqiGrid, pblhGrid]);

  const hasMeshDensity = selectedDistrictMesh.pm25.length > 1;

  // Added tailwind class definition for fade-in globally in layout or index.css, 
  // but we can just use inline transition style if needed.

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden rounded-xl bg-[#070b11]">
      <LocationSearch onLocationFound={(lat, lon) => setSearchedLocation([lat, lon])} />


      <MapContainer center={DELHI_CENTER} zoom={10} minZoom={5} maxZoom={13} className="absolute inset-0 z-10 h-full w-full">
        <MapController searchedLocation={searchedLocation} onZoomOut={() => setSelectedDistrict(null)} setMapInstance={setMapInstance} />
        <TileLayer url={TILE_URL} attribution='&copy; OpenStreetMap' />

        {layers.heatmap && pm25GeoJson && (
          <GeoJSON 
            key={`pm25-geo`}
            data={pm25GeoJson} 
            style={(feature) => {
              const isSelected = feature?.properties.name === selectedDistrict;
              return {
                fillColor: colorForPm25(feature?.properties.value),
                fillOpacity: (isSelected && hasMeshDensity) ? 0 : (feature?.properties.value === null ? 0.3 : 0.5),
                color: isSelected ? '#38bdf8' : '#ffffff',
                weight: isSelected ? 3 : 1.5,
                dashArray: isSelected ? '' : '3'
              }
            }}
            onEachFeature={(feature, layer) => {
              const val = feature.properties.value;
              layer.bindPopup(`<b>${feature.properties.name}</b><br/>PM2.5: ${val !== null ? val.toFixed(1) + ' µg/m³' : 'No Data'}`);
              layer.on('click', (e: any) => {
                e.originalEvent?.stopPropagation();
                setSelectedDistrict(feature.properties.name);
                if (mapInstance) mapInstance.fitBounds(e.target.getBounds());
              });
            }}
          />
        )}

        {layers.aqi && aqiGeoJson && (
          <GeoJSON 
            key={`aqi-geo`}
            data={aqiGeoJson} 
            style={(feature) => {
              const isSelected = feature?.properties.name === selectedDistrict;
              return {
                fillColor: colorForAqi(feature?.properties.value),
                fillOpacity: (isSelected && hasMeshDensity) ? 0 : (feature?.properties.value === null ? 0.3 : 0.5),
                color: isSelected ? '#38bdf8' : '#ffffff',
                weight: isSelected ? 3 : 1.5,
                dashArray: isSelected ? '' : '3'
              }
            }}
            onEachFeature={(feature, layer) => {
              const val = feature.properties.value;
              layer.bindPopup(`<b>${feature.properties.name}</b><br/>AQI: ${val !== null ? Math.round(val) : 'No Data'}`);
              layer.on('click', (e: any) => {
                e.originalEvent?.stopPropagation();
                setSelectedDistrict(feature.properties.name);
                if (mapInstance) mapInstance.fitBounds(e.target.getBounds());
              });
            }}
          />
        )}

        {layers.pblh && pblhGeoJson && (
          <GeoJSON 
            key={`pblh-geo`}
            data={pblhGeoJson} 
            style={(feature) => {
              const isSelected = feature?.properties.name === selectedDistrict;
              return {
                fillColor: colorForPblh(feature?.properties.value),
                fillOpacity: (isSelected && hasMeshDensity) ? 0 : (feature?.properties.value === null ? 0.3 : 0.6),
                color: isSelected ? '#38bdf8' : '#ffffff',
                weight: isSelected ? 3 : 1.5,
                dashArray: isSelected ? '' : '3'
              }
            }}
            onEachFeature={(feature, layer) => {
              const val = feature.properties.value;
              layer.bindPopup(`<b>${feature.properties.name}</b><br/>PBLH: ${val !== null ? val.toFixed(0) + ' m' : 'No Data'}`);
              layer.on('click', (e: any) => {
                e.originalEvent?.stopPropagation(); // Prevent bubbling to map background click
                setSelectedDistrict(feature.properties.name);
                if (mapInstance) mapInstance.fitBounds(e.target.getBounds());
              });
            }}
          />
        )}

        {/* Semantic Zoom Circle Mesh Overlay */}
        {hasMeshDensity && (
          <>
            {layers.heatmap && selectedDistrictMesh.pm25.map((pt, i) => (
              <CircleMarker key={`mesh-pm25-${i}`} center={[pt.lat, pt.lon]} radius={12} pathOptions={{
                color: '#ffffff', weight: 0.5,
                fillColor: colorForPm25(pt.value), fillOpacity: 0.7,
                className: 'transition-opacity duration-500 ease-in-out'
              }} eventHandlers={{ click: (e: any) => e.originalEvent?.stopPropagation() }}>
                <Popup>Grid PM2.5: {pt.value != null ? pt.value.toFixed(1) : 'No Data'} µg/m³</Popup>
              </CircleMarker>
            ))}
            {layers.aqi && selectedDistrictMesh.aqi.map((pt, i) => (
              <CircleMarker key={`mesh-aqi-${i}`} center={[pt.lat, pt.lon]} radius={12} pathOptions={{
                color: '#ffffff', weight: 0.5,
                fillColor: colorForAqi(pt.value), fillOpacity: 0.7,
                className: 'transition-opacity duration-500 ease-in-out'
              }} eventHandlers={{ click: (e: any) => e.originalEvent?.stopPropagation() }}>
                <Popup>Grid AQI: {Math.round(pt.value)}</Popup>
              </CircleMarker>
            ))}
            {layers.pblh && selectedDistrictMesh.pblh.map((pt, i) => (
              <CircleMarker key={`mesh-pblh-${i}`} center={[pt.lat, pt.lon]} radius={12} pathOptions={{
                color: '#ffffff', weight: 0.5,
                fillColor: colorForPblh(pt.value), fillOpacity: 0.8,
                className: 'transition-opacity duration-500 ease-in-out'
              }} eventHandlers={{ click: (e: any) => e.originalEvent?.stopPropagation() }}>
                <Popup>Grid PBLH: {pt.value != null ? pt.value.toFixed(0) : 'No Data'} m</Popup>
              </CircleMarker>
            ))}
          </>
        )}

        {layers.fires && sources.map(source => (
          <CircleMarker key={`fire-${source.cluster_id}`} center={[source.centroid.lat, source.centroid.lon]} radius={Math.min(18, 8 + source.fire_count * 2)} pathOptions={{ color: '#fee2e2', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 }} eventHandlers={{ click: (e: any) => e.originalEvent?.stopPropagation() }}>
            <Popup>Fires: {source.fire_count}<br/>Score: {source.source_score?.toFixed(2)}</Popup>
          </CircleMarker>
        ))}

        {layers.hcho && sources.filter(s => s.hcho_anomaly != null && s.hcho_anomaly > 0).map(source => (
          <CircleMarker key={`hcho-${source.cluster_id}`} center={[source.centroid.lat - 0.04, source.centroid.lon + 0.04]} radius={10} pathOptions={{ color: '#fdf4ff', fillColor: '#d946ef', fillOpacity: 0.7, weight: 1 }} eventHandlers={{ click: (e: any) => e.originalEvent?.stopPropagation() }}>
            <Popup>HCHO Anomaly: {source.hcho_anomaly?.toFixed(2)}</Popup>
          </CircleMarker>
        ))}
        
        {layers.stubble && stubbleFeatures.map((feat, i) => (
          <CircleMarker key={`stubble-${i}`} center={[feat.geometry.coordinates[1], feat.geometry.coordinates[0]]} radius={15 * (feat.properties.stubble_intensity_score || 0.1)} pathOptions={{ color: '#fef08a', fillColor: '#eab308', fillOpacity: 0.8, weight: 2 }} eventHandlers={{ click: (e: any) => e.originalEvent?.stopPropagation() }}>
            <Popup>Stubble Intensity: {feat.properties.stubble_intensity_score != null ? feat.properties.stubble_intensity_score.toFixed(2) : 'No Data'}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {layers.inversion && inversion && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-orange-900/80 border border-orange-500/50 p-4 rounded-xl shadow-2xl backdrop-blur-md text-center animate-pulse">
          <Shield className="w-6 h-6 text-orange-400 mx-auto mb-1" />
          <div className="text-orange-100 font-bold">Domain-wide Inversion: {inversion.category}</div>
          <div className="text-orange-200 text-xs mt-1">Index: {inversion.inversion_index}</div>
        </div>
      )}

      {(loading || dataError) && (
        <div className="absolute left-4 top-24 z-[400] rounded-xl border border-gray-800 bg-[#131821]/95 px-4 py-3 text-sm text-gray-200 shadow-2xl backdrop-blur-md">
          {loading ? 'Loading map layers...' : dataError}
        </div>
      )}

      <div className="absolute top-4 right-4 z-[400] w-64 bg-[#131821]/95 backdrop-blur-md border border-gray-800 rounded-xl p-4 shadow-2xl mt-14">
        <div className="flex items-center gap-2 font-bold mb-4 text-gray-100">
          <Layers className="w-5 h-5 text-teal-400" /> Map Layers
        </div>
        <div className="space-y-3 text-gray-200">
          <label className="flex items-center gap-2 cursor-pointer hover:text-teal-400">
            <input type="checkbox" checked={layers.aqi} onChange={() => setLayers(p => ({ ...p, aqi: !p.aqi, heatmap: p.aqi ? p.heatmap : false }))} className="rounded bg-gray-800 border-gray-700" />
            <span className="text-sm flex items-center gap-2" title="Air Quality Index (AQI)"><CloudFog className="w-4 h-4 text-green-400" /> AQI (Air Quality Index)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer hover:text-teal-400">
            <input type="checkbox" checked={layers.heatmap} onChange={() => setLayers(p => ({ ...p, heatmap: !p.heatmap, aqi: p.heatmap ? p.aqi : false }))} className="rounded bg-gray-800 border-gray-700" />
            <span className="text-sm flex items-center gap-2" title="Particulate Matter 2.5 concentration (µg/m³)"><CloudFog className="w-4 h-4 text-purple-400" /> PM2.5 Pollution</span>
          </label>
          <label className="flex items-center justify-between cursor-pointer hover:text-teal-400">
            <div className="flex items-center gap-2" title="Planetary Boundary Layer Height - Lower means pollution is trapped">
              <input type="checkbox" checked={layers.pblh} onChange={() => setLayers(p => ({ ...p, pblh: !p.pblh }))} className="rounded bg-gray-800 border-gray-700" />
              <span className="text-sm flex items-center gap-2"><CloudRain className="w-4 h-4 text-blue-400" /> PBL Height (Mixing Layer)</span>
            </div>
          </label>
          <label className="flex items-center justify-between cursor-pointer hover:text-teal-400">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={layers.stubble} onChange={() => setLayers(p => ({ ...p, stubble: !p.stubble }))} className="rounded bg-gray-800 border-gray-700" />
              <span className="text-sm flex items-center gap-2"><AlertOctagon className="w-4 h-4 text-yellow-400" /> Stubble Intensity</span>
            </div>
          </label>
          <label className="flex items-center justify-between cursor-pointer hover:text-teal-400">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={layers.fires} onChange={() => setLayers(p => ({ ...p, fires: !p.fires }))} className="rounded bg-gray-800 border-gray-700" />
              <span className="text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-red-500" /> Active Fires</span>
            </div>
          </label>
          <label className="flex items-center justify-between cursor-pointer hover:text-teal-400">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={layers.hcho} onChange={() => setLayers(p => ({ ...p, hcho: !p.hcho }))} className="rounded bg-gray-800 border-gray-700" />
              <span className="text-sm flex items-center gap-2"><Wind className="w-4 h-4 text-fuchsia-500" /> HCHO (Smoke Marker)</span>
            </div>
          </label>
          <label className="flex items-center justify-between cursor-pointer hover:text-teal-400">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={layers.inversion} onChange={() => setLayers(p => ({ ...p, inversion: !p.inversion }))} className="rounded bg-gray-800 border-gray-700" />
              <span className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-orange-400" /> Inversion Zone</span>
            </div>
          </label>
        </div>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-6 left-4 z-[400] w-64 bg-[#131821]/95 backdrop-blur-md border border-gray-800 rounded-xl p-4 shadow-2xl">
        <h4 className="text-gray-200 font-bold mb-3 text-sm">Map Color Legend</h4>
        
        {(layers.heatmap || layers.aqi) && (
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-1.5 uppercase tracking-wider font-semibold">
              {layers.aqi ? 'AQI (Air Quality Index)' : 'PM2.5 (µg/m³)'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#22c55e] mr-2"></span> {layers.aqi ? '0 - 50 (Good)' : '0 - 30 (Good)'}</div>
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#84cc16] mr-2"></span> {layers.aqi ? '51 - 100 (Satisfactory)' : '31 - 60 (Satisfactory)'}</div>
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#eab308] mr-2"></span> {layers.aqi ? '101 - 200 (Moderate)' : '61 - 90 (Moderate)'}</div>
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#f97316] mr-2"></span> {layers.aqi ? '201 - 300 (Poor)' : '91 - 120 (Poor)'}</div>
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#ef4444] mr-2"></span> {layers.aqi ? '301 - 400 (Very Poor)' : '121 - 250 (Very Poor)'}</div>
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#9333ea] mr-2"></span> {layers.aqi ? '> 400 (Severe)' : '> 250 (Severe)'}</div>
              <div className="flex items-center text-xs text-gray-500"><span className="w-3 h-3 rounded-full bg-[#4b5563] mr-2 opacity-50"></span> No Data</div>
            </div>
          </div>
        )}

        {layers.pblh && (
          <div>
            <div className="text-xs text-gray-400 mb-1.5 uppercase tracking-wider font-semibold">PBL Height (Mixing)</div>
            <div className="space-y-1">
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#dc2626] mr-2 opacity-80"></span> &lt; 200m (Severe Trapping)</div>
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#ea580c] mr-2 opacity-80"></span> 200 - 500m (Poor)</div>
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#ca8a04] mr-2 opacity-80"></span> 500 - 1000m (Moderate)</div>
              <div className="flex items-center text-xs text-gray-300"><span className="w-3 h-3 rounded-full bg-[#16a34a] mr-2 opacity-80"></span> &gt; 1000m (Good Dispersion)</div>
              <div className="flex items-center text-xs text-gray-500"><span className="w-3 h-3 rounded-full bg-[#4b5563] mr-2 opacity-50"></span> No Data</div>
            </div>
          </div>
        )}
        
        {!layers.heatmap && !layers.aqi && !layers.pblh && (
          <div className="text-xs text-gray-500 italic">Turn on AQI, PM2.5 or PBL Height to see legend.</div>
        )}
      </div>
    </div>
  );
}
