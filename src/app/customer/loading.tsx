import { Skeleton } from '@/components/shared/skeleton/skeleton';

/** Frontera de Suspense de /customer/*. */
export default function CustomerLoading() {
  return (
    <div className="p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="mb-4 h-7 w-44" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
