import { OPERACION_DEFAULT } from '@odin6/types';
import {
  textoPorPagar,
  textoReembolsos,
  textoStock,
  argumentoDe,
} from './commands.helper';
import { ExpenseLean } from '../expenses/schemas/expense.schema';

const base = (p: Partial<ExpenseLean>): ExpenseLean =>
  ({
    _id: 'e1',
    kind: 'GENERAL',
    category: 'Otros',
    currency: 'BS',
    amountBs: 365,
    amountUsd: 10,
    exchangeRate: 36.5,
    paymentStatus: 'CREDIT',
    invoiceUrls: [],
    date: new Date('2026-09-02T12:00:00.000Z'),
    weekStart: new Date('2026-09-01T10:00:00.000Z'),
    socioTurno: 'Orlando',
    registeredBy: { socio: 'Jonathan' },
    source: 'telegram',
    ...p,
  }) as ExpenseLean;

describe('commands.helper', () => {
  it('argumentoDe quita el comando y la mencion del bot', () => {
    expect(argumentoDe('/stock harina pan')).toBe('harina pan');
    expect(argumentoDe('/novedad@NegocioGastosBot se daño la nevera')).toBe(
      'se daño la nevera',
    );
    expect(argumentoDe('/stock')).toBe('');
  });

  it('por pagar: una linea y un boton por gasto', () => {
    const r = textoPorPagar(
      [
        base({ _id: 'a', supplierName: 'Polar' }),
        base({ _id: 'b', description: 'Gas' }),
      ],
      OPERACION_DEFAULT,
    );
    expect(r.text).toContain('Polar');
    expect(r.text).toContain('Gas');
    expect(r.buttons.flat().map((b) => b.data)).toEqual([
      'pay:id:a',
      'pay:id:b',
    ]);
  });

  it('por pagar vacio', () => {
    expect(textoPorPagar([], OPERACION_DEFAULT).text).toMatch(
      /nada pendiente/i,
    );
  });

  it('por pagar: respeta el tope (Telegram corta en 4096 chars / 100 botones)', () => {
    const gastos = [base({ _id: 'a' }), base({ _id: 'b' }), base({ _id: 'c' })];
    const r = textoPorPagar(gastos, OPERACION_DEFAULT, 2);
    expect(r.buttons).toHaveLength(2);
    expect(r.buttons.flat().map((b) => b.data)).toEqual([
      'pay:id:a',
      'pay:id:b',
    ]);
    expect(r.text).toMatch(/…y 1 más/);
  });

  it('reembolsos: agrupa por socio y boton por gasto', () => {
    const r = textoReembolsos(
      [
        base({
          _id: 'a',
          paymentStatus: 'PAID',
          fundsSource: 'PROPIOS',
          paidBy: 'Daisy',
        }),
      ],
      OPERACION_DEFAULT,
    );
    expect(r.text).toContain('Daisy');
    expect(r.buttons.flat().map((b) => b.data)).toEqual(['reemb:a']);
  });

  it('reembolsos: respeta el tope', () => {
    const gastos = [
      base({
        _id: 'a',
        paymentStatus: 'PAID',
        fundsSource: 'PROPIOS',
        paidBy: 'Daisy',
      }),
      base({
        _id: 'b',
        paymentStatus: 'PAID',
        fundsSource: 'PROPIOS',
        paidBy: 'Daisy',
      }),
      base({
        _id: 'c',
        paymentStatus: 'PAID',
        fundsSource: 'PROPIOS',
        paidBy: 'Orlando',
      }),
    ];
    const r = textoReembolsos(gastos, OPERACION_DEFAULT, 2);
    expect(r.buttons).toHaveLength(2);
    expect(r.buttons.flat().map((b) => b.data)).toEqual(['reemb:a', 'reemb:b']);
    expect(r.text).toMatch(/…y 1 más/);
  });

  it('stock: una linea por almacen en unidad legible', () => {
    const t = textoStock('Harina PAN', [
      { almacen: 'Depósito', qty: 34500, baseUnit: 'GR' },
      { almacen: 'Cocina', qty: 800, baseUnit: 'GR' },
    ]);
    expect(t).toContain('Harina PAN');
    expect(t).toContain('Depósito: 34,5 kg');
    expect(t).toContain('Cocina: 800 g');
  });
});
