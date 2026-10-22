import { ATRAS, conAtras, limpiarEnCurso, pasoAnterior } from './atras';
import { draftVacio, ExpenseDraft } from './draft';

const insumos = (): ExpenseDraft => ({ ...draftVacio('u', '', null), kind: 'INSUMOS' });
const general = (): ExpenseDraft => ({ ...draftVacio('u', '', null), kind: 'GENERAL' });

describe('pasoAnterior', () => {
  it('el primer paso no tiene atras: ahi la salida es Cancelar', () => {
    expect(pasoAnterior('KIND', insumos())).toBeNull();
  });

  it('una compra de insumos desanda todo el camino', () => {
    const d = insumos();
    expect(pasoAnterior('SUMMARY', d)).toBe('FUNDS');
    expect(pasoAnterior('FUNDS', d)).toBe('PAYMENT');
    expect(pasoAnterior('PAYMENT', d)).toBe('DESCRIPTION');
    expect(pasoAnterior('DESCRIPTION', d)).toBe('CATEGORY');
    expect(pasoAnterior('CATEGORY', d)).toBe('LINES');
    expect(pasoAnterior('LINES', d)).toBe('AMOUNT');
    expect(pasoAnterior('AMOUNT', d)).toBe('TYPE');
    expect(pasoAnterior('TYPE', d)).toBe('SUPPLIER');
    expect(pasoAnterior('SUPPLIER', d)).toBe('KIND');
  });

  it('un gasto general desanda su propio camino: categoria primero, proveedor al final', () => {
    const d = general();
    expect(pasoAnterior('CATEGORY', d)).toBe('KIND');
    expect(pasoAnterior('AMOUNT', d)).toBe('CATEGORY');
    expect(pasoAnterior('DESCRIPTION', d)).toBe('AMOUNT');
    expect(pasoAnterior('SUPPLIER', d)).toBe('DESCRIPTION');
    expect(pasoAnterior('PAYMENT', d)).toBe('SUPPLIER');
  });
});

describe('limpiarEnCurso', () => {
  it('apaga la busqueda y la edicion a medias', () => {
    const d: ExpenseDraft = { ...insumos(), editingLine: 2, searchingLine: 1, lastSearch: 'tomate' };
    expect(limpiarEnCurso(d)).toEqual(
      expect.objectContaining({ editingLine: null, searchingLine: null, lastSearch: null }),
    );
  });
});

describe('conAtras', () => {
  it('lo pone junto a Cancelar, en la misma fila', () => {
    const r = conAtras(
      { text: '¿Dónde se compró?', buttons: [[{ label: 'Viveluso', data: 'sup:v' }], [{ label: '❌ Cancelar', data: 'cancel' }]] },
      'SUPPLIER',
      insumos(),
    );
    expect(r.buttons).toEqual([
      [{ label: 'Viveluso', data: 'sup:v' }],
      [ATRAS, { label: '❌ Cancelar', data: 'cancel' }],
    ]);
  });

  it('una respuesta sin botones deja de ser un callejon', () => {
    const r = conAtras({ text: 'No reconocí ese proveedor.' }, 'SUPPLIER', insumos());
    expect(r.buttons).toEqual([[ATRAS]]);
  });

  it('en el primer paso no agrega nada', () => {
    const r = conAtras({ text: '¿Qué es este gasto?' }, 'KIND', insumos());
    expect(r.buttons).toBeUndefined();
  });

  it('no lo duplica si el paso ya trae el suyo', () => {
    const r = conAtras({ text: 'x', buttons: [[ATRAS]] }, 'AMOUNT', insumos());
    expect(r.buttons).toEqual([[ATRAS]]);
  });
});
