import { comandaDesdePedido } from './comanda-desde-pedido.util';

describe('comandaDesdePedido', () => {
  const pedido = {
    _id: '6add2ab25a7b8444a89eb5f0',
    sector: 'evento',
    orderType: 'zone',
    waiterName: 'Ery Montilva',
    notes: 'sin prisa',
    items: [
      {
        productName: 'Tequeños (12 unidades)',
        quantity: 24,
        presentationQty: 12,
        station: 'KITCHEN',
      },
      {
        productName: 'Cerveza Polar',
        quantity: 3,
        station: 'BAR',
        notes: 'fría',
      },
      { productName: 'Anulado', quantity: 1, cancelledAt: '2026-10-24' },
    ],
  };

  it('arma la comanda como la app: paquetes enteros, sin anulados', () => {
    const c = comandaDesdePedido(pedido, '24/10/2026', '18:20');
    expect(c).toMatchObject({
      orderNumber: 'A89EB5F0',
      date: '24/10/2026',
      time: '18:20',
      waiter: 'Ery Montilva',
      orderType: 'Zona: evento',
      comment: 'sin prisa',
      cajaSummary: true,
      items: [
        { quantity: 2, name: 'Tequeños (12 unidades)', station: 'KITCHEN' },
        { quantity: 3, name: 'Cerveza Polar', station: 'BAR', notes: 'fría' },
      ],
    });
  });

  it('sin productos vivos no hay comanda', () => {
    expect(
      comandaDesdePedido({ _id: 'x', items: [{ quantity: 0 }] }, 'd', 'h'),
    ).toBeNull();
  });
});
