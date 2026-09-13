import dynamic from 'next/dynamic';
import Skeleton from '../components/Skeleton';

const DashboardView = dynamic(() => import('../components/DashboardView'), { 
  ssr: false, 
  loading: () => <Skeleton className="w-full h-full min-h-[600px] rounded-2xl" /> 
});

export default function DashboardPage() {
  return (
    <div className="flex-1 w-full py-8">
      <DashboardView />
    </div>
  );
}
