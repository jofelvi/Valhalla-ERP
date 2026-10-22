import {
  paginarOrdenes,
  LIMITE_DURO_DE_ORDENES,
  LIMITE_POR_DEFECTO_DE_ORDENES,
} from './paginar-ordenes.util';

describe('paginarOrdenes', () => {
  it('sin params: aplica el limite por defecto, nunca "todo"', () => {
    // Esto es lo que impide repetir el 21/09/2026: 4.766 ordenes y 1,57 MB
    // por llamada porque findAll no tenia ni limit ni tope.
    expect(paginarOrdenes()).toEqual({
      limit: LIMITE_POR_DEFECTO_DE_ORDENES,
      skip: 0,
    });
  });

  it('respeta el limite que pide el cliente', () => {
    expect(paginarOrdenes(20)).toEqual({ limit: 20, skip: 0 });
    expect(paginarOrdenes(1)).toEqual({ limit: 1, skip: 0 });
  });

  it('el tope es DURO: pedir de mas no sirve de nada', () => {
    // Un APK viejo o un cliente distraido no puede saltarse el techo.
    expect(paginarOrdenes(99_999).limit).toBe(LIMITE_DURO_DE_ORDENES);
    expect(paginarOrdenes(LIMITE_DURO_DE_ORDENES + 1).limit).toBe(
      LIMITE_DURO_DE_ORDENES,
    );
  });

  it('limit basura, cero o negativo: cae al defecto, no a "sin limite"', () => {
    // El caso peligroso es que un valor invalido termine en `.limit(0)`, que en
    // Mongo significa SIN LIMITE — justo lo que se esta arreglando.
    for (const malo of [0, -5, NaN, Infinity]) {
      expect(paginarOrdenes(malo).limit).toBe(LIMITE_POR_DEFECTO_DE_ORDENES);
    }
    expect(paginarOrdenes(undefined).limit).toBe(LIMITE_POR_DEFECTO_DE_ORDENES);
  });

  it('limit decimal: se trunca', () => {
    expect(paginarOrdenes(20.9).limit).toBe(20);
  });

  it('pagina: el salto se calcula sobre el limite pedido', () => {
    expect(paginarOrdenes(20, 1)).toEqual({ limit: 20, skip: 0 });
    expect(paginarOrdenes(20, 2)).toEqual({ limit: 20, skip: 20 });
    expect(paginarOrdenes(20, 5)).toEqual({ limit: 20, skip: 80 });
  });

  it('pagina invalida o menor a 1: arranca del principio', () => {
    for (const mala of [0, -3, NaN, undefined]) {
      expect(paginarOrdenes(20, mala).skip).toBe(0);
    }
  });

  it('el defecto es MENOR que el techo: quien necesita mas lo pide', () => {
    // No son el mismo numero, y esa diferencia es el arreglo de un error mio:
    // la primera version puso los dos en 500 y habria truncado
    // /private/orders-by-waiter, que con un mes pide 1.220 ordenes. Se habrian
    // perdido 720 filas sin un error y sin un aviso.
    expect(LIMITE_POR_DEFECTO_DE_ORDENES).toBeLessThan(LIMITE_DURO_DE_ORDENES);
  });

  it('el techo cubre el peor caso legitimo medido (1.220 de un mes)', () => {
    expect(LIMITE_DURO_DE_ORDENES).toBeGreaterThanOrEqual(1220);
    expect(paginarOrdenes(1220).limit).toBe(1220);
  });

  it('pagina sin limit: pagina sobre el limite por defecto', () => {
    expect(paginarOrdenes(undefined, 3)).toEqual({
      limit: LIMITE_POR_DEFECTO_DE_ORDENES,
      skip: LIMITE_POR_DEFECTO_DE_ORDENES * 2,
    });
  });

  it('el limite pedido se acota ANTES de calcular el salto', () => {
    // Si el salto se calculara con el limite crudo, pedir limit=9000&page=2
    // saltaria 9000 y se perderian miles de ordenes en silencio.
    expect(paginarOrdenes(9000, 2)).toEqual({
      limit: LIMITE_DURO_DE_ORDENES,
      skip: LIMITE_DURO_DE_ORDENES,
    });
  });
});
