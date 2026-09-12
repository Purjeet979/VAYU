"use client";

import React from 'react';
import { Wind, LayoutDashboard, Map as MapIcon, FileText, Activity, User, Sun, Moon } from 'lucide-react';

interface TopNavProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function TopNav({ theme, toggleTheme }: TopNavProps) {
  const isDark = theme === 'dark';

  return (
    <div className={`h-16 border-b flex items-center justify-between px-4 sm:px-6 z-20 shrink-0 transition-colors ${
      isDark ? 'bg-[#11141c] border-[#1e2532]' : 'bg-white border-gray-200 shadow-sm'
    }`}>
      <div className="flex items-center gap-4 sm:gap-8">
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <Wind className={`w-6 h-6 ${isDark ? 'text-teal-400' : 'text-blue-500'}`} />
          VayuSangam
        </h1>
        
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#" className={`flex items-center gap-2 border-b-2 pb-1 pt-1 font-medium text-sm ${
            isDark ? 'text-teal-400 border-teal-400' : 'text-blue-600 border-blue-600'
          }`}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </a>
          <a href="#" className={`flex items-center gap-2 pb-1 pt-1 font-medium text-sm transition-colors ${
            isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-900'
          }`}>
            <MapIcon className="w-4 h-4" />
            Live Map
          </a>
          <a href="#" className={`flex items-center gap-2 pb-1 pt-1 font-medium text-sm transition-colors ${
            isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-900'
          }`}>
            <FileText className="w-4 h-4" />
            Reports
          </a>
          <a href="#" className={`flex items-center gap-2 pb-1 pt-1 font-medium text-sm transition-colors ${
            isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-900'
          }`}>
            <Activity className="w-4 h-4" />
            Analysis
          </a>
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button 
          onClick={toggleTheme}
          className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-100 text-slate-600'}`}
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className={`p-1.5 rounded-full text-xs font-semibold border px-3 ${
          isDark ? 'bg-[#1e2532] text-teal-400 border-teal-500/30' : 'bg-blue-50 text-blue-600 border-blue-200'
        }`}>
          DEMO MODE
        </div>
        <div className="hidden w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 sm:flex items-center justify-center border-2 border-transparent shadow-sm overflow-hidden">
          <img src="https://ui-avatars.com/api/?name=Aditya+Singh&background=0D8ABC&color=fff" alt="Profile" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}
