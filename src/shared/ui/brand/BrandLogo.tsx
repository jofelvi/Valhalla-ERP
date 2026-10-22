'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useMarca, useNombreApp } from '@/shared/config';
import { resolverUrlMarca } from '@/shared/config/logoUrl';
import { cn } from '@/shared/utils/utils';

/** Iniciales para el distintivo sin logo: "Punto de venta" → "PV". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return (
    partes
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

interface BrandLogoProps {
  className?: string;
  /** Sin texto: solo el logo o el distintivo (sidebar colapsado). */
  soloIcono?: boolean;
}

/**
 * Marca del negocio. Usa el logo del tema activo (`logoDarkUrl` / `logoLightUrl`); si el
 * negocio no subió ninguno, muestra un distintivo con las iniciales y el nombre en texto.
 */
export function BrandLogo({ className, soloIcono = false }: BrandLogoProps) {
  const marca = useMarca();
  const nombre = useNombreApp();
  const { resolvedTheme } = useTheme();

  const logo = resolverUrlMarca(
    resolvedTheme === 'dark'
      ? marca.logoDarkUrl || marca.logoLightUrl
      : marca.logoLightUrl || marca.logoDarkUrl,
  );
  const [fallo, setFallo] = useState(false);
  // Un logo nuevo merece otro intento aunque el anterior haya fallado.
  useEffect(() => setFallo(false), [logo]);

  if (logo && !fallo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL del negocio, dominio arbitrario
      <img
        src={logo}
        alt={nombre}
        onError={() => setFallo(true)}
        className={cn('h-10 w-auto max-w-[180px] object-contain', className)}
      />
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-on-brand shadow-sm"
      >
        {iniciales(nombre)}
      </span>
      {!soloIcono && (
        <span className="truncate text-lg font-bold text-content">
          {nombre}
        </span>
      )}
    </div>
  );
}
