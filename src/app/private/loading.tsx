import { Skeleton } from '@/components/shared/skeleton/skeleton';

/**
 * Frontera de Suspense para TODO /private/*.
 *
 * Sin este archivo el App Router se queda mostrando la pantalla ANTERIOR,
 * congelada y sin ninguna senal, hasta que la ruta nueva termina de cargar.
 * Con una conexion mala eso son segundos en los que tocar el menu lateral se
 * siente exactamente igual que si el click no hubiera hecho nada — y el
 * mesonero vuelve a tocar. El esqueleto convierte esa espera muda en una
 * respuesta inmediata.
 *
 * Vive DENTRO de `private/layout.tsx`, asi que el sidebar y la cabecera siguen
 * en pantalla: solo se reemplaza el area de contenido.
 */
export default function PrivateLoading() {
  return (
    <div className="p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>

      <div className="mb-6">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>

      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
