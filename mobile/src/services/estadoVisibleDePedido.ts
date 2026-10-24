import { COMANDA_AL_PAGAR } from '../config/funciones';

export type TonoDeEstado =
  | 'porCobrar'
  | 'pendiente'
  | 'verificar'
  | 'pagado'
  | 'rechazado'
  | 'parcial'
  | 'credito'
  | 'cancelado'
  | 'entregado';

export interface EstadoVisible {
  etiqueta: string;
  tono: TonoDeEstado;
}

interface PedidoParaEstado {
  status?: string | null;
  paymentStatus?: string | null;
  paymentRejected?: boolean | null;
}

const ETAPA_DE_COCINA: Record<string, string> = {
  IN_PROGRESS: 'En preparación',
  READY: 'Listo',
};

/**
 * La etiqueta de estado que ven las listas (Zonas, Pedidos): junta el estado de PAGO con el de
 * la orden para que un pedido ya cobrado no siga diciendo "Pendiente". Con la comanda al cobrar,
 * "Pendiente" a secas confunde: ya hay un cobro (o todavia no), y eso es lo que importa.
 *
 * Solo cambia lo que se MUESTRA; los estados guardados en la orden no se tocan.
 */
export function estadoVisibleDePedido(
  pedido: PedidoParaEstado,
  comandaAlPagar: boolean = COMANDA_AL_PAGAR,
): EstadoVisible {
  const orden = (pedido.status ?? '').toUpperCase();
  const pago = (pedido.paymentStatus ?? '').toLowerCase();

  if (orden === 'CANCELLED')
    return { etiqueta: 'Cancelado', tono: 'cancelado' };
  if (orden === 'CREDIT') return { etiqueta: 'Crédito', tono: 'credito' };
  if (pedido.paymentRejected)
    return { etiqueta: 'Pago rechazado', tono: 'rechazado' };
  if (orden === 'PAID') return { etiqueta: 'Pagado', tono: 'pagado' };
  if (orden === 'DELIVERED')
    return { etiqueta: 'Entregado', tono: 'entregado' };

  const etapa = ETAPA_DE_COCINA[orden];
  const conEtapa = (base: string) => (etapa ? `${base} · ${etapa}` : base);

  if (pago === 'pending_verification')
    return { etiqueta: conEtapa('Por verificar'), tono: 'verificar' };
  if (pago === 'paid') return { etiqueta: conEtapa('Pagado'), tono: 'pagado' };
  if (pago === 'partial')
    return { etiqueta: conEtapa('Pago parcial'), tono: 'parcial' };

  // Sin cobro registrado.
  if (comandaAlPagar && orden === 'PENDING')
    return { etiqueta: 'Por cobrar', tono: 'porCobrar' };
  return {
    etiqueta: etapa ?? 'Pendiente',
    tono: 'pendiente',
  };
}
