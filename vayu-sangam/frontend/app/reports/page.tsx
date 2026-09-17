"use client";

import { useEffect, useState, useMemo } from 'react';
import { fetchJson } from '../lib/api';
import { getCityTheme, NCR_CITIES } from '../lib/cityColors';
import { Activity, MapPin, AlertCircle, BarChart3, GitCompare, LayoutGrid, Search, ChevronDown, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Legend } from 'recharts';
import { GridData, computeChoropleth } from '../lib/spatial';

/* eslint-disable @typescript-eslint/no-explicit-any */

function aqiColor(aqi: number | null | undefined) {
  if (!aqi) return '#9ca3af'; 
  if (aqi <= 50) return '#4ade80'; 
  if (aqi <= 100) return '#facc15'; 
  if (aqi <= 200) return '#fb923c'; 
  if (aqi <= 300) return '#f87171'; 
  if (aqi <= 400) return '#c084fc'; 
  return '#991b1b'; 
}

function aqiLabel(aqi: number | null | undefined) {
  if (!aqi) return 'No Data';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

function aqiTextColor(aqi: number | null | undefined) {
  if (!aqi) return 'text-gray-500 dark:text-gray-400'; 
  if (aqi <= 50) return 'text-green-500 dark:text-green-400'; 
  if (aqi <= 100) return 'text-yellow-600 dark:text-yellow-400'; 
  if (aqi <= 200) return 'text-orange-500 dark:text-orange-400'; 
  if (aqi <= 300) return 'text-red-500 dark:text-red-400'; 
  if (aqi <= 400) return 'text-purple-600 dark:text-purple-400'; 
  return 'text-red-800 dark:text-red-600'; 
}

function aqiBgColor(aqi: number | null | undefined) {
  if (!aqi) return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'; 
  if (aqi <= 50) return 'bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20'; 
  if (aqi <= 100) return 'bg-yellow-100 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20'; 
  if (aqi <= 200) return 'bg-orange-100 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20'; 
  if (aqi <= 300) return 'bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'; 
  if (aqi <= 400) return 'bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20'; 
  return 'bg-red-200 dark:bg-red-900/40 border-red-300 dark:border-red-800'; 
}

const ADJACENT_CITIES: Record<string, string[]> = {
  'Delhi': ['Gurugram', 'Noida', 'Ghaziabad', 'Faridabad'],
  'Ghaziabad': ['Delhi', 'Noida', 'Greater Noida'],
  'Noida': ['Delhi', 'Ghaziabad', 'Greater Noida', 'Faridabad'],
  'Gurugram': ['Delhi', 'Faridabad'],
  'Faridabad': ['Delhi', 'Gurugram', 'Noida'],
  'Greater Noida': ['Noida', 'Ghaziabad'],
};

function SearchableDropdown({ value, options, onChange, placeholder, disabled = false }: { value: string, options: string[], onChange: (val: string) => void, placeholder: string, disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const currentTheme = value !== 'Overview' && value !== 'None' ? getCityTheme(value) : null;

  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
      <div 
        className="flex items-center justify-between bg-background border border-panelBorder text-foreground rounded-lg px-4 py-2 cursor-pointer hover:border-cyan transition-colors relative z-50 min-w-[200px] gap-2"
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {currentTheme ? (
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentTheme.hex }} />
          ) : (
            <Search className="w-4 h-4 text-cyan" />
          )}
          <span className="truncate font-medium">{value}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-panel border border-panelBorder rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-64">
          <div className="p-2 border-b border-panelBorder flex items-center gap-2 bg-background">
            <Search className="w-4 h-4 text-gray-500" />
            <input 
              autoFocus
              className="bg-transparent border-none outline-none text-sm text-foreground w-full placeholder-gray-500"
              placeholder={placeholder || "Search city..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">No cities found</div>
            ) : (
              filteredOptions.map(opt => {
                const optTheme = opt !== 'Overview' && opt !== 'None' ? getCityTheme(opt) : null;
                return (
                  <div 
                    key={opt}
                    className={`px-3 py-2 text-sm rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                      value === opt ? 'bg-cyan/10 font-bold text-foreground' : 'text-foreground hover:bg-background'
                    }`}
                    onClick={() => { onChange(opt); setIsOpen(false); }}
                  >
                    <div className="flex items-center gap-2">
                      {optTheme && (
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: optTheme.hex }} />
                      )}
                      <span>{opt}</span>
                    </div>
                    {value === opt && <Check className="w-4 h-4 text-cyan" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ADJACENCY: Record<string, string[]> = {
  "Delhi": ["Gurugram", "Noida", "Ghaziabad", "Faridabad"],
  "Gurugram": ["Delhi", "Faridabad"],
  "Noida": ["Delhi", "Ghaziabad", "Faridabad", "Greater Noida"],
  "Ghaziabad": ["Delhi", "Noida", "Greater Noida"],
  "Faridabad": ["Delhi", "Gurugram", "Noida", "Greater Noida"],
  "Greater Noida": ["Noida", "Ghaziabad", "Faridabad"]
};

export default function ReportsPage() {
  const [data, setData] = useState<any[]>([]);
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [city1, setCity1] = useState<string>('Overview');
  const [city2, setCity2] = useState<string>('None');

  useEffect(() => {
    Promise.all([
      fetchJson<any>('/api/cpcb/latest'),
      fetchJson<GridData>('/api/nowcast').catch(() => null),
      fetch('/ncr_districts.geojson').then(r => r.json()).catch(() => null)
    ])
      .then(([d, g, geo]) => {
        const rows = Array.isArray(d) ? d : (d?.Data ?? []);
        setData(rows);
        setGridData(g);
        setGeoData(geo);
        if (d?.stale_warning) setStaleWarning(d.stale_warning);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const allCities = useMemo(() => {
    const fromData = data ? data.map(d => d.city).filter(Boolean) : [];
    const fromNCR = NCR_CITIES;
    return Array.from(new Set([...fromData, ...fromNCR])).sort();
  }, [data]);

  const districtAqiMap = useMemo(() => {
    if (!geoData || !gridData) return {};
    const computedGeo = computeChoropleth(geoData, gridData);
    const map: Record<string, number> = {};
    if (computedGeo?.features) {
       for (const f of computedGeo.features) {
          if (f.properties.value) map[f.properties.district] = Math.round(f.properties.value);
       }
    }
    return map;
  }, [geoData, gridData]);

  const cityStats = useMemo(() => {
    if (!data || data.length === 0) return [];
    const cityMap: Record<string, { stationCount: number; aqiVals: number[]; pm25Vals: number[]; pm10Vals: number[]; no2Vals: number[]; maxAqi: number; maxAqiStation: string }> = {};

    data.forEach(row => {
      const city = row.city || 'Unknown';
      if (!cityMap[city]) {
        cityMap[city] = { stationCount: 0, aqiVals: [], pm25Vals: [], pm10Vals: [], no2Vals: [], maxAqi: 0, maxAqiStation: '' };
      }
      cityMap[city].stationCount++;
      
      if (typeof row.aqi === 'number' && row.aqi > 0) cityMap[city].aqiVals.push(row.aqi);
      if (typeof row.pm25 === 'number' && row.pm25 > 0) cityMap[city].pm25Vals.push(row.pm25);
      if (typeof row.pm10 === 'number' && row.pm10 > 0) cityMap[city].pm10Vals.push(row.pm10);
      if (typeof row.no2 === 'number' && row.no2 > 0) cityMap[city].no2Vals.push(row.no2);
      
      if (typeof row.aqi === 'number' && row.aqi > cityMap[city].maxAqi) {
        cityMap[city].maxAqi = row.aqi!;
        cityMap[city].maxAqiStation = row.station_name || 'Unknown';
      }
    });

    // Ensure all predefined NCR cities appear even if 0 active stations
    NCR_CITIES.forEach(city => {
      if (!cityMap[city]) {
        cityMap[city] = { stationCount: 0, aqiVals: [], pm25Vals: [], pm10Vals: [], no2Vals: [], maxAqi: 0, maxAqiStation: '' };
      }
    });


    return Object.keys(cityMap).map(city => {
      const c = cityMap[city];
      const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      const computedAqi = districtAqiMap[city];
      const displayAqi = computedAqi || avg(c.aqiVals); // Fallback to station avg if choropleth is missing

      return {
        city,
        stationCount: c.stationCount,
        validAqiCount: c.aqiVals.length,
        avgAqi: displayAqi,
        avgPm25: avg(c.pm25Vals) || '-',
        avgPm10: avg(c.pm10Vals) || '-',
        avgNo2: avg(c.no2Vals) || '-',
        maxAqi: c.maxAqi,
        maxAqiStation: c.maxAqiStation || 'No Data'
      };
    }).sort((a, b) => b.avgAqi - a.avgAqi);
  }, [data, districtAqiMap]);

  const getCityDetails = (cityName: string) => {
    if (!data || cityName === 'Overview' || cityName === 'None') return null;
    const stations = data.filter(d => d.city === cityName).sort((a, b) => (typeof b.aqi === 'number' ? b.aqi : 0) - (typeof a.aqi === 'number' ? a.aqi : 0));
    const stats = cityStats.find(c => c.city === cityName);
    return { stations, stats };
  };

  const details1 = getCityDetails(city1);
  const details2 = getCityDetails(city2);

  const radarData = useMemo(() => {
    if (!details1?.stats) return [];
    const params = [
      { subject: 'PM2.5', key: 'avgPm25', full: 300 },
      { subject: 'PM10', key: 'avgPm10', full: 500 },
      { subject: 'NO2', key: 'avgNo2', full: 200 },
      { subject: 'AQI', key: 'avgAqi', full: 500 },
    ];
    return params.map(p => ({
      subject: p.subject,
      [city1]: details1.stats ? details1.stats[p.key as keyof typeof details1.stats] : 0,
      [city2]: details2?.stats ? details2.stats[p.key as keyof typeof details2.stats] : 0,
      fullMark: p.full
    }));
  }, [details1, details2, city1, city2]);


  const touchingCitiesPieData = useMemo(() => {
    if (city1 === 'Overview' || city1 === 'None') return [];
    const touchingCities = ADJACENCY[city1] || [];
    const pieData = [
      { name: city1, value: cityStats.find(c => c.city === city1)?.avgAqi || 0, color: getCityTheme(city1).hex },
      ...touchingCities.map(tc => ({
        name: tc,
        value: cityStats.find(c => c.city === tc)?.avgAqi || 0,
        color: getCityTheme(tc).hex
      }))
    ].filter(d => d.value > 0);
    return pieData;
  }, [city1, cityStats]);

  return (
    <div className="flex-1 w-full py-8 px-6 max-w-7xl mx-auto flex flex-col gap-8">
      {staleWarning && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div><span className="font-bold">Data Quality Warning: </span>{staleWarning}</div>
        </div>
      )}
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-cyan" /> Interactive Reports
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Deep dive into city-level air quality and compare regions side-by-side.</p>
        </div>

        <div className="flex flex-col gap-4 p-4 bg-panel rounded-2xl border border-panelBorder shadow-md">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-col gap-1 relative z-20">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Primary City</label>
              <SearchableDropdown 
                value={city1}
                options={['Overview', ...allCities]}
                onChange={(val) => {
                  setCity1(val);
                  if (val === 'Overview') setCity2('None');
                }}
                placeholder="Search Primary City"
              />
            </div>
            
            <div className="flex flex-col gap-1 relative z-10">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Compare With</label>
              <SearchableDropdown 
                value={city2}
                options={['None', ...allCities.filter(c => c !== city1)]}
                onChange={setCity2}
                placeholder="Search Secondary City"
                disabled={city1 === 'Overview'}
              />
            </div>
          </div>
          
          {/* NEARBY CITIES SUGGESTIONS */}
          {city1 !== 'Overview' && ADJACENT_CITIES[city1] && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-panelBorder">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Compare with nearby:
              </span>
              {ADJACENT_CITIES[city1].filter(c => allCities.includes(c) && c !== city2).map(nearbyCity => {
                const nTheme = getCityTheme(nearbyCity);
                return (
                  <button 
                    key={nearbyCity}
                    onClick={() => setCity2(nearbyCity)}
                    className="px-3 py-1 text-[11px] font-semibold rounded-full border transition-all flex items-center gap-1.5 hover:scale-105"
                    style={{ borderColor: nTheme.hex + '55', color: nTheme.hex, backgroundColor: nTheme.hex + '12' }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: nTheme.hex }} />
                    {nearbyCity}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* NCR CITIES COLOR PALETTE QUICK-FILTER BAR */}
      <div className="flex flex-wrap items-center gap-2.5 p-3.5 bg-panel rounded-2xl border border-panelBorder shadow-sm">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
          <MapPin className="w-3.5 h-3.5 text-cyan" /> Delhi-NCR Cities:
        </span>
        <button
          onClick={() => { setCity1('Overview'); setCity2('None'); }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 ${
            city1 === 'Overview' 
              ? 'bg-cyan/15 text-cyan border-cyan/40 ring-2 ring-cyan/30' 
              : 'bg-background text-gray-500 dark:text-gray-400 border-panelBorder hover:border-gray-400'
          }`}
        >
          <LayoutGrid className="w-3 h-3" />
          Overview
        </button>
        {NCR_CITIES.map((c) => {
          const cTheme = getCityTheme(c);
          const isPrimary = city1 === c;
          const isSecondary = city2 === c;
          return (
            <button
              key={c}
              onClick={() => {
                if (city1 === 'Overview' || city1 === c) {
                  setCity1(c);
                  setCity2('None');
                } else {
                  setCity2(c);
                }
              }}
              title={isPrimary ? `${c} (Primary Selected)` : isSecondary ? `${c} (Comparison Selected)` : `Click to select ${c}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all flex items-center gap-2 hover:scale-105 ${
                isPrimary
                  ? 'font-bold ring-2 ring-offset-1'
                  : isSecondary
                  ? 'font-bold ring-1'
                  : 'hover:opacity-90'
              }`}
              style={{
                borderColor: isPrimary || isSecondary ? cTheme.hex : cTheme.hex + '40',
                color: cTheme.hex,
                backgroundColor: isPrimary ? cTheme.hex + '25' : isSecondary ? cTheme.hex + '18' : cTheme.hex + '0d',
                boxShadow: isPrimary ? `0 0 12px ${cTheme.hex}35` : undefined,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cTheme.hex }} />
              <span>{c}</span>
              {isPrimary && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-foreground/10 text-foreground uppercase tracking-wider font-bold">
                  P1
                </span>
              )}
              {isSecondary && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-foreground/10 text-foreground uppercase tracking-wider font-bold">
                  P2
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="w-full flex flex-col gap-8 animate-pulse">
          <div className="h-[400px] bg-panel rounded-2xl border border-panelBorder w-full" />
        </div>
      ) : error || cityStats.length === 0 ? (
        <div className="w-full bg-panel rounded-2xl border border-panelBorder p-12 flex flex-col items-center justify-center text-center shadow-xl">
          <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mb-6 border border-panelBorder">
            <AlertCircle className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">Data Unavailable</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg mb-8">
            Live CPCB data could not be fetched at the moment.
          </p>
        </div>
      ) : city1 === 'Overview' ? (
        <>
          {/* OVERVIEW MODE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-1 lg:col-span-2 bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                <Activity className="w-5 h-5 text-teal-500 dark:text-teal-400" /> Average AQI by City
              </h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                    <XAxis dataKey="city" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const cTheme = getCityTheme(String(label));
                          return (
                            <div className="bg-panel/95 backdrop-blur-sm border border-panelBorder p-4 rounded-xl shadow-2xl">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cTheme.hex }} />
                                <p className="font-bold text-foreground">{label}</p>
                              </div>
                              <div className="flex justify-between gap-6 mb-1">
                                <span className="text-gray-500 dark:text-gray-400 text-sm">Avg AQI</span>
                                <span className={`font-bold ${aqiTextColor(data.avgAqi)}`}>{data.avgAqi}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="avgAqi" radius={[6, 6, 0, 0]}>
                      {cityStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={aqiColor(entry.avgAqi)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-span-1 bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                  <MapPin className="w-5 h-5 text-red-500 dark:text-red-400" /> Most Polluted City
                </h2>
                <div className="text-center py-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: getCityTheme(cityStats[0].city).hex }} />
                    <h3 className="text-4xl font-extrabold text-foreground">{cityStats[0].city}</h3>
                  </div>
                  <div className={`inline-block px-4 py-1.5 rounded-full border ${aqiBgColor(cityStats[0].avgAqi)}`}>
                    <span className={`text-xl font-bold ${aqiTextColor(cityStats[0].avgAqi)}`}>
                      AQI {cityStats[0].avgAqi} ({aqiLabel(cityStats[0].avgAqi)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-panel rounded-2xl border border-panelBorder shadow-xl overflow-hidden mt-2">
            <div className="p-6 border-b border-panelBorder flex justify-between items-center bg-background/50">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <LayoutGrid className="w-5 h-5 text-cyan" /> Detailed City Comparison
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-background text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-panelBorder">
                  <tr>
                    <th className="p-4 font-semibold">City</th>
                    <th className="p-4 font-semibold text-center">Stations</th>
                    <th className="p-4 font-semibold text-center">Avg AQI</th>
                    <th className="p-4 font-semibold text-center">Status</th>
                    <th className="p-4 font-semibold text-center">Max AQI</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-panelBorder">
                  {cityStats.map((row, i) => (
                    <tr key={i} className="hover:bg-background/50 transition-colors">
                      <td className="p-4 font-bold text-foreground">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCityTheme(row.city).hex }} />
                          <span>{row.city}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-gray-500 dark:text-gray-400">{row.stationCount}</td>
                      <td className={`p-4 text-center font-bold text-lg ${aqiTextColor(row.avgAqi)}`}>{row.avgAqi || '-'}</td>
                      <td className="p-4 text-center">
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${aqiBgColor(row.avgAqi)} ${aqiTextColor(row.avgAqi)} uppercase tracking-wide`}>
                          {aqiLabel(row.avgAqi)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`font-bold ${aqiTextColor(row.maxAqi)}`}>{row.maxAqi || '-'}</span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 max-w-[120px] truncate">{row.maxAqiStation}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* DETAILED / COMPARE MODE */}
          {(() => {
            const c1Theme = getCityTheme(city1);
            const c2Theme = getCityTheme(city2);
            return (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* CITY 1 DETAILS */}
                  {details1 && details1.stats && (
                    <div 
                      className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl flex flex-col relative overflow-hidden transition-all"
                      style={{ borderTop: `4px solid ${c1Theme.hex}` }}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="flex items-center gap-2.5 mb-1">
                            <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: c1Theme.hex }} />
                            <h2 className="text-2xl font-bold text-foreground">{city1}</h2>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${c1Theme.badgeBg} ${c1Theme.badgeText} ${c1Theme.badgeBorder}`}>
                              Primary City
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{details1.stats.stationCount} Active Stations</p>
                        </div>
                        <div className={`px-4 py-2 rounded-xl border flex flex-col items-center ${aqiBgColor(details1.stats.avgAqi)}`}>
                          <span className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Avg AQI</span>
                          <span className={`text-3xl font-black ${aqiTextColor(details1.stats.avgAqi)}`}>{details1.stats.avgAqi}</span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c1Theme.hex }} />
                          Stations ({details1.stations.length})
                        </h3>
                        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                          {details1.stations.map((s, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-background border border-panelBorder hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c1Theme.hex }} />
                                  <span className="font-medium text-foreground truncate max-w-[200px]">{s.station_name}</span>
                                </div>
                                {s.data_source && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-4">
                                    via {s.data_source} · {(() => {
                                      if (!s.timestamp) return 'unknown time';
                                      const diff = (Date.now() - new Date(s.timestamp).getTime()) / 3600000;
                                      if (isNaN(diff)) return s.timestamp;
                                      if (diff < 1) return 'Updated <1h ago';
                                      return `Updated ${Math.round(diff)}h ago`;
                                    })()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold ${aqiTextColor(s.aqi)}`}>AQI {s.aqi || '-'}</span>
                                <div className={`w-3 h-3 rounded-full ${s.aqi ? '' : 'bg-gray-400'}`} style={{ backgroundColor: s.aqi ? aqiColor(s.aqi) : undefined }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CITY 2 DETAILS OR COMPARISON PLACEHOLDER */}
                  {city2 === 'None' ? (
                    <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl flex flex-col items-center justify-center text-center">
                      <GitCompare className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4" />
                      <h3 className="text-xl font-bold text-foreground mb-2">Compare with another city</h3>
                      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">Select a second city from the dropdown or the NCR city buttons above to view a side-by-side comparison and pollution radar.</p>
                      {/* QUICK CITY SELECTOR PILLS */}
                      <div className="flex flex-wrap gap-2 justify-center max-w-md">
                        {NCR_CITIES.filter(c => c !== city1).map(c => {
                          const theme = getCityTheme(c);
                          return (
                            <button
                              key={c}
                              onClick={() => setCity2(c)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 hover:scale-105"
                              style={{ borderColor: theme.hex + '55', color: theme.hex, backgroundColor: theme.hex + '15' }}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.hex }} />
                              Compare with {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : details2 && details2.stats && (
                    <div 
                      className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl flex flex-col relative overflow-hidden transition-all"
                      style={{ borderTop: `4px solid ${c2Theme.hex}` }}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="flex items-center gap-2.5 mb-1">
                            <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: c2Theme.hex }} />
                            <h2 className="text-2xl font-bold text-foreground">{city2}</h2>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${c2Theme.badgeBg} ${c2Theme.badgeText} ${c2Theme.badgeBorder}`}>
                              Comparison City
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{details2.stats.stationCount} Active Stations</p>
                        </div>
                        <div className={`px-4 py-2 rounded-xl border flex flex-col items-center ${aqiBgColor(details2.stats.avgAqi)}`}>
                          <span className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Avg AQI</span>
                          <span className={`text-3xl font-black ${aqiTextColor(details2.stats.avgAqi)}`}>{details2.stats.avgAqi}</span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c2Theme.hex }} />
                          Stations ({details2.stations.length})
                        </h3>
                        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                          {details2.stations.map((s, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-background border border-panelBorder hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c2Theme.hex }} />
                                  <span className="font-medium text-foreground truncate max-w-[200px]">{s.station_name}</span>
                                </div>
                                {s.data_source && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-4">
                                    via {s.data_source} · {(() => {
                                      if (!s.timestamp) return 'unknown time';
                                      const diff = (Date.now() - new Date(s.timestamp).getTime()) / 3600000;
                                      if (isNaN(diff)) return s.timestamp;
                                      if (diff < 1) return 'Updated <1h ago';
                                      return `Updated ${Math.round(diff)}h ago`;
                                    })()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold ${aqiTextColor(s.aqi)}`}>AQI {s.aqi || '-'}</span>
                                <div className={`w-3 h-3 rounded-full ${s.aqi ? '' : 'bg-gray-400'}`} style={{ backgroundColor: s.aqi ? aqiColor(s.aqi) : undefined }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* TOUCHING CITIES PIE CHART */}
                {city1 !== 'Overview' && city2 === 'None' && touchingCitiesPieData.length > 1 && (
                  <div className="bg-panel rounded-2xl border border-panelBorder shadow-xl p-6 mt-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground mb-4">
                      <LayoutGrid className="w-5 h-5 text-purple-500" /> Relative Pollution Share (Adjacent Cities)
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                      Comparison of the average AQI between <strong>{city1}</strong> and its neighboring districts.
                    </p>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={touchingCitiesPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                          >
                            {touchingCitiesPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                            formatter={(value: any) => [`AQI ${value}`, 'Average AQI']}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                
                {/* COMPARISON RADAR CHART */}
                {city2 !== 'None' && details1 && details2 && (
                  <div className="bg-panel rounded-2xl border border-panelBorder p-6 shadow-xl mt-2">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                      <Activity className="w-5 h-5 text-teal-500 dark:text-teal-400" /> Pollutant Profile Comparison
                    </h2>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="var(--panel-border)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                          <Radar name={city1} dataKey={city1} stroke={c1Theme.hex} fill={c1Theme.hex} fillOpacity={0.35} />
                          <Radar name={city2} dataKey={city2} stroke={c2Theme.hex} fill={c2Theme.hex} fillOpacity={0.35} />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--panel)', borderColor: 'var(--panel-border)', borderRadius: '12px', color: 'var(--foreground)' }}
                            itemStyle={{ fontWeight: 'bold' }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* NEARBY CITIES REGIONAL COMPARISON TABLE */}
                {ADJACENT_CITIES[city1] && (
                  <div className="bg-panel rounded-2xl border border-panelBorder shadow-xl overflow-hidden mt-6">
                    <div className="p-6 border-b border-panelBorder flex justify-between items-center bg-background/50">
                      <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                        <LayoutGrid className="w-5 h-5 text-cyan" /> Regional Comparison (Nearby Cities)
                      </h2>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-background text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-panelBorder">
                          <tr>
                            <th className="p-4 font-semibold">City</th>
                            <th className="p-4 font-semibold text-center">Stations</th>
                            <th className="p-4 font-semibold text-center">Avg AQI</th>
                            <th className="p-4 font-semibold text-center">Status</th>
                            <th className="p-4 font-semibold text-center">Avg PM2.5</th>
                            <th className="p-4 font-semibold text-center">Avg PM10</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-panelBorder">
                          {[city1, ...ADJACENT_CITIES[city1]].filter(c => allCities.includes(c)).map((cityName, i) => {
                            const stats = cityStats.find(c => c.city === cityName);
                            if (!stats) return null;
                            const theme = getCityTheme(stats.city);
                            const isPrimary = cityName === city1;
                            return (
                              <tr 
                                key={i} 
                                className={`hover:bg-background/50 transition-colors ${isPrimary ? 'bg-panel' : ''}`}
                                style={isPrimary ? { borderLeft: `4px solid ${theme.hex}` } : undefined}
                              >
                                <td className="p-4 font-bold text-foreground">
                                  <div className="flex items-center gap-2.5">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: theme.hex }} />
                                    <span>{stats.city}</span>
                                    {isPrimary && (
                                      <span 
                                        className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase"
                                        style={{ backgroundColor: theme.hex + '18', color: theme.hex, borderColor: theme.hex + '40' }}
                                      >
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4 text-center text-gray-500 dark:text-gray-400">{stats.stationCount}</td>
                                <td className={`p-4 text-center font-bold text-lg ${aqiTextColor(stats.avgAqi)}`}>{stats.avgAqi}</td>
                                <td className="p-4 text-center">
                                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${aqiBgColor(stats.avgAqi)} ${aqiTextColor(stats.avgAqi)} uppercase tracking-wide`}>
                                    {aqiLabel(stats.avgAqi)}
                                  </span>
                                </td>
                                <td className="p-4 text-center text-gray-600 dark:text-gray-300 font-mono">{stats.avgPm25}</td>
                                <td className="p-4 text-center text-gray-600 dark:text-gray-300 font-mono">{stats.avgPm10}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
