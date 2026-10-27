/**
 * Cuánto de una orden abierta salió de las estaciones y llegó a la mesa.
 * Misma regla que la pantalla de la orden: un ítem está entregado cuando
 * `deliveredQty` alcanza `quantity`. Se cuenta en unidades, no en líneas.
 *
 *  - `despachada`: todas las unidades entregadas.
 *  - `parcial`: entregadas algunas (la etiqueta dice cuántas de cuántas).
 *  - `sin_despachar`: se envió a la estación pero no se entregó nada.
 *  - `sin_enviar`: ni siquiera se mandó a la estación (o no tiene ítems).
 */
export type EstadoDeDespacho =
  | 'despachada'
  | 'parcial'
  | 'sin_despachar'
  | 'sin_enviar';

export interface ItemParaDespacho {
  quantity?: number;
  sentQty?: number;
  deliveredQty?: number;
  cancelledAt?: unknown;
  status?: string | null;
}

export interface UltimaEntregaLike {
  porId?: string | null;
  por?: string | null;
  rol?: string | null;
  estacion?: string | null;
  en?: Date | string | null;
}

export interface OrdenParaDespacho {
  items?: ItemParaDespacho[] | null;
  ultimaEntrega?: UltimaEntregaLike | null;
}

const NOMBRE_ESTACION: Record<string, string> = {
  BAR: 'Barra',
  KITCHEN: 'Cocina',
  PIZZA: 'Pizzería',
};

/** Quién marcó la última entrega: el nombre guardado, el usuario resuelto por id o, si no, la estación. */
export function quienDespacho(
  ue: UltimaEntregaLike | null | undefined,
  nombreDe?: (userId: string) => string | undefined,
): string | null {
  if (!ue) return null;
  if (ue.por) return ue.por;
  const porId = ue.porId ? nombreDe?.(ue.porId) : undefined;
  if (porId) return porId;
  if (ue.estacion) return NOMBRE_ESTACION[ue.estacion] ?? ue.estacion;
  return null;
}

export interface OpcionesDeEtiqueta {
  nombreDe?: (userId: string) => string | undefined;
  hora?: (en: Date | string) => string;
}

export interface Despacho {
  pedido: number;
  enviado: number;
  entregado: number;
  estado: EstadoDeDespacho;
}

const vivo = (i: ItemParaDespacho) =>
  (i.quantity ?? 0) > 0 &&
  !i.cancelledAt &&
  String(i.status ?? '').toUpperCase() !== 'CANCELLED';

export function despachoDe(orden: OrdenParaDespacho): Despacho {
  let pedido = 0;
  let enviado = 0;
  let entregado = 0;
  for (const i of orden.items ?? []) {
    if (!vivo(i)) continue;
    const q = i.quantity ?? 0;
    pedido += q;
    enviado += Math.min(q, i.sentQty ?? 0);
    entregado += Math.min(q, i.deliveredQty ?? 0);
  }
  const estado: EstadoDeDespacho =
    pedido > 0 && entregado >= pedido
      ? 'despachada'
      : entregado > 0
        ? 'parcial'
        : enviado > 0
          ? 'sin_despachar'
          : 'sin_enviar';
  return { pedido, enviado, entregado, estado };
}

export interface EtiquetaDeDespacho {
  texto: string;
  variant: 'success' | 'warning' | 'secondary';
  /** Clases con tokens del tema que afinan la variante (el parcial va en ámbar). */
  className?: string;
  title: string;
}

export function etiquetaDeDespacho(
  orden: OrdenParaDespacho,
  opciones: OpcionesDeEtiqueta = {},
): EtiquetaDeDespacho {
  const d = despachoDe(orden);
  // "· Nohelia · 25/10 15:14": quién marcó la última entrega y cuándo.
  const ue = orden.ultimaEntrega;
  const quien = quienDespacho(ue, opciones.nombreDe);
  const cuando = ue?.en
    ? opciones.hora
      ? opciones.hora(ue.en)
      : String(ue.en)
    : null;
  const detalle = [quien, cuando].filter(Boolean).join(' · ');
  const sufijo = detalle ? ` · ${detalle}` : '';
  switch (d.estado) {
    case 'despachada':
      return {
        texto: `Despachada${sufijo}`,
        variant: 'success',
        title: `Las ${d.pedido} unidades están entregadas${detalle ? `. Última entrega: ${detalle}` : ''}`,
      };
    case 'parcial':
      return {
        texto: `Despacho ${d.entregado}/${d.pedido}${sufijo}`,
        variant: 'warning',
        className: 'bg-warn/15 text-warn',
        title: `Entregadas ${d.entregado} de ${d.pedido} unidades${detalle ? `. Última entrega: ${detalle}` : ''}`,
      };
    case 'sin_despachar':
      return {
        texto: 'Sin despachar',
        variant: 'secondary',
        title: `Enviado a la estación (${d.enviado} de ${d.pedido}); nada entregado todavía`,
      };
    default:
      return {
        texto: 'Sin enviar',
        variant: 'secondary',
        title: 'No se ha enviado nada a la estación',
      };
  }
}
