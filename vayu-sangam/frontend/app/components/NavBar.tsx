"use client";

import Link from 'next/link';
import { Wind, Code } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function NavBar() {
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/nowcast', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data?.meta?.is_live) {
          setMode('live');
        } else {
          setMode('demo');
        }
      })
      .catch(() => setMode('demo')); // Fallback to demo
  }, []);

  return (
    <nav className="flex flex-col gap-4 px-6 py-4 border-b border-gray-800 bg-[#0b0e14]/80 sticky top-0 z-50 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-teal-400 transition-transform hover:scale-105">
          <Wind className="w-6 h-6" />
          VayuSangam
        </Link>
        {mode && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-900 border border-gray-700 text-xs font-medium text-gray-300">
            <span className={`w-2 h-2 rounded-full ${mode === 'live' ? 'bg-green-500 animate-pulse' : mode === 'cached' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
            <span className="capitalize">{mode === 'demo' ? 'Demo Data' : mode === 'cached' ? 'Cached Data' : mode}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-5 text-sm font-medium">
        <Link href="/map" className="text-gray-300 hover:text-teal-400 transition-colors">Map</Link>
        <Link href="/dashboard" className="text-gray-300 hover:text-teal-400 transition-colors">Forecast</Link>
        <Link href="/about" className="text-gray-300 hover:text-teal-400 transition-colors">About</Link>
        
        <a 
          href="https://github.com/vayu-sangam/vayu-sangam" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-white transition-colors sm:ml-2"
          title="View on GitHub"
        >
          <Code className="w-5 h-5" />
        </a>
      </div>
    </nav>
  );
}
