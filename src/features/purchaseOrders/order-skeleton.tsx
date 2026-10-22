import { Card, CardContent, CardHeader } from '@/components/shared/card/card';
import { Skeleton } from '@/components/shared/skeleton/skeleton';

function OrderCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-2/5" />
          <Skeleton className="h-6 w-1/4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-1/2" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}

export function OrderGridSkeleton() {
  // Muestra 8 esqueletos para llenar la vista inicial
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array(12)
        .fill(0)
        .map((_, index) => (
          <OrderCardSkeleton key={index} />
        ))}
    </div>
  );
}
