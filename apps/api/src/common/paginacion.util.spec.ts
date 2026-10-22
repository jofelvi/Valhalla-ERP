import { paginar, limitePedido, saltoDePagina } from './paginacion.util';

const TOPE = { defecto: 500, duro: 2000 };

describe('limitePedido', () => {
  it('sin limit: el defecto, nunca "todo"', () => {
    expect(limitePedido(undefined, TOPE)).toBe(500);
    expect(limitePedido('', TOPE)).toBe(500);
  });

  it('CERO cae al defecto, NO a cero', () => {
    // El borde que motiva todo el archivo: `.limit(0)` en Mongo significa SIN
    // LIMITE. Un `?limit=0` que se respetara devolveria la coleccion entera,
    // que es justo lo que se estaba arreglando.
    expect(limitePedido('0', TOPE)).toBe(500);
    expect(limitePedido(0, TOPE)).toBe(500);
  });

  it('basura y negativos caen al defecto', () => {
    for (const malo of ['abc', '-5', 'Infinity', '-Infinity', 'NaN', NaN, -1]) {
      expect(limitePedido(malo, TOPE)).toBe(500);
    }
  });

  it('el tope es DURO: pedir de mas no sirve', () => {
    expect(limitePedido('99999', TOPE)).toBe(2000);
    expect(limitePedido(99999, TOPE)).toBe(2000);
  });

  it('acepta string y number por igual', () => {
    expect(limitePedido('37', TOPE)).toBe(limitePedido(37, TOPE));
  });

  it('trunca decimales hacia abajo', () => {
    expect(limitePedido('10.9', TOPE)).toBe(10);
  });
});

describe('saltoDePagina', () => {
  it('pagina 1, ausente, vacia o invalida: arranca del principio', () => {
    for (const p of [undefined, '', '1', 1, '0', '-3', 'x', NaN]) {
      expect(saltoDePagina(p, 20)).toBe(0);
    }
  });

  it('pagina N salta (N-1) x limite', () => {
    expect(saltoDePagina('3', 20)).toBe(40);
    expect(saltoDePagina(5, 100)).toBe(400);
  });
});

describe('paginar', () => {
  it('el salto se calcula sobre el limite YA ACOTADO', () => {
    // Con el limite crudo, `?limit=9000&page=2` saltaria 9.000 filas de un
    // tope de 2.000: se perderian miles en silencio.
    expect(paginar('9000', '2', TOPE)).toEqual({ limit: 2000, skip: 2000 });
  });

  it('caso normal', () => {
    expect(paginar('20', '3', TOPE)).toEqual({ limit: 20, skip: 40 });
  });

  it('sin nada: defecto desde el principio', () => {
    expect(paginar(undefined, undefined, TOPE)).toEqual({
      limit: 500,
      skip: 0,
    });
  });

  it('el defecto tiene que ser MENOR que el techo', () => {
    // Si fueran iguales, quien necesita mas no tendria forma de pedirlo y el
    // reporte se truncaria sin avisar. Es la leccion de `/api/orders`.
    expect(TOPE.defecto).toBeLessThan(TOPE.duro);
  });
});
