import { planProduction } from './production.helper';
import type { ProductForRecipeCost } from './recipe-cost.helper';

/**
 * Reglas del dueño (05/08/2026):
 *  - producir SIEMPRE descuenta la receta;
 *  - sin receta cargada NO se puede producir, y el mensaje debe decir que falta;
 *  - si no alcanza el crudo se registra igual y se avisa (la masa ya existe).
 */
describe('plan de produccion', () => {
  const harina: ProductForRecipeCost = {
    _id: 'harina',
    name: 'Harina',
    cost: 2, // $2 el kilo
    presentation: 'Kg',
    presentationQuantity: 1,
  };
  const masa: ProductForRecipeCost = {
    _id: 'masa-mediana',
    name: 'Masa mediana',
    ingredients: [{ productId: 'harina', quantity: 250, unit: 'GR' }],
  };
  const catalogo = new Map<string, ProductForRecipeCost>([
    ['harina', harina],
    ['masa-mediana', masa],
  ]);

  it('descuenta la receta multiplicada por lo elaborado', () => {
    const plan = planProduction(masa, catalogo, 20, 'UND');
    expect(plan.blockers).toHaveLength(0);
    expect(plan.consumptions).toHaveLength(1);
    expect(plan.consumptions[0].productId).toBe('harina');
    expect(plan.consumptions[0].qtyBase).toBe(5000); // 250 gr x 20 masas
    expect(plan.output.qty).toBe(20);
  });

  it('cuesta lo que costo el crudo que consumio', () => {
    const plan = planProduction(masa, catalogo, 20, 'UND');
    // 250 gr a $2/kg = $0.50 por masa
    expect(plan.output.unitCost).toBeCloseTo(0.5, 4);
  });

  it('BLOQUEA si el elaborado no tiene receta y dice que falta', () => {
    const sinReceta: ProductForRecipeCost = {
      _id: 'salsa',
      name: 'Salsa napolitana',
    };
    const plan = planProduction(sinReceta, catalogo, 5, 'ML');
    expect(plan.blockers.length).toBeGreaterThan(0);
    expect(plan.blockers[0]).toContain('Salsa napolitana');
    expect(plan.blockers[0]).toContain('receta');
    expect(plan.consumptions).toHaveLength(0);
  });

  it('avisa cuando el crudo queda negativo, pero NO bloquea', () => {
    const stock = new Map([['harina', 3000]]); // solo 3 kg para 5 kg de receta
    const plan = planProduction(masa, catalogo, 20, 'UND', stock);
    expect(plan.blockers).toHaveLength(0); // la masa ya existe: se registra
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain('Harina');
    expect(plan.warnings[0]).toContain('-2000');
    expect(plan.consumptions[0].resultingStock).toBe(-2000);
  });

  it('no avisa cuando el stock alcanza', () => {
    const stock = new Map([['harina', 20000]]);
    const plan = planProduction(masa, catalogo, 20, 'UND', stock);
    expect(plan.warnings).toHaveLength(0);
    expect(plan.consumptions[0].resultingStock).toBe(15000);
  });

  it('rechaza cantidades invalidas', () => {
    expect(planProduction(masa, catalogo, 0, 'UND').blockers[0]).toContain(
      'mayor que cero',
    );
    expect(
      planProduction(masa, catalogo, -5, 'UND').blockers.length,
    ).toBeGreaterThan(0);
  });

  it('rechaza un producto que no existe', () => {
    const plan = planProduction(undefined, catalogo, 10, 'UND');
    expect(plan.blockers[0]).toContain('no existe');
  });

  it('bloquea si la receta apunta a un insumo inexistente', () => {
    const rota: ProductForRecipeCost = {
      _id: 'x',
      name: 'Masa rota',
      ingredients: [{ productId: 'fantasma', quantity: 100, unit: 'GR' }],
    };
    const plan = planProduction(rota, catalogo, 1, 'UND');
    expect(plan.blockers.length).toBeGreaterThan(0);
  });
});
