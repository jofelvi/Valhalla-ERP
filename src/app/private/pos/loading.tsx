import { Skeleton } from '@/components/shared/skeleton/skeleton';

/** Esqueleto con la forma real del POS: cabecera, totales y rejilla de mesas. */
export default function PosLoading() {
  return (
    <div className="p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el punto de venta…</span>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-4 w-60" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <Skeleton className="mb-4 h-6 w-24" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton key={i} className="h-[121px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
