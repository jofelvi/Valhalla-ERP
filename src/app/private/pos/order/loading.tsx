import { Skeleton } from '@/components/shared/skeleton/skeleton';

/**
 * La pantalla mas pesada del sistema: 426 productos, categorias y el carrito.
 * Es la que mas se nota sin frontera de Suspense, y la que mas se usa.
 */
export default function OrderLoading() {
  return (
    <div className="p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el pedido…</span>

      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-7 w-32" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          <Skeleton className="mb-3 h-10 w-full rounded-lg" />
          <div className="mb-4 flex gap-2 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-12 rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
          <Skeleton className="h-12 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
