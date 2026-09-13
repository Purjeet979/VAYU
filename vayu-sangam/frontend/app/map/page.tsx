import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('../components/LiveMap'), { ssr: false });

export default function MapPage() {
  return (
    <div className="flex flex-1 h-[calc(100vh-65px)] overflow-hidden">
      <LiveMap />
    </div>
  );
}
