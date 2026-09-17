"use client";

import Link from 'next/link';
import { Wind, LayoutGrid, Map as MapIcon, FileText, Search, ChevronDown, User, Sun, Moon, Home } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function NavBar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    fetch('/api/health', { cache: 'no-store', signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setMode(data?.mode === 'live' ? 'live' : 'demo');
      })
      .catch(() => setMode('unknown'))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  
  return (
    <nav className="flex items-center justify-between px-6 h-16 border-b border-panelBorder bg-background sticky top-0 z-50">
      {/* Left: Logo & Status Badge */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan to-blue-500 flex items-center justify-center">
            <Wind className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-cyan">VayuSangam</span>
        </Link>
        {mode && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-900 border border-gray-700 text-xs font-medium text-gray-300">
            <span className={`w-2 h-2 rounded-full ${mode === 'live' ? 'bg-green-500 animate-pulse' : mode === 'cached' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
            <span className="capitalize">{mode === 'demo' ? 'Demo Data' : mode === 'cached' ? 'Cached Data' : mode}</span>
          </div>
        )}
      </div>

      {/* Center: Navigation Links */}
      <div className="hidden md:flex items-center gap-8 h-full">
        <Link 
          href="/" 
          className={`flex items-center gap-2 h-full px-2 border-b-2 transition-colors ${
            pathname === '/' ? 'border-cyan text-cyan' : 'border-transparent text-gray-500 hover:text-foreground'
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="font-medium">Home</span>
        </Link>
        <Link 
          href="/forecast" 
          prefetch={false}
          className={`flex items-center gap-2 h-full px-2 border-b-2 transition-colors ${
            pathname === '/forecast' ? 'border-cyan text-cyan' : 'border-transparent text-gray-500 hover:text-foreground'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="font-medium">Forecast</span>
        </Link>
        <Link 
          href="/map" 
          prefetch={false}
          className={`flex items-center gap-2 h-full px-2 border-b-2 transition-colors ${
            pathname === '/map' ? 'border-cyan text-cyan' : 'border-transparent text-gray-500 hover:text-foreground'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span className="font-medium">Live Map</span>
        </Link>
        <Link 
          href="/reports" 
          prefetch={false}
          className={`flex items-center gap-2 h-full px-2 border-b-2 transition-colors ${
            pathname === '/reports' ? 'border-cyan text-cyan' : 'border-transparent text-gray-500 hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="font-medium">Reports</span>
        </Link>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {mounted && (
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'var(--icon-bg)', border: '1px solid var(--panel-border)' }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <Moon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
          </button>
        )}
      </div>
    </nav>
  );
}
