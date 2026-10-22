import {
  idsDeIngredientesQuitados,
  nombrarIngredientesQuitados,
} from './ingredientes-quitados.util';

// Ids reales del catalogo, para que el test se parezca al papel de verdad.
const CEBOLLA = 'prod-botella-a';
const TOMATE = 'prod-botella-b';

const catalogo = new Map<string, string>([
  [CEBOLLA, 'Cebolla'],
  [TOMATE, 'Tomate'],
]);

describe('ingredientes quitados en la comanda', () => {
  it('el cocinero lee el NOMBRE, no el id', () => {
    const items = [
      {
        name: 'Hamburguesa',
        customizations: { removedIngredients: [CEBOLLA] },
      },
    ];
    const r = nombrarIngredientesQuitados(items, catalogo);
    expect(r[0].customizations.removedIngredients).toEqual(['Cebolla']);
  });

  it('un id que no esta en el catalogo se conserva: mejor un id que perder el aviso', () => {
    const items = [
      {
        name: 'Pizza',
        customizations: { removedIngredients: ['fantasma-99'] },
      },
    ];
    const r = nombrarIngredientesQuitados(items, catalogo);
    expect(r[0].customizations.removedIngredients).toEqual(['fantasma-99']);
  });

  it('no toca el item que no quita nada', () => {
    const items = [{ name: 'Pepsi' }];
    const r = nombrarIngredientesQuitados(items, catalogo);
    expect(r[0]).toBe(items[0]);
  });

  it('no muta el arreglo original', () => {
    const items = [
      {
        name: 'Hamburguesa',
        customizations: { removedIngredients: [CEBOLLA] },
      },
    ];
    nombrarIngredientesQuitados(items, catalogo);
    expect(items[0].customizations.removedIngredients).toEqual([CEBOLLA]);
  });

  it('conserva el resto de la personalizacion del item', () => {
    const items = [
      {
        name: 'Hamburguesa',
        quantity: 2,
        customizations: { removedIngredients: [TOMATE], extra: 'doble queso' },
      },
    ];
    const r = nombrarIngredientesQuitados(items, catalogo) as Array<{
      quantity: number;
      customizations: { removedIngredients: string[]; extra: string };
    }>;
    expect(r[0].quantity).toBe(2);
    expect(r[0].customizations.extra).toBe('doble queso');
    expect(r[0].customizations.removedIngredients).toEqual(['Tomate']);
  });

  it('descarta la cadena vacia, que en el ticket sale como "SIN  "', () => {
    const items = [
      {
        name: 'Perro',
        customizations: { removedIngredients: ['', '   ', CEBOLLA] },
      },
    ];
    const r = nombrarIngredientesQuitados(items, catalogo);
    expect(r[0].customizations.removedIngredients).toEqual(['Cebolla']);
  });

  it('aguanta basura sin romper la impresion de la comanda', () => {
    const items = [
      { name: 'A', customizations: null },
      { name: 'B', customizations: { removedIngredients: 'no-es-arreglo' } },
      { name: 'C', customizations: { removedIngredients: [42, null] } },
      null,
    ];
    expect(() =>
      nombrarIngredientesQuitados(items as unknown[], catalogo),
    ).not.toThrow();
    expect(idsDeIngredientesQuitados(items as unknown[])).toEqual([]);
  });

  it('junta los ids de todos los items, sin repetir, para una sola consulta', () => {
    const items = [
      { customizations: { removedIngredients: [CEBOLLA, TOMATE] } },
      { customizations: { removedIngredients: [CEBOLLA] } },
      { name: 'sin nada' },
    ];
    expect(idsDeIngredientesQuitados(items).sort()).toEqual(
      [CEBOLLA, TOMATE].sort(),
    );
  });

  it('sin items no explota', () => {
    expect(idsDeIngredientesQuitados(undefined)).toEqual([]);
    expect(nombrarIngredientesQuitados(undefined, catalogo)).toEqual([]);
  });
});
