import {
  computeTheoreticalUnitCost,
  expandRecipeIngredients,
  ProductForRecipeCost,
} from './recipe-cost.helper';

const leche: ProductForRecipeCost = {
  _id: 'leche',
  name: 'Leche en polvo',
  cost: 15.59,
  presentation: 'Gramo',
  presentationQuantity: 900,
  gramsPerMl: 0.12,
};
const aceite: ProductForRecipeCost = {
  _id: 'aceite',
  name: 'Aceite',
  cost: 4.3,
  presentation: 'Litro',
  presentationQuantity: 1,
  gramsPerMl: 0.92,
};
const huevo: ProductForRecipeCost = {
  _id: 'huevo',
  name: 'Huevo',
  cost: 6.86,
  presentation: 'Unidad',
  presentationQuantity: 30,
  gramsPerUnit: 55,
};
const harina: ProductForRecipeCost = {
  _id: 'harina',
  name: 'Harina',
  cost: 45,
  presentation: 'Kilogramo',
  presentationQuantity: 45,
};
const sinPrecio: ProductForRecipeCost = {
  _id: 'sinprecio',
  name: 'Sal fina',
  presentation: 'Kilogramo',
  presentationQuantity: 1,
};

function catalogo(...ps: ProductForRecipeCost[]) {
  return new Map(ps.map((p) => [p._id, p]));
}
function plato(
  ingredients: NonNullable<ProductForRecipeCost['ingredients']>,
): ProductForRecipeCost {
  return { _id: 'plato', name: 'Plato', ingredients };
}

describe('expandRecipeIngredients — conversión entre familias', () => {
  it('leche pedida en ml se convierte a gramos con gramsPerMl y SÍ cuesta', () => {
    const r = expandRecipeIngredients(
      plato([{ productId: 'leche', quantity: 100, unit: 'Mililitro' }]),
      catalogo(leche),
    );
    expect(r.errors).toEqual([]);
    expect(r.issues).toEqual([]);
    expect(r.expanded[0].qtyBase).toBeCloseTo(12, 6); // 100 ml × 0.12 g/ml
    // 12 g × (15.59/900) = 0.2079
    expect(
      r.expanded[0].qtyBase * r.expanded[0].costPerBase,
    ).toBeCloseTo(0.2079, 3);
  });

  it('aceite pedido en gramos se convierte a ml (insumo por Litro)', () => {
    const r = expandRecipeIngredients(
      plato([{ productId: 'aceite', quantity: 92, unit: 'Gramo' }]),
      catalogo(aceite),
    );
    expect(r.expanded[0].qtyBase).toBeCloseTo(100, 6);
    expect(r.expanded[0].baseUnit).toBe('ML');
  });

  it('huevo pedido en gramos se convierte a unidades', () => {
    const r = expandRecipeIngredients(
      plato([{ productId: 'huevo', quantity: 110, unit: 'Gramo' }]),
      catalogo(huevo),
    );
    expect(r.expanded[0].qtyBase).toBeCloseTo(2, 6);
  });

  it('miligramos de un insumo por Kilogramo', () => {
    const r = expandRecipeIngredients(
      plato([{ productId: 'harina', quantity: 500000, unit: 'mg' }]),
      catalogo(harina),
    );
    expect(r.expanded[0].qtyBase).toBeCloseTo(500, 6);
  });
});

describe('expandRecipeIngredients — líneas que no se pueden costear salen como issues', () => {
  it('sin factor de conversión: unidad-incompatible con pista de qué cargar', () => {
    const r = expandRecipeIngredients(
      plato([{ productId: 'harina', quantity: 100, unit: 'Mililitro' }]),
      catalogo(harina),
    );
    expect(r.expanded).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].reason).toMatch(/^unidad-incompatible:/);
    expect(r.issues).toEqual([
      expect.objectContaining({
        kind: 'unidad-incompatible',
        ingredientId: 'harina',
        insumoName: 'Harina',
        unit: 'Mililitro',
        baseUnit: 'GR',
        falta: 'gramsPerMl',
      }),
    ]);
  });

  it('gramos de un insumo por Unidad sin gramsPerUnit pide gramsPerUnit', () => {
    const sinPeso = { ...huevo, gramsPerUnit: undefined };
    const r = expandRecipeIngredients(
      plato([{ productId: 'huevo', quantity: 110, unit: 'Gramo' }]),
      catalogo(sinPeso),
    );
    expect(r.issues[0]).toMatchObject({
      kind: 'unidad-incompatible',
      falta: 'gramsPerUnit',
    });
  });

  it('7UP pedida en ml sin mlPerUnit pide cuántos ml tiene una unidad', () => {
    const lata: ProductForRecipeCost = {
      _id: 'lata',
      name: '7UP',
      cost: 0.6,
      presentation: 'Unidad',
      presentationQuantity: 1,
    };
    const r = expandRecipeIngredients(
      plato([{ productId: 'lata', quantity: 100, unit: 'Mililitro' }]),
      catalogo(lata),
    );
    expect(r.issues[0]).toMatchObject({
      kind: 'unidad-incompatible',
      falta: 'mlPerUnit',
    });
    const conLata = { ...lata, mlPerUnit: 355 };
    const ok = expandRecipeIngredients(
      plato([{ productId: 'lata', quantity: 100, unit: 'Mililitro' }]),
      catalogo(conLata),
    );
    expect(ok.issues).toEqual([]);
    expect(ok.expanded[0].qtyBase).toBeCloseTo(100 / 355, 6);
  });

  it('ingrediente que no existe', () => {
    const r = expandRecipeIngredients(
      plato([{ productId: 'fantasma', quantity: 1, unit: 'Gramo' }]),
      catalogo(harina),
    );
    expect(r.issues).toEqual([
      expect.objectContaining({
        kind: 'insumo-inexistente',
        ingredientId: 'fantasma',
      }),
    ]);
  });

  it('insumo sin precio NO bloquea pero avisa sin-costo', () => {
    const r = expandRecipeIngredients(
      plato([{ productId: 'sinprecio', quantity: 5, unit: 'Gramo' }]),
      catalogo(sinPrecio),
    );
    expect(r.errors).toEqual([]);
    expect(r.expanded).toHaveLength(1);
    expect(r.issues).toEqual([
      expect.objectContaining({ kind: 'sin-costo', ingredientId: 'sinprecio' }),
    ]);
  });
});

describe('computeTheoreticalUnitCost con conversión', () => {
  it('antes la leche en ml tumbaba el costo del plato entero; ahora suma', () => {
    const p = plato([
      { productId: 'harina', quantity: 1000, unit: 'Gramo' },
      { productId: 'leche', quantity: 100, unit: 'Mililitro' },
    ]);
    const costo = computeTheoreticalUnitCost(p, 1, catalogo(harina, leche));
    // harina: 1000 g × 45/45/1000 = 1.00 ; leche: 12 g × 15.59/900 = 0.2079
    expect(costo).toBeCloseTo(1.2079, 3);
  });

  it('sigue siendo todo-o-nada cuando falta el factor', () => {
    const p = plato([
      { productId: 'harina', quantity: 1000, unit: 'Gramo' },
      { productId: 'aceite', quantity: 100, unit: 'Gramo' },
    ]);
    const sinDensidad = { ...aceite, gramsPerMl: undefined };
    expect(
      computeTheoreticalUnitCost(p, 1, catalogo(harina, sinDensidad)),
    ).toBeNull();
  });

  it('aplica la merma sobre la cantidad convertida', () => {
    const p = plato([
      { productId: 'huevo', quantity: 110, unit: 'Gramo', wastePercentage: 10 },
    ]);
    const costo = computeTheoreticalUnitCost(p, 1, catalogo(huevo));
    // 2 u × 1.1 × (6.86/30)
    expect(costo).toBeCloseTo(2 * 1.1 * (6.86 / 30), 6);
  });
});
