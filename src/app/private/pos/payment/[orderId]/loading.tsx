import { Skeleton } from '@/components/shared/skeleton/skeleton';

/** Pantalla de cobro: items, totales y metodos de pago. */
export default function PaymentLoading() {
  return (
    <div className="p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el cobro…</span>

      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-7 w-40" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
