'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export type PestanaDeCartera = 'pending' | 'history';

export interface FiltrosDeCartera {
  tab: PestanaDeCartera;
  status: string;
  /** `YYYY-MM-DD`. */
  desde: string;
  hasta: string;
  q: string;
}

/** Lo que se escribe tarda esto en llegar al servidor. */
const RETARDO_MS = 350;

/**
 * El estado de los filtros de cuentas por cobrar.
 *
 * Vive en el componente y NO en la URL. Antes cada tecla del buscador hacia un
 * `router.push` sobre una pagina `force-dynamic`: una vuelta completa al
 * servidor por letra escrita. La URL se sigue actualizando —para poder
 * compartir el enlace o recargar sin perder el filtro— pero con
 * `history.replaceState`, que no navega ni vuelve a montar nada.
 *
 * `customerId` es la excepcion: no es un filtro que se toca aqui, es a donde
 * te trajo otra pantalla, asi que se lee de la URL en vivo.
 */
export function useFiltrosDeCartera() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customerId') ?? '';

  const [filtros, setFiltros] = useState<FiltrosDeCartera>(() => ({
    tab: searchParams.get('tab') === 'history' ? 'history' : 'pending',
    status: searchParams.get('status') ?? '',
    desde: searchParams.get('dateFrom') ?? '',
    hasta: searchParams.get('dateTo') ?? '',
    q: searchParams.get('query') ?? '',
  }));

  // El texto que se consulta va un paso atras del que se escribe: el campo
  // responde a cada tecla, el servidor solo cuando la mano se detiene.
  const [qDiferido, setQDiferido] = useState(() => filtros.q.trim());
  useEffect(() => {
    const t = setTimeout(() => setQDiferido(filtros.q.trim()), RETARDO_MS);
    return () => clearTimeout(t);
  }, [filtros.q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (customerId) params.set('customerId', customerId);
    if (filtros.tab === 'history') params.set('tab', 'history');
    if (filtros.status) params.set('status', filtros.status);
    if (filtros.desde) params.set('dateFrom', filtros.desde);
    if (filtros.hasta) params.set('dateTo', filtros.hasta);
    if (qDiferido) params.set('query', qDiferido);
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [filtros, qDiferido, customerId]);

  const cambiar = useCallback(
    <K extends keyof FiltrosDeCartera>(
      campo: K,
      valor: FiltrosDeCartera[K],
    ) => {
      setFiltros((prev) =>
        // Cambiar de pestaña limpia el estado: "Pagado" dentro de "Historial"
        // no significa nada, y dejarlo pegado da listas vacias sin explicacion.
        campo === 'tab'
          ? { ...prev, tab: valor as PestanaDeCartera, status: '' }
          : { ...prev, [campo]: valor },
      );
    },
    [],
  );

  const limpiarFechas = useCallback(
    () => setFiltros((prev) => ({ ...prev, desde: '', hasta: '' })),
    [],
  );

  const limpiarTodo = useCallback(
    () =>
      setFiltros((prev) => ({
        tab: prev.tab,
        status: '',
        desde: '',
        hasta: '',
        q: '',
      })),
    [],
  );

  const hayFiltros = Boolean(
    filtros.status || filtros.desde || filtros.hasta || qDiferido,
  );

  /** Lo que viaja a la API. Sin claves vacias: ensucian la clave de caché. */
  const paraLaApi = useMemo(() => {
    const p: Record<string, string | undefined> = { tab: filtros.tab };
    if (filtros.status) p.status = filtros.status;
    if (customerId) p.customerId = customerId;
    if (filtros.desde) p.desde = filtros.desde;
    if (filtros.hasta) p.hasta = filtros.hasta;
    if (qDiferido) p.q = qDiferido;
    return p;
  }, [
    filtros.tab,
    filtros.status,
    filtros.desde,
    filtros.hasta,
    qDiferido,
    customerId,
  ]);

  return {
    filtros,
    qDiferido,
    customerId,
    cambiar,
    limpiarFechas,
    limpiarTodo,
    hayFiltros,
    paraLaApi,
  };
}
