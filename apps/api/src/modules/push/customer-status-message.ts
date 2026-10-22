import { OrderStatusEnum } from '@odin6/types';

/**
 * Texto del aviso al CLIENTE cuando su pedido cambia de estado. Puro (sin red)
 * para poder probar el copy y a que estados aplica. Solo IN_PROGRESS ("en
 * preparacion") y READY ("va en camino") le importan al comensal.
 */

const SECTOR_LABELS: Record<string, string> = {
  piscina: 'Piscina',
  tenis: 'Tenis',
  futbol: 'Futbol',
  beisbol: 'Beisbol',
  salon_principal: 'Salon',
  canchas: 'Canchas',
};

function locationLabel(order: {
  tableName?: string | null;
  sector?: string | null;
}): string {
  if (order.tableName) return order.tableName;
  if (order.sector) {
    return SECTOR_LABELS[order.sector] ?? order.sector.replace(/_/g, ' ');
  }
  return 'Para llevar';
}

export function buildCustomerStatusMessage(
  status: OrderStatusEnum,
  order: { tableName?: string | null; sector?: string | null },
): { title: string; body: string } | null {
  const where = locationLabel(order);
  if (status === OrderStatusEnum.IN_PROGRESS) {
    return {
      title: 'Tu pedido esta en preparacion',
      body: `${where} · cocina ya lo esta preparando`,
    };
  }
  if (status === OrderStatusEnum.READY) {
    return {
      title: 'Tu pedido va en camino',
      body: `${where} · tu mesonero te lo lleva`,
    };
  }
  return null;
}
