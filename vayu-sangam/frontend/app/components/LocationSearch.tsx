"use client";

import { useState } from 'react';
import { Search, Navigation, AlertCircle } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

const BBOX = {
  minLon: 73,
  maxLon: 80,
  minLat: 27,
  maxLat: 31,
};

export default function LocationSearch({ onLocationFound }: { onLocationFound: (lat: number, lon: number) => void }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' | 'info' } | null>(null);

  const checkBoundsAndFly = (lat: number, lon: number, name: string) => {
    if (lon >= BBOX.minLon && lon <= BBOX.maxLon && lat >= BBOX.minLat && lat <= BBOX.maxLat) {
      setMessage({ text: `Found ${name}`, type: 'success' });
      onLocationFound(lat, lon);
    } else {
      setMessage({ text: `VayuSangam currently covers Delhi NCR only. Showing Delhi NCR data instead.`, type: 'info' });
      // Fallback to center of Delhi
      onLocationFound(28.6139, 77.209);
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        checkBoundsAndFly(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].name || query);
      } else {
        setMessage({ text: 'Location not found.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Search failed. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setMessage({ text: 'Geolocation is not supported by your browser.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false);
        checkBoundsAndFly(position.coords.latitude, position.coords.longitude, 'your location');
      },
      () => {
        setLoading(false);
        setMessage({ text: 'Unable to retrieve your location.', type: 'error' });
      }
    );
  };

  return (
    <div className="w-full relative z-[400]">
      <form onSubmit={handleSearch} className="relative flex items-center bg-panel/95 backdrop-blur-md border border-panelBorder rounded-2xl shadow-lg p-1 overflow-hidden h-12 md:h-14">
        <div className="pl-3 text-gray-500">
          <Search className="w-5 h-5" />
        </div>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search location (e.g. Noida, Gurgaon)"
          className="flex-1 bg-transparent border-none outline-none text-foreground placeholder-gray-500 px-3 py-2 text-sm md:text-base"
        />
        <button 
          type="button" 
          onClick={handleGeolocation}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-cyan transition-colors tooltip"
          title="Use my location"
        >
          <Navigation className="w-5 h-5" />
        </button>
      </form>

      {message && (
        <div className={`absolute top-full mt-2 left-0 w-full px-4 py-2 rounded-xl text-xs md:text-sm font-medium flex items-center gap-2 shadow-lg backdrop-blur-md ${
          message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
          message.type === 'info' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
          'bg-cyan/10 text-cyan border border-cyan/20'
        }`}>
          {message.type === 'info' && <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}
    </div>
  );
}
