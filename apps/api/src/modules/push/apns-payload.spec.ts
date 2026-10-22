import { buildApnsPayload } from './apns-payload';

describe('buildApnsPayload', () => {
  it('arma aps.alert con titulo, texto y sonido', () => {
    const { body } = buildApnsPayload({
      title: 'Hola',
      body: 'Tu pedido salio',
    });
    expect(body.aps.alert).toEqual({ title: 'Hola', body: 'Tu pedido salio' });
    expect(body.aps.sound).toBe('default');
  });

  it('copia los datos propios al nivel raiz', () => {
    const { body } = buildApnsPayload({
      title: 'x',
      body: 'y',
      data: { type: 'order_status', orderId: 'o1' },
    });
    expect(body.type).toBe('order_status');
    expect(body.orderId).toBe('o1');
  });

  it('collapseId sale del orderId, o "kitchen" por defecto', () => {
    expect(
      buildApnsPayload({ title: 'x', body: 'y', data: { orderId: 'o9' } })
        .collapseId,
    ).toBe('o9');
    expect(buildApnsPayload({ title: 'x', body: 'y' }).collapseId).toBe(
      'kitchen',
    );
  });
});
