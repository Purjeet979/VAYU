
import React, { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';

type DataConfidenceResponse = {
  data_confidence?: string;
};

export default function DataConfidenceBadge() {
  const [confidence, setConfidence] = useState<string>("Loading...");

  useEffect(() => {
    fetchJson<DataConfidenceResponse>('/api/data_confidence', { timeoutMs: 2000 }).then(data => {
      if (data?.data_confidence) setConfidence(data.data_confidence);
    }).catch(() => setConfidence("Unknown"));
  }, []);

  const color = confidence.includes("High") ? "text-green-400" : confidence.includes("Medium") ? "text-yellow-400" : "text-gray-400";

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-900 border border-gray-800 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${confidence.includes("High") ? "bg-green-400" : confidence.includes("Medium") ? "bg-yellow-400" : "bg-gray-400"} animate-pulse`}></span>
      <span className={color}>Data: {confidence}</span>
    </div>
  );
}
