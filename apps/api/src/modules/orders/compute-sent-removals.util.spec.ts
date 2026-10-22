import { REGISTRO_PACKS_PRUEBA } from './registro-packs.fixture';
import { computeSentRemovals } from './compute-sent-removals.util';

describe('computeSentRemovals — candado de unidades ya comandadas', () => {
  it('quitar unidades NO comandadas (sentQty 0) no requiere autorizacion', () => {
    const old = [{ productId: 'P', name: 'Pizza', quantity: 3, sentQty: 0 }];
    const next = [{ productId: 'P', name: 'Pizza', quantity: 1, sentQty: 0 }];
    expect(computeSentRemovals(old, next, REGISTRO_PACKS_PRUEBA)).toEqual([]);
  });

  it('reducir por debajo de lo comandado devuelve la baja comandada', () => {
    const old = [
      {
        productId: 'P',
        name: 'Pizza',
        quantity: 3,
        sentQty: 3,
        unitPrice: 10,
        station: 'KITCHEN',
      },
    ];
    const next = [{ productId: 'P', name: 'Pizza', quantity: 1, sentQty: 3 }];
    expect(computeSentRemovals(old, next, REGISTRO_PACKS_PRUEBA)).toEqual([
      {
        productId: 'P',
        name: 'Pizza',
        qty: 2,
        unitPrice: 10,
        station: 'KITCHEN',
      },
    ]);
  });

  it('eliminar por completo un producto comandado', () => {
    const old = [
      {
        productId: 'B',
        name: 'Cerveza',
        quantity: 2,
        sentQty: 2,
        unitPrice: 3,
      },
    ];
    const next: Array<Record<string, unknown>> = [];
    expect(computeSentRemovals(old, next, REGISTRO_PACKS_PRUEBA)).toEqual([
      { productId: 'B', name: 'Cerveza', qty: 2, unitPrice: 3, station: null },
    ]);
  });

  it('sentBefore se acota por qty (sent > qty no infla la baja)', () => {
    const old = [{ productId: 'P', name: 'X', quantity: 2, sentQty: 5 }];
    const next: Array<Record<string, unknown>> = [];
    const [r] = computeSentRemovals(old, next, REGISTRO_PACKS_PRUEBA);
    expect(r.qty).toBe(2);
  });

  it('agrega cantidades por producto (lineas repetidas)', () => {
    const old = [
      { productId: 'P', name: 'Pizza', quantity: 1, sentQty: 1 },
      { productId: 'P', name: 'Pizza', quantity: 1, sentQty: 1 },
    ];
    const next: Array<Record<string, unknown>> = [];
    const [r] = computeSentRemovals(old, next, REGISTRO_PACKS_PRUEBA);
    expect(r.qty).toBe(2);
  });

  it('usa productName como fallback del nombre y station null si falta', () => {
    const old = [
      { productId: 'P', productName: 'Refresco', quantity: 1, sentQty: 1 },
    ];
    const [r] = computeSentRemovals(old, [], REGISTRO_PACKS_PRUEBA);
    expect(r.name).toBe('Refresco');
    expect(r.station).toBeNull();
  });

  it('mantener o subir la cantidad comandada no genera baja', () => {
    const old = [{ productId: 'P', name: 'X', quantity: 2, sentQty: 2 }];
    const next = [{ productId: 'P', name: 'X', quantity: 4, sentQty: 2 }];
    expect(computeSentRemovals(old, next, REGISTRO_PACKS_PRUEBA)).toEqual([]);
  });
});

/**
 * Convertir a pack hace desaparecer unidades del producto suelto. Por productId
 * eso es indistinguible de borrarlas, asi que el candado necesita saber que la
 * baja la explica un pack NUEVO — y solo uno nuevo.
 */
describe('computeSentRemovals — conversion a pack', () => {
  const PILSEN = 'prod-botella-b';
  const TOBO = 'pack-tobo-12';
  const MEDIA_CAJA = 'pack-media-18';

  const linea = (
    productId: string,
    quantity: number,
    sentQty: number,
    extra: Record<string, unknown> = {},
  ) => ({ productId, name: productId, quantity, sentQty, ...extra });

  it('convertir 12 comandadas en un tobo nuevo NO pide PIN', () => {
    const antes = [linea(PILSEN, 12, 12)];
    const despues = [linea(TOBO, 12, 12)];

    expect(computeSentRemovals(antes, despues, REGISTRO_PACKS_PRUEBA)).toEqual(
      [],
    );
  });

  it('un tobo que YA estaba no autoriza borrar cervezas comandadas', () => {
    // El agujero de la primera version: compensaba con TODOS los packs
    // presentes despues, no con los agregados. Aca no se convirtio nada — se
    // dieron de baja 12 unidades ya despachadas y el tobo preexistente las
    // tapaba. Eso es producto que salio de la barra y desaparece de la cuenta.
    const antes = [linea(PILSEN, 12, 12), linea(TOBO, 12, 12)];
    const despues = [linea(TOBO, 12, 12)];

    const bajas = computeSentRemovals(antes, despues, REGISTRO_PACKS_PRUEBA);

    expect(bajas).toHaveLength(1);
    expect(bajas[0].productId).toBe(PILSEN);
    expect(bajas[0].qty).toBe(12);
  });

  it('convertir 12 y ademas borrar 6 comandadas SI pide PIN por esas 6', () => {
    const antes = [linea(PILSEN, 18, 18)];
    const despues = [linea(TOBO, 12, 12)];

    const bajas = computeSentRemovals(antes, despues, REGISTRO_PACKS_PRUEBA);

    expect(bajas).toHaveLength(1);
    expect(bajas[0].qty).toBe(6);
  });

  it('con un tobo viejo y uno nuevo, solo el nuevo compensa', () => {
    // 24 Pilsen comandadas y un tobo de antes. El patch convierte 12 (aparece
    // un segundo tobo: 24 unidades de tobo en total) y deja 12 sueltas.
    const antes = [linea(PILSEN, 24, 24), linea(TOBO, 12, 12)];
    const despues = [linea(PILSEN, 12, 12), linea(TOBO, 24, 24)];

    expect(computeSentRemovals(antes, despues, REGISTRO_PACKS_PRUEBA)).toEqual(
      [],
    );
  });

  it('el pack tiene que ser uno de los del producto, no cualquiera', () => {
    // Un producto que no es pack de la Pilsen no puede tapar la baja.
    const antes = [linea(PILSEN, 12, 12)];
    const despues = [linea('una-hamburguesa', 12, 12)];

    expect(
      computeSentRemovals(antes, despues, REGISTRO_PACKS_PRUEBA),
    ).toHaveLength(1);
  });

  it('la media caja tambien compensa, no solo el tobo', () => {
    const antes = [linea(PILSEN, 18, 18)];
    const despues = [linea(MEDIA_CAJA, 18, 18)];

    expect(computeSentRemovals(antes, despues, REGISTRO_PACKS_PRUEBA)).toEqual(
      [],
    );
  });

  it('quitar el tobo tambien pide PIN si estaba comandado', () => {
    // La compensacion no puede volverse un permiso para borrar el pack.
    const antes = [linea(TOBO, 12, 12)];
    const despues: Array<Record<string, unknown>> = [];

    const bajas = computeSentRemovals(antes, despues, REGISTRO_PACKS_PRUEBA);

    expect(bajas).toHaveLength(1);
    expect(bajas[0].productId).toBe(TOBO);
  });
});
