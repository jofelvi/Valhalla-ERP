import {
  filtroDeTexto,
  normalizarTexto,
  palabrasDe,
  patronDeDigitos,
  patronTolerante,
  patronesDePalabra,
  regexTolerante,
} from './busqueda-texto.util';

/** Comprueba el patron como lo usa Mongo: sin distinguir mayusculas. */
const encuentra = (patron: string, valor: string): boolean =>
  new RegExp(patron, 'i').test(valor);

describe('normalizarTexto', () => {
  it('quita tildes, baja a minusculas y colapsa espacios', () => {
    expect(normalizarTexto('  JOSÉ   MARÍA ')).toBe('jose maria');
    expect(normalizarTexto('Té de Jamaica')).toBe('te de jamaica');
  });

  it('la enye y la cedilla tambien pierden el adorno', () => {
    expect(normalizarTexto('ÑOÑO')).toBe('nono');
    expect(normalizarTexto('Curaçao')).toBe('curacao');
  });
});

describe('patronTolerante', () => {
  it('encuentra la palabra este escrita con tilde o sin ella', () => {
    // El caso que costo un producto duplicado: quien creo «TE DE JAMAICA»
    // escribio sin tilde y no encontro «Té de Jamaica», que ya existia.
    const p = patronTolerante('te');
    expect(encuentra(p, 'Té de Jamaica')).toBe(true);
    expect(encuentra(p, 'TE DE JAMAICA')).toBe(true);
  });

  it('funciona en los dos sentidos', () => {
    // `jose` encontraba 293 clientes y `josé` otros 21 DISTINTOS: habia que
    // adivinar como estaba escrito el nombre en la base.
    expect(encuentra(patronTolerante('jose'), 'ACOSTA LEÓN JOSÉ')).toBe(true);
    expect(encuentra(patronTolerante('jose'), 'PEDRO JOSE')).toBe(true);
    expect(encuentra(patronTolerante('pina'), 'Golden Piña 1.5L')).toBe(true);
    expect(encuentra(patronTolerante('cafe'), 'CAFÉ BALLET')).toBe(true);
  });

  it('el texto buscado es texto, no una expresion regular', () => {
    // Sin escapar, un parentesis revienta la consulta de Mongo.
    expect(() => new RegExp(patronTolerante('Promo (2 und)'))).not.toThrow();
    expect(
      encuentra(patronTolerante('(2 und)'), 'Promo Ternerito (2 und)'),
    ).toBe(true);
  });
});

describe('patronDeDigitos y patronesDePalabra', () => {
  it('los separadores guardados dejan de estorbar', () => {
    // El telefono esta guardado como «0414-0000003» y se busca con espacio.
    expect(encuentra(patronDeDigitos('04140000003'), '0414-0000003')).toBe(
      true,
    );
  });

  it('un numero encuentra al mismo numero con ceros delante', () => {
    const patrones = patronesDePalabra('327');
    expect(patrones.some((p) => encuentra(p, '00327'))).toBe(true);
  });

  it('una palabra corta no se compara por digitos', () => {
    // Menos de 3 digitos daria coincidencias por casualidad en cedulas.
    expect(patronesDePalabra('ab')).toEqual([patronTolerante('ab')]);
  });
});

describe('palabrasDe', () => {
  it('un texto vacio o en blanco significa "no filtres"', () => {
    expect(palabrasDe(undefined)).toEqual([]);
    expect(palabrasDe('   ')).toEqual([]);
  });
});

describe('filtroDeTexto', () => {
  it('sin texto no devuelve filtro', () => {
    expect(filtroDeTexto(undefined, ['name'])).toBeNull();
    expect(filtroDeTexto('  ', ['name'])).toBeNull();
  });

  it('todas las palabras tienen que aparecer, en cualquier orden', () => {
    // «luis alves» a un cliente llamado «ALVES OLIVEIRA LUIS CARLOS» daba cero
    // cuando se buscaba el texto entero de una pieza.
    const f = filtroDeTexto('luis alves', ['name']) as { $and: unknown[] };
    expect(f.$and).toHaveLength(2);
  });

  it('cada palabra puede caer en cualquiera de los campos', () => {
    const f = filtroDeTexto('pepsi', ['name', 'sku']) as {
      $and: { $or: unknown[] }[];
    };
    expect(f.$and[0].$or).toHaveLength(2);
  });
});

describe('regexTolerante', () => {
  it('sirve para filtrar en memoria con la misma regla', () => {
    // Es lo que usa el bot de gastos, que ya tiene los insumos cargados.
    expect(regexTolerante('pina').test('Golden Piña 1.5L')).toBe(true);
    expect(regexTolerante('TÉ').test('te de jamaica')).toBe(true);
  });
});
