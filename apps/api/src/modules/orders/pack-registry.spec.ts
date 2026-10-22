import {
  getPackConfig,
  normalizarRegistroPacks,
  packsParaProducto,
  REGISTRO_PACKS_VACIO,
} from './pack-registry';
import { REGISTRO_PACKS_PRUEBA as REG } from './registro-packs.fixture';

/**
 * El registro de packs vive en `configs/packs`, no en el código. Estas pruebas fijan las
 * reglas de forma (quién apunta a quién) con el registro de prueba de IDs ficticios.
 */
describe('registro de packs', () => {
  it('todo pack apuntado existe en el registro', () => {
    const huerfanos = Object.entries(REG.individualAPacks).flatMap(
      ([individual, packs]) =>
        packs
          .filter((p) => !(p in REG.packs))
          .map((p) => `${individual} -> ${p}`),
    );
    expect(huerfanos).toEqual([]);
  });

  it('ningun producto individual es a la vez un pack', () => {
    for (const individual of Object.keys(REG.individualAPacks)) {
      expect(individual in REG.packs).toBe(false);
    }
  });

  it('ningun individual repite el mismo pack dos veces', () => {
    for (const packs of Object.values(REG.individualAPacks)) {
      expect(new Set(packs).size).toBe(packs.length);
    }
  });

  it('todo pack del registro tiene un tamaño mayor que cero', () => {
    for (const cfg of Object.values(REG.packs)) {
      expect(cfg.totalUnits).toBeGreaterThan(0);
    }
  });

  it('las botellas ofrecen las tres presentaciones y las latas solo el tobo', () => {
    expect(packsParaProducto(REG, 'prod-botella-a')).toEqual([
      'pack-tobo-12',
      'pack-media-18',
      'pack-caja-36',
    ]);
    expect(packsParaProducto(REG, 'prod-lata-a')).toEqual(['pack-lata-12']);
  });

  it('un producto sin pack devuelve lista vacia, no undefined', () => {
    expect(packsParaProducto(REG, 'producto-sin-pack')).toEqual([]);
    expect(packsParaProducto(REG, 'constructor')).toEqual([]);
  });

  it('getPackConfig devuelve el tamaño del pack o undefined', () => {
    expect(getPackConfig(REG, 'pack-tobo-12')?.totalUnits).toBe(12);
    expect(getPackConfig(REG, 'prod-botella-a')).toBeUndefined();
    expect(getPackConfig(REGISTRO_PACKS_VACIO, 'pack-tobo-12')).toBeUndefined();
  });
});

describe('normalizarRegistroPacks', () => {
  it('sin documento el registro es vacío: ningun pack, ninguna conversion', () => {
    expect(normalizarRegistroPacks(undefined)).toEqual(REGISTRO_PACKS_VACIO);
    expect(normalizarRegistroPacks(null)).toEqual(REGISTRO_PACKS_VACIO);
    expect(normalizarRegistroPacks('basura')).toEqual(REGISTRO_PACKS_VACIO);
  });

  it('descarta packs con tamaño inválido o fuera de rango', () => {
    const r = normalizarRegistroPacks({
      packs: {
        bueno: { totalUnits: 12, label: 'Bueno' },
        cero: { totalUnits: 0, label: 'Cero' },
        decimal: { totalUnits: 1.5, label: 'Decimal' },
        enorme: { totalUnits: 5000, label: 'Enorme' },
        texto: { totalUnits: 'doce', label: 'Texto' },
        nulo: null,
      },
    });
    expect(Object.keys(r.packs)).toEqual(['bueno']);
  });

  it('si el pack no trae etiqueta, usa su ID', () => {
    const r = normalizarRegistroPacks({
      packs: { 'pack-x': { totalUnits: 6 } },
    });
    expect(r.packs['pack-x']).toEqual({ totalUnits: 6, label: 'pack-x' });
  });

  it('quita de cada producto los packs que no existen en el registro', () => {
    const r = normalizarRegistroPacks({
      packs: { 'pack-x': { totalUnits: 6, label: 'X' } },
      individualAPacks: {
        'prod-a': ['pack-x', 'pack-fantasma'],
        'prod-b': ['pack-fantasma'],
      },
    });
    expect(r.individualAPacks).toEqual({ 'prod-a': ['pack-x'] });
  });

  it('no repite un pack ni acepta valores que no son texto', () => {
    const r = normalizarRegistroPacks({
      packs: { 'pack-x': { totalUnits: 6, label: 'X' } },
      individualAPacks: { 'prod-a': ['pack-x', 'pack-x', 7, null] },
    });
    expect(r.individualAPacks['prod-a']).toEqual(['pack-x']);
  });
});
