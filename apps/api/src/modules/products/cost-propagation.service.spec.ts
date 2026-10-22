import { CostPropagationService } from './cost-propagation.service';
import { ProductoCosteable } from './cost-propagation.util';

const harina: ProductoCosteable = {
  _id: 'harina',
  name: 'Harina',
  presentation: 'Kilogramo',
  presentationQuantity: 1,
  cost: 1,
};
// Costo nuevo = $1 (1000 g de harina a $1/kg)
const plato = (id: string, costoGuardado: number): ProductoCosteable => ({
  _id: id,
  name: id,
  cost: costoGuardado,
  price: 5,
  isForSale: true,
  ingredients: [{ productId: 'harina', quantity: 1000, unit: 'gr' }],
});

function montar(productos: ProductoCosteable[]) {
  const updateOne = jest.fn().mockReturnValue({ exec: jest.fn() });
  const productModel = {
    find: jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(productos) }),
    }),
    updateOne,
    findOne: jest.fn().mockReturnValue({ lean: () => Promise.resolve(null) }),
    db: { collection: () => ({ findOne: () => Promise.resolve(null) }) },
  };
  const alertUpdate = jest.fn().mockReturnValue({ exec: jest.fn() });
  const alertModel = { updateOne: alertUpdate };
  const service = new CostPropagationService(
    productModel as never,
    alertModel as never,
    // Sin documento `configs/margen_minimo`: el umbral sale del default.
    {
      obtenerCrudo: (_id: string, normalizar: (doc: null) => unknown) =>
        Promise.resolve(normalizar(null)),
    } as never,
  );
  return { service, updateOne, alertUpdate };
}

describe('CostPropagationService.recalcularTodo', () => {
  it('por defecto retiene los cambios sospechosos y aplica los normales', async () => {
    const { service, updateOne } = montar([
      harina,
      plato('normal', 1.2), // 1.2 → 1.0 : -17 %, normal
      plato('roto', 10), // 10 → 1.0 : -90 %, sospechoso
    ]);
    const r = await service.recalcularTodo();
    expect(r.cambios.map((c) => c.productId)).toEqual(['normal']);
    expect(r.retenidos.map((c) => c.productId)).toEqual(['roto']);
    expect(updateOne).toHaveBeenCalledTimes(1);
    expect(updateOne.mock.calls[0][0]).toEqual({ _id: 'normal' });
  });

  it('dryRun calcula igual pero no escribe nada (ni costos ni alertas)', async () => {
    const { service, updateOne, alertUpdate } = montar([
      harina,
      plato('normal', 1.2),
      plato('roto', 10),
    ]);
    const r = await service.recalcularTodo({ dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.cambios).toHaveLength(1);
    expect(r.retenidos).toHaveLength(1);
    expect(updateOne).not.toHaveBeenCalled();
    expect(alertUpdate).not.toHaveBeenCalled();
  });

  it('forzar aplica también los sospechosos', async () => {
    const { service, updateOne } = montar([
      harina,
      plato('normal', 1.2),
      plato('roto', 10),
    ]);
    const r = await service.recalcularTodo({ forzar: true });
    expect(r.retenidos).toEqual([]);
    expect(r.cambios.map((c) => c.productId).sort()).toEqual([
      'normal',
      'roto',
    ]);
    expect(updateOne).toHaveBeenCalledTimes(2);
  });

  it('reporta los platos que no se pudieron costear', async () => {
    const roto: ProductoCosteable = {
      _id: 'sinreceta',
      name: 'Plato con unidad rara',
      cost: 3,
      ingredients: [{ productId: 'harina', quantity: 100, unit: 'ml' }],
    };
    const { service } = montar([harina, roto]);
    const r = await service.recalcularTodo({ dryRun: true });
    expect(r.omitidos).toHaveLength(1);
    expect(r.omitidos[0].issues[0].kind).toBe('unidad-incompatible');
  });
});
