import { buildDeliveryMessage, mergeDelivered } from './push-message';

/**
 * Pruebas del texto que le llega al mesonero. Lo fragil aqui es el truncado:
 * si se pasa del limite, Android corta a media palabra y el mesonero no sabe
 * cuantos productos faltan.
 */
describe('push-message', () => {
  const orden = {
    orderId: 'abc123',
    tableName: 'Mesa 4',
    customerAlias: 'Kranklin Guevara',
  };

  it('suma el mismo producto entregado en varios escaneos', () => {
    const merged = mergeDelivered([
      { name: 'Tequenos', qty: 1 },
      { name: 'Hamburguesa', qty: 1 },
      { name: 'Tequenos', qty: 2 },
    ]);
    expect(merged).toEqual([
      { name: 'Tequenos', qty: 3 },
      { name: 'Hamburguesa', qty: 1 },
    ]);
  });

  it('pone la ubicacion en el titulo y cliente + productos en el cuerpo', () => {
    const msg = buildDeliveryMessage(orden, [
      { name: 'Tequenos', qty: 2 },
      { name: 'Hamburguesa', qty: 1 },
    ]);
    expect(msg.title).toBe('Listo · Mesa 4');
    expect(msg.body).toBe('Kranklin Guevara · 2x Tequenos, 1x Hamburguesa');
  });

  it('usa el sector cuando la orden es de zona', () => {
    const msg = buildDeliveryMessage(
      { orderId: 'x', sector: 'piscina', customerAlias: 'Ana' },
      [{ name: 'Cerveza', qty: 1 }],
    );
    expect(msg.title).toBe('Listo · Piscina');
  });

  it('dice "Para llevar" cuando no hay mesa ni sector', () => {
    const msg = buildDeliveryMessage({ orderId: 'x' }, [
      { name: 'Pizza', qty: 1 },
    ]);
    expect(msg.title).toBe('Listo · Para llevar');
    expect(msg.body).toBe('1x Pizza');
  });

  it('corta por producto entero y avisa cuantos faltan', () => {
    const msg = buildDeliveryMessage(orden, [
      { name: 'Hamburguesa Doble con Tocineta', qty: 1 },
      { name: 'Tequenos de la Casa x12 UND', qty: 2 },
      { name: 'Pizza Margarita Familiar', qty: 1 },
      { name: 'Ensalada Cesar con Pollo', qty: 1 },
      { name: 'Refresco 2L', qty: 3 },
    ]);
    expect(msg.body.length).toBeLessThanOrEqual(110);
    expect(msg.body).toMatch(/\+\d+ mas$/);
    // No corta a media palabra: lo ultimo antes del "+N mas" es un producto completo
    expect(msg.body).toContain(
      'Kranklin Guevara · 1x Hamburguesa Doble con Tocineta',
    );
  });

  it('sin cliente arranca directo con los productos', () => {
    const msg = buildDeliveryMessage({ orderId: 'x', tableName: 'Mesa 1' }, [
      { name: 'Pizza', qty: 1 },
    ]);
    expect(msg.body).toBe('1x Pizza');
  });
});
