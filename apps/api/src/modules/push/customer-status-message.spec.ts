import { OrderStatusEnum } from '@odin6/types';
import { buildCustomerStatusMessage } from './customer-status-message';

describe('buildCustomerStatusMessage', () => {
  it('IN_PROGRESS avisa en preparacion con la ubicacion', () => {
    const m = buildCustomerStatusMessage(OrderStatusEnum.IN_PROGRESS, {
      tableName: 'Mesa 4',
    });
    expect(m).not.toBeNull();
    expect(m?.title).toBe('Tu pedido esta en preparacion');
    expect(m?.body).toContain('Mesa 4');
  });

  it('READY avisa que va en camino', () => {
    const m = buildCustomerStatusMessage(OrderStatusEnum.READY, {
      sector: 'piscina',
    });
    expect(m?.title).toBe('Tu pedido va en camino');
    expect(m?.body).toContain('Piscina');
  });

  it('sin mesa ni sector cae a Para llevar', () => {
    const m = buildCustomerStatusMessage(OrderStatusEnum.IN_PROGRESS, {});
    expect(m?.body).toContain('Para llevar');
  });

  it('otros estados no notifican al cliente', () => {
    expect(buildCustomerStatusMessage(OrderStatusEnum.PAID, {})).toBeNull();
    expect(buildCustomerStatusMessage(OrderStatusEnum.PENDING, {})).toBeNull();
    expect(
      buildCustomerStatusMessage(OrderStatusEnum.DELIVERED, {}),
    ).toBeNull();
  });
});
