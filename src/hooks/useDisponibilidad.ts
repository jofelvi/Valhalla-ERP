import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '@/services/api/apiClient';

export type EstadoDisponibilidad =
  | 'OK'
  | 'AVISO'
  | 'AGOTADO'
  | 'SIN_LINEA_BASE'
  | 'SIN_CONTROL';

export interface Faltante {
  productId: string;
  name: string;
  criticality?: string | null;
}

export interface Disponibilidad {
  productId: string;
  estado: EstadoDisponibilidad;
  faltantes: Faltante[];
  maxPorciones?: number;
}

/**
 * Qué se puede vender ahora mismo.
 *
 * AVISA, no bloquea: si falta un ingrediente lo más probable es que no se haya
 * cargado la compra, no que falte de verdad. Por eso el servidor solo dice
 * "agotado" cuando el insumo está marcado como crítico Y su almacén tiene
 * conteo — con el inventario de hoy, dos tercios del catálogo salen como
 * SIN_LINEA_BASE, y eso NO se le pinta al mesonero: no puede hacer nada con esa
 * información en mitad del servicio, y un distintivo en dos de cada tres
 * productos deja de significar algo.
 */
export function useDisponibilidad(station?: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ['disponibilidad', station ?? 'todas'],
    queryFn: () =>
      api.get<Disponibilidad[]>(
        '/api/inventory/availability',
        station ? { station } : undefined,
      ),
    // El servidor ya cachea 20 s; aquí se refresca al volver a la pantalla.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // Un fallo no puede impedir vender: sin datos, el POS se comporta como
    // siempre.
    retry: false,
  });

  const porProducto = useMemo(() => {
    const m = new Map<string, Disponibilidad>();
    for (const d of data ?? []) m.set(d.productId, d);
    return m;
  }, [data]);

  return { porProducto, isLoading };
}

/** Solo lo accionable llega al vendedor: agotado y aviso. */
export function distintivoDe(d?: Disponibilidad): {
  texto: string;
  clase: string;
} | null {
  if (!d) return null;
  if (d.estado === 'AGOTADO') {
    return {
      texto: 'Agotado',
      clase: 'bg-danger text-on-brand',
    };
  }
  if (d.estado === 'AVISO') {
    return {
      texto: 'Revisar',
      clase: 'bg-warn text-black',
    };
  }
  return null;
}

/** Lo que hay que preguntarle antes de agregarlo, o null si no hay nada que decir. */
export function avisoAntesDeVender(d?: Disponibilidad): string | null {
  if (!d || d.estado !== 'AGOTADO') return null;
  const faltan = d.faltantes.map((f) => f.name).join(', ');
  return `Agotado: falta ${faltan}.\n\n¿Vender igual? (quizá no se ha cargado la compra)`;
}
