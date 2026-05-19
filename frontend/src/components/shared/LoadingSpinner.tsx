import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ className = '' }: { className?: string }) => (
  <div className={`flex items-center justify-center p-8 ${className}`}>
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export const LoadingSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-3 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    ))}
  </div>
);

export const CardSkeleton = () => (
  <div className="animate-pulse rounded-lg border bg-card p-6 space-y-3">
    <div className="h-5 bg-gray-200 rounded w-1/3" />
    <div className="h-8 bg-gray-200 rounded w-1/2" />
    <div className="h-3 bg-gray-200 rounded w-2/3" />
  </div>
);
