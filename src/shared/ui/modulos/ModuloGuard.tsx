'use client';

import type { ModuloKey } from '@odin6/types';
import { useModulo } from '@/shared/config';

/**
 * Muestra la pantalla solo si el módulo está encendido en Ajustes. Un módulo apagado no
 * deja entrar por URL: la página se queda en este aviso.
 */
export function ModuloGuard({
  modulo,
  children,
}: {
  modulo: ModuloKey;
  children: React.ReactNode;
}) {
  const activo = useModulo(modulo);
  if (activo) return <>{children}</>;
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold text-content">Módulo no disponible</h1>
      <p className="mt-2 text-sm text-dim">
        Este módulo está apagado. Se enciende desde Ajustes, en Módulos.
      </p>
    </div>
  );
}
