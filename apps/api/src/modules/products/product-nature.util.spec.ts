import { ProductTypeEnum } from '@odin6/types';
import {
  InsumoParaValidar,
  naturalezaDe,
  validarNaturaleza,
} from './product-nature.util';

/** Insumo tal como está en el catálogo real (costo por unidad de compra). */
const insumo = (
  _id: string,
  name: string,
  presentation: string,
  extra: Partial<InsumoParaValidar> = {},
): InsumoParaValidar => ({
  _id,
  name,
  presentation,
  presentationQuantity: 1,
  cost: 10,
  isActive: true,
  ...extra,
});

const catalogo = (...insumos: InsumoParaValidar[]) =>
  new Map(insumos.map((i) => [String(i._id), i]));

const CARNE = insumo('carne', 'Carne de Res Molida', 'Kilogramo');
const PAN = insumo('pan', 'Pan de Hamburguesa', 'Unidad');

describe('naturalezaDe', () => {
  it('un producto con receta es preparado aunque esté marcado BASE', () => {
    // Pasó de verdad: 21 productos así, y la ficha web les borraba la receta.
    expect(
      naturalezaDe({
        type: ProductTypeEnum.BASE,
        ingredients: [{ productId: 'carne' }],
      }),
    ).toBe('preparado');
  });

  it('BASE con isForInventory true es insumo', () => {
    expect(
      naturalezaDe({ type: ProductTypeEnum.BASE, isForInventory: true }),
    ).toBe('insumo');
  });

  it('SERVICIO es servicio', () => {
    expect(naturalezaDe({ type: ProductTypeEnum.SERVICE })).toBe('servicio');
  });

  it('isForInventory false NO es servicio: es pendiente', () => {
    // false era el valor por DEFECTO del formulario viejo: 59 productos lo
    // tenían sin que nadie decidiera nada.
    expect(
      naturalezaDe({ type: ProductTypeEnum.BASE, isForInventory: false }),
    ).toBe('pendiente');
  });

  it('BASE sin el campo isForInventory es pendiente', () => {
    expect(naturalezaDe({ type: ProductTypeEnum.BASE })).toBe('pendiente');
  });

  it('ignora los ingredientes vacíos que mandan los clientes viejos', () => {
    expect(
      naturalezaDe({
        type: ProductTypeEnum.BASE,
        isForInventory: true,
        ingredients: [null, undefined, {}] as never,
      }),
    ).toBe('insumo');
  });
});

describe('validarNaturaleza', () => {
  it('un preparado sin ingredientes no se puede guardar', () => {
    const r = validarNaturaleza(
      { type: ProductTypeEnum.MIXED, ingredients: [] },
      catalogo(),
    );
    expect(r.ok).toBe(false);
    expect(r.errores[0]).toContain('al menos un ingrediente');
  });

  it('un preparado válido deriva isForInventory false', () => {
    const r = validarNaturaleza(
      {
        type: ProductTypeEnum.MIXED,
        ingredients: [{ productId: 'carne', quantity: 150, unit: 'gr' }],
      } as never,
      catalogo(CARNE),
    );
    expect(r.ok).toBe(true);
    expect(r.cambios.isForInventory).toBe(false);
    expect(r.naturaleza).toBe('preparado');
  });

  it('guardar una receta sobre un BASE lo convierte en COMPUESTO', () => {
    // Arregla el bug de products.service.ts:263, que escribía 'MIXED' (un valor
    // que no existe en el enum y Mongoose no valida en los updates).
    const r = validarNaturaleza(
      {
        type: ProductTypeEnum.BASE,
        ingredients: [{ productId: 'pan', quantity: 1, unit: 'und' }],
      } as never,
      catalogo(PAN),
    );
    expect(r.cambios.type).toBe('COMPUESTO');
    expect(r.ok).toBe(true);
  });

  it('un insumo deriva isForInventory true y exige presentación', () => {
    const conPresentacion = validarNaturaleza(
      { type: ProductTypeEnum.BASE, presentation: 'Unidad' },
      catalogo(),
    );
    expect(conPresentacion.ok).toBe(true);
    expect(conPresentacion.cambios.isForInventory).toBe(true);

    const sinPresentacion = validarNaturaleza(
      { type: ProductTypeEnum.BASE },
      catalogo(),
    );
    expect(sinPresentacion.ok).toBe(false);
    expect(sinPresentacion.errores[0]).toContain('presentación');
  });

  it('un servicio no puede llevar receta', () => {
    const r = validarNaturaleza(
      {
        type: ProductTypeEnum.SERVICE,
        ingredients: [{ productId: 'carne', quantity: 1, unit: 'und' }],
      } as never,
      catalogo(CARNE),
    );
    expect(r.ok).toBe(false);
    expect(r.errores[0]).toContain('servicio no lleva receta');
  });

  it('un servicio sin receta es válido y no toca inventario', () => {
    const r = validarNaturaleza({ type: ProductTypeEnum.SERVICE }, catalogo());
    expect(r.ok).toBe(true);
    expect(r.cambios.isForInventory).toBe(false);
    expect(r.naturaleza).toBe('servicio');
  });

  it('sin naturaleza elegida pide que se elija una', () => {
    const r = validarNaturaleza({}, catalogo());
    expect(r.ok).toBe(false);
    expect(r.errores[0]).toContain('Elige qué es el producto');
    expect(r.naturaleza).toBe('pendiente');
  });

  it('rechaza la unidad incompatible con el mensaje de cómo se compra', () => {
    // El caso real de "Combo de Hamburguesas": Carne Molida en "Unidad" sobre un
    // insumo comprado por Kilogramo. Se guardaba igual y nunca descontaba.
    const r = validarNaturaleza(
      {
        type: ProductTypeEnum.MIXED,
        ingredients: [{ productId: 'carne', quantity: 1, unit: 'und' }],
      } as never,
      catalogo(CARNE),
    );
    expect(r.ok).toBe(false);
    expect(r.errores.join(' ')).toContain('se compra por Kilogramo');
  });

  it('acepta gramos sobre un insumo comprado por kilo', () => {
    const r = validarNaturaleza(
      {
        type: ProductTypeEnum.MIXED,
        ingredients: [{ productId: 'carne', quantity: 150, unit: 'Gramo' }],
      } as never,
      catalogo(CARNE),
    );
    expect(r.ok).toBe(true);
  });

  it('rechaza un ingrediente inexistente', () => {
    const r = validarNaturaleza(
      {
        type: ProductTypeEnum.MIXED,
        ingredients: [{ productId: 'fantasma', quantity: 1, unit: 'und' }],
      } as never,
      catalogo(CARNE),
    );
    expect(r.ok).toBe(false);
    expect(r.errores.join(' ')).toContain('no existe en el catálogo');
  });

  it('rechaza un ingrediente inactivo', () => {
    const r = validarNaturaleza(
      {
        type: ProductTypeEnum.MIXED,
        ingredients: [{ productId: 'pan', quantity: 1, unit: 'und' }],
      } as never,
      catalogo(
        insumo('pan', 'Pan de Hamburguesa', 'Unidad', { isActive: false }),
      ),
    );
    expect(r.ok).toBe(false);
    expect(r.errores.join(' ')).toContain('está inactivo');
  });

  it('rechaza que un producto sea ingrediente de sí mismo', () => {
    const r = validarNaturaleza(
      {
        _id: 'carne',
        type: ProductTypeEnum.MIXED,
        ingredients: [{ productId: 'carne', quantity: 1, unit: 'kg' }],
      } as never,
      catalogo(CARNE),
    );
    expect(r.ok).toBe(false);
    expect(r.errores.join(' ')).toContain('ingrediente de sí mismo');
  });

  it('al guardar bien una naturaleza deja de estar pendiente', () => {
    const r = validarNaturaleza(
      { type: ProductTypeEnum.BASE, presentation: 'Unidad' },
      catalogo(),
    );
    expect(r.cambios.naturalezaPendiente).toBe(false);
  });

  it('devuelve siempre el type final, aunque no lo haya cambiado', () => {
    // Sin esto, quitarle la receta a un preparado y marcarlo "directo" lo
    // dejaba COMPUESTO con isForInventory true: el estado contradictorio que
    // este helper existe para eliminar (visto el 03/09 contra la API local).
    const r = validarNaturaleza(
      { type: ProductTypeEnum.BASE, presentation: 'Unidad' },
      catalogo(),
    );
    expect(r.cambios.type).toBe('BASE');
    expect(r.cambios.isForInventory).toBe(true);
  });

  it('si hay errores NO marca el producto como resuelto', () => {
    const r = validarNaturaleza(
      { type: ProductTypeEnum.MIXED, ingredients: [] },
      catalogo(),
    );
    expect(r.cambios.naturalezaPendiente).toBeUndefined();
  });

  it('un semielaborado (Masa de Pizza) vale como ingrediente', () => {
    // La auditoría vieja los daba por inexistentes porque filtraba insumos por
    // isForInventory || type BASE. Aquí entra en el mapa como cualquier otro.
    const masa = insumo('masa', 'Masa de Pizza', 'Gramo', {
      ingredients: [{ productId: 'harina', quantity: 3000, unit: 'gr' }],
    });
    const r = validarNaturaleza(
      {
        type: ProductTypeEnum.MIXED,
        ingredients: [{ productId: 'masa', quantity: 400, unit: 'gr' }],
      } as never,
      catalogo(masa),
    );
    expect(r.ok).toBe(true);
  });
});
