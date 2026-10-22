'use client';
import { SolicitudesDeCredito } from '@/features/creditRequests';

/**
 * Pantalla propia de solicitudes de credito.
 *
 * Desde el 20/09/2026 el contenido vive en `features/creditRequests`, porque
 * el dueño pidio que las mismas solicitudes salieran tambien en `/private/pos`
 * y en `/private/verify-payments`, junto a la validacion de pagos. Esta pagina
 * se comporta igual que antes: es la variante completa del mismo bloque.
 */
export default function CreditRequestsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        <SolicitudesDeCredito variante="completa" />
      </div>
    </div>
  );
}
