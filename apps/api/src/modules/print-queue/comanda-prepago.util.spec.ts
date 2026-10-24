import {
  motivoParaRechazarComanda,
  prepagoActivo,
} from './comanda-prepago.util';

describe('motivoParaRechazarComanda (prepago)', () => {
  const pedido = (paymentStatus: string, status = 'PENDING') => ({
    paymentStatus,
    status,
    productos: ['Hamburguesa Clásica', 'Cerveza Polar'],
  });

  it('rechaza si no hay pedido', () => {
    expect(motivoParaRechazarComanda(null, ['Cerveza Polar'])).toMatch(
      /ningún pedido/,
    );
  });

  it('rechaza un pedido sin cobrar', () => {
    expect(
      motivoParaRechazarComanda(pedido('pending'), ['Cerveza Polar']),
    ).toMatch(/no está cobrado/);
    expect(motivoParaRechazarComanda(pedido(''), [])).toMatch(
      /no está cobrado/,
    );
  });

  it('rechaza un pedido cancelado aunque diga cobrado', () => {
    expect(
      motivoParaRechazarComanda(pedido('paid', 'CANCELLED'), ['Cerveza Polar']),
    ).toMatch(/no está cobrado/);
  });

  it.each(['pending_verification', 'paid', 'partial'])(
    'deja salir un pedido %s con sus productos (sin tildes ni mayúsculas)',
    (estado) => {
      expect(
        motivoParaRechazarComanda(pedido(estado), [
          'hamburguesa clasica',
          'Cerveza Polar',
        ]),
      ).toBeNull();
    },
  );

  it('rechaza un producto que no está en el pedido', () => {
    expect(
      motivoParaRechazarComanda(pedido('paid'), ['Cerveza Polar', 'Whisky 18']),
    ).toMatch(/"Whisky 18" no está en el pedido/);
  });

  it('se enciende solo con COMANDA_AL_PAGAR=true', () => {
    const antes = process.env.COMANDA_AL_PAGAR;
    process.env.COMANDA_AL_PAGAR = 'true';
    expect(prepagoActivo()).toBe(true);
    process.env.COMANDA_AL_PAGAR = '1';
    expect(prepagoActivo()).toBe(false);
    delete process.env.COMANDA_AL_PAGAR;
    expect(prepagoActivo()).toBe(false);
    if (antes !== undefined) process.env.COMANDA_AL_PAGAR = antes;
  });
});
