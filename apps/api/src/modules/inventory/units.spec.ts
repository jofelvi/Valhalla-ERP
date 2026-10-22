import {
  baseUnitOf,
  toBaseQty,
  costPerBaseUnit,
  roundUnitCost,
  IncompatibleUnitError,
  convertQty,
  missingConversion,
} from './units';

describe('units — unidades canónicas', () => {
  describe('baseUnitOf', () => {
    it('mapea presentaciones de peso a GR', () => {
      expect(baseUnitOf('Kilogramo')).toBe('GR');
      expect(baseUnitOf('Gramo')).toBe('GR');
      expect(baseUnitOf('kg')).toBe('GR'); // alias tolerante
    });
    it('mapea presentaciones de volumen a ML', () => {
      expect(baseUnitOf('Litro')).toBe('ML');
      expect(baseUnitOf('Mililitro')).toBe('ML');
    });
    it('mapea contables a UND (incluye contenedores)', () => {
      expect(baseUnitOf('Unidad')).toBe('UND');
      expect(baseUnitOf('Lata')).toBe('UND');
      expect(baseUnitOf('Caja')).toBe('UND');
      expect(baseUnitOf('Docena')).toBe('UND');
      expect(baseUnitOf('desconocida')).toBe('UND'); // default seguro
    });
  });

  describe('toBaseQty', () => {
    it('convierte peso a GR', () => {
      expect(toBaseQty(3, 'Kilogramo', 'GR')).toBe(3000);
      expect(toBaseQty(400, 'Gramo', 'GR')).toBe(400);
      expect(toBaseQty(0.5, 'kg', 'GR')).toBe(500);
    });
    it('convierte volumen a ML', () => {
      expect(toBaseQty(2, 'Litro', 'ML')).toBe(2000);
      expect(toBaseQty(40, 'Mililitro', 'ML')).toBe(40);
    });
    it('convierte contables a UND (docena=12, media docena=6)', () => {
      expect(toBaseQty(2, 'Docena', 'UND')).toBe(24);
      expect(toBaseQty(1, 'Unidad', 'UND')).toBe(1);
    });
    it('lanza IncompatibleUnitError al cruzar categorías', () => {
      // el bug real: 40 "Gramo" de un insumo cuya base es ML (aceite por Litro)
      expect(() => toBaseQty(40, 'Gramo', 'ML')).toThrow(IncompatibleUnitError);
      expect(() => toBaseQty(20, 'Gramo', 'UND')).toThrow(
        IncompatibleUnitError,
      );
      expect(() => toBaseQty(1, 'Litro', 'GR')).toThrow(IncompatibleUnitError);
    });
  });

  describe('costPerBaseUnit', () => {
    it('deriva costo por gramo desde saco: harina 42.44 el saco de 45kg', () => {
      // presentation Kilogramo + presentationQuantity 45 → 42.44/45 = 0.943/kg → /1000 por GR
      expect(costPerBaseUnit(42.44, 'Kilogramo', 45)).toBeCloseTo(0.000943, 6);
    });
    it('deriva costo por unidad desde cartón: huevos 6.86 x 30', () => {
      expect(costPerBaseUnit(6.86, 'Unidad', 30)).toBeCloseTo(0.2287, 4);
    });
    it('deriva costo por ml desde litro', () => {
      expect(costPerBaseUnit(4.3, 'Litro', 1)).toBeCloseTo(0.0043, 6);
    });
    it('devuelve 0 con costo indefinido o contenido 0', () => {
      expect(costPerBaseUnit(undefined, 'Kilogramo', 45)).toBe(0);
      expect(costPerBaseUnit(10, 'Kilogramo', 0)).toBe(0);
    });
  });

  describe('galón con tilde', () => {
    it('es volumen, no contable (el enum del front lo guarda con tilde)', () => {
      expect(baseUnitOf('Galón')).toBe('ML');
      expect(toBaseQty(1, 'Galón', 'ML')).toBeCloseTo(3785.41, 2);
    });
  });

  describe('miligramos', () => {
    it('mg es peso: 500 mg = 0.5 g', () => {
      expect(baseUnitOf('mg')).toBe('GR');
      expect(baseUnitOf('Miligramo')).toBe('GR');
      expect(toBaseQty(500, 'mg', 'GR')).toBeCloseTo(0.5, 6);
      expect(toBaseQty(2000, 'Miligramo', 'GR')).toBeCloseTo(2, 6);
    });
  });

  describe('convertQty — peso, volumen y unidad con los factores del insumo', () => {
    it('sin factores se comporta como toBaseQty', () => {
      expect(convertQty(3, 'Kilogramo', 'GR')).toBe(3000);
      expect(() => convertQty(40, 'Gramo', 'ML')).toThrow(
        IncompatibleUnitError,
      );
    });
    it('gramos → ml con gramsPerMl (leche 1.03 g/ml)', () => {
      expect(convertQty(103, 'Gramo', 'ML', { gramsPerMl: 1.03 })).toBeCloseTo(
        100,
        6,
      );
    });
    it('ml → gramos con gramsPerMl (aceite 0.92)', () => {
      expect(
        convertQty(100, 'Mililitro', 'GR', { gramsPerMl: 0.92 }),
      ).toBeCloseTo(92, 6);
      expect(convertQty(1, 'Litro', 'GR', { gramsPerMl: 0.92 })).toBeCloseTo(
        920,
        6,
      );
    });
    it('unidad → gramos con gramsPerUnit (huevo 55 g)', () => {
      expect(convertQty(2, 'Unidad', 'GR', { gramsPerUnit: 55 })).toBeCloseTo(
        110,
        6,
      );
    });
    it('gramos → unidad con gramsPerUnit (110 g de huevo = 2 u)', () => {
      expect(convertQty(110, 'Gramo', 'UND', { gramsPerUnit: 55 })).toBeCloseTo(
        2,
        6,
      );
      expect(
        convertQty(0.11, 'Kilogramo', 'UND', { gramsPerUnit: 55 }),
      ).toBeCloseTo(2, 6);
    });
    it('mg → unidad pasa por gramos', () => {
      expect(convertQty(110000, 'mg', 'UND', { gramsPerUnit: 55 })).toBeCloseTo(
        2,
        6,
      );
    });
    it('unidad ↔ ml con mlPerUnit (lata de 355 ml)', () => {
      expect(convertQty(1, 'Unidad', 'ML', { mlPerUnit: 355 })).toBeCloseTo(
        355,
        6,
      );
      expect(convertQty(710, 'Mililitro', 'UND', { mlPerUnit: 355 })).toBeCloseTo(
        2,
        6,
      );
      expect(convertQty(0.355, 'Litro', 'UND', { mlPerUnit: 355 })).toBeCloseTo(
        1,
        6,
      );
    });
    it('unidad ↔ ml también pasa por gramos si hay gramsPerUnit y gramsPerMl', () => {
      expect(
        convertQty(1, 'Unidad', 'ML', { gramsPerUnit: 50, gramsPerMl: 1 }),
      ).toBeCloseTo(50, 6);
    });
    it('unidad ↔ ml con un solo factor de gramos no alcanza', () => {
      expect(() =>
        convertQty(1, 'Unidad', 'ML', { gramsPerUnit: 50 }),
      ).toThrow(IncompatibleUnitError);
      expect(missingConversion('UND', 'ML', { gramsPerUnit: 50 })).toBe(
        'mlPerUnit',
      );
    });
    it('un factor en 0, negativo o NaN no cuenta como dato', () => {
      for (const malo of [0, -1, NaN]) {
        expect(() => convertQty(10, 'Gramo', 'ML', { gramsPerMl: malo })).toThrow(
          IncompatibleUnitError,
        );
      }
    });
    it('toBaseQty acepta los factores como 4º parámetro', () => {
      expect(toBaseQty(150, 'Gramo', 'ML', { gramsPerMl: 1.5 })).toBeCloseTo(
        100,
        6,
      );
    });
  });

  describe('roundUnitCost', () => {
    it('preserva costos unitarios pequeños con 8 decimales', () => {
      expect(roundUnitCost(0.000943111111)).toBeCloseTo(0.00094311, 8);
      expect(roundUnitCost(0.0009)).toBe(0.0009);
    });
  });
});
