import Skeleton from "./components/Skeleton";

export default function Loading() {
  return (
    <div className="flex-1 w-full p-6 flex flex-col gap-4 max-w-6xl mx-auto h-[calc(100vh-65px)]">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="w-48 h-6" />
          <Skeleton className="w-64 h-4" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="w-full h-32 rounded-2xl" />
        <Skeleton className="w-full h-32 rounded-2xl" />
        <Skeleton className="w-full h-32 rounded-2xl" />
      </div>

      <Skeleton className="w-full flex-1 rounded-2xl mt-4" />
    </div>
  );
}
