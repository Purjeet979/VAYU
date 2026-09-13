
import React from 'react';

export default function ForecastSlider({ hour, setHour }: { hour: number, setHour: (h: number) => void }) {
  return (
    <div className="w-full bg-[#131821] p-6 rounded-2xl border border-gray-800 shadow-xl mb-6">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">72-Hour Forecast Timeline</h3>
      <div className="flex justify-between text-xs text-gray-400 mb-2 font-semibold tracking-wider">
        <span className="text-teal-400 w-1/3 text-left">Operational (0-24h)</span>
        <span className="text-blue-400 w-1/3 text-center">Planning (24-48h)</span>
        <span className="text-orange-400 w-1/3 text-right">Early Warning (48-72h)</span>
      </div>
      <div className="relative w-full h-3 rounded-full overflow-hidden flex bg-gray-900 border border-gray-800">
        <div className="h-full bg-teal-500/30 w-1/3" />
        <div className="h-full bg-blue-500/30 w-1/3" />
        <div className="h-full bg-orange-500/30 w-1/3" />
      </div>
      <input 
        type="range" min="0" max="72" value={hour} 
        onChange={e => setHour(parseInt(e.target.value))}
        className="w-full relative -top-4 cursor-pointer accent-white"
        style={{ height: '20px' }}
      />
      <div className="text-center mt-2 text-lg font-bold text-gray-100">
        T+{hour} Hours
      </div>
    </div>
  );
}
