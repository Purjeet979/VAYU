import dynamic from 'next/dynamic';
import Skeleton from '../components/Skeleton';

const LiveMap = dynamic(() => import('../components/LiveMap'), { 
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-2xl" />
});

export default function MapPage() {
  return (
    <div className="w-full px-4 md:px-6 py-6 flex flex-col h-[calc(100vh-65px)] overflow-hidden">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Live Map (Nowcast)</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Real-time interpolated pollution data and domain-wide alerts.</p>
      </div>
      <div className="bg-panel rounded-2xl border border-panelBorder p-2 shadow-xl flex-1 flex flex-col min-h-0 relative">
        <LiveMap />
      </div>
    </div>
  );
}
