import { OPERACION_DEFAULT } from '@odin6/types';
import * as arf from './accounts-receivable-filter.util';
import { condicionDeEstado } from './accounts-receivable-filter.util';

// Se prueba con la operación por defecto (Caracas): el rango de fechas sale del contrato.
const buildAccountsReceivableFilter = (
  filtros: Parameters<typeof arf.buildAccountsReceivableFilter>[0] = {},
) => arf.buildAccountsReceivableFilter(filtros, OPERACION_DEFAULT);

describe('buildAccountsReceivableFilter', () => {
  it('sin filtros no restringe nada', () => {
    expect(buildAccountsReceivableFilter()).toEqual({});
    expect(buildAccountsReceivableFilter({})).toEqual({});
  });

  it('un cliente se busca por igualdad, como siempre', () => {
    expect(buildAccountsReceivableFilter({ customerId: 'c1' })).toEqual({
      customerId: 'c1',
    });
  });

  it('varios clientes se buscan de una sola vez', () => {
    // Es el arreglo del N+1 de la nomina: una fila por empleado hacia una
    // peticion cada una (9 medidas el 08/09/2026).
    expect(
      buildAccountsReceivableFilter({ customerIds: ['c1', 'c2', 'c3'] }),
    ).toEqual({ customerId: { $in: ['c1', 'c2', 'c3'] } });
  });

  it('la lista se limpia de vacios y repetidos', () => {
    expect(
      buildAccountsReceivableFilter({
        customerIds: ['c1', '', 'c1', '  ', 'c2'],
      }),
    ).toEqual({ customerId: { $in: ['c1', 'c2'] } });
  });

  it('una lista que queda vacia NO devuelve la cartera entera', () => {
    // Si `customerIds=` llega vacio y se ignorase el filtro, la nomina se
    // bajaria TODAS las cuentas por cobrar (540 KB) en vez de ninguna.
    expect(buildAccountsReceivableFilter({ customerIds: [] })).toEqual({
      customerId: { $in: [] },
    });
    expect(buildAccountsReceivableFilter({ customerIds: ['', ' '] })).toEqual({
      customerId: { $in: [] },
    });
  });

  it('customerId y customerIds juntos: manda la lista', () => {
    expect(
      buildAccountsReceivableFilter({
        customerId: 'c9',
        customerIds: ['c1', 'c2'],
      }),
    ).toEqual({ customerId: { $in: ['c1', 'c2'] } });
  });

  it('el estado se combina con el cliente', () => {
    expect(
      buildAccountsReceivableFilter({ customerId: 'c1', status: 'pending' }),
    ).toEqual({ customerId: 'c1', status: 'pending' });
    expect(
      buildAccountsReceivableFilter({ customerIds: ['c1'], status: 'pending' }),
    ).toEqual({ customerId: { $in: ['c1'] }, status: 'pending' });
  });

  it('un estado vacio no filtra', () => {
    expect(buildAccountsReceivableFilter({ status: '' })).toEqual({});
  });

  it('soloVivas aparta las unificadas y las anuladas', () => {
    // Las unificadas ya estan sumadas dentro de la consolidada: contarlas otra
    // vez es doble conteo. Las anuladas son un borrado logico.
    expect(buildAccountsReceivableFilter({ soloVivas: true })).toEqual({
      isMerged: { $ne: true },
      status: { $ne: 'cancelled' },
    });
  });

  it('la pestaña de pendientes esconde las pagadas SIN destapar las anuladas', () => {
    // El bug que motivo todo esto: dos exclusiones a la vez tienen que
    // convivir. Con `$ne` suelto, la segunda pisaba a la primera y las 37
    // cuentas anuladas ($1.377,73) volvian a la lista.
    expect(
      buildAccountsReceivableFilter({ soloVivas: true, tab: 'pending' }),
    ).toEqual({
      isMerged: { $ne: true },
      status: { $nin: ['cancelled', 'paid'] },
    });
  });

  it('la pestaña de historial pide las pagadas', () => {
    expect(
      buildAccountsReceivableFilter({ soloVivas: true, tab: 'history' }),
    ).toEqual({ isMerged: { $ne: true }, status: 'paid' });
  });

  it('un estado pedido a mano manda sobre la pestaña', () => {
    expect(
      buildAccountsReceivableFilter({
        soloVivas: true,
        tab: 'pending',
        status: 'cancelled',
      }),
    ).toEqual({ isMerged: { $ne: true }, status: 'cancelled' });
  });

  it('el rango de fechas se interpreta en Caracas, no en el servidor', () => {
    // El VPS ya corrio en Europe/Berlin: si la zona saliera del servidor, un
    // rango "del 1 al 5" se comeria las ventas de las 20:00 a la medianoche.
    const q = buildAccountsReceivableFilter({
      desde: '2026-09-01',
      hasta: '2026-09-05',
    });
    const rango = q.createdAt as { $gte: Date; $lte: Date };
    expect(rango.$gte.toISOString()).toBe('2026-09-01T04:00:00.000Z');
    expect(rango.$lte.toISOString()).toBe('2026-09-06T03:59:59.999Z');
  });

  it('una fecha suelta deja el otro extremo abierto', () => {
    expect(
      (buildAccountsReceivableFilter({ desde: '2026-09-01' }).createdAt as
        | Record<string, unknown>
        | undefined) ?? {},
    ).toEqual({ $gte: new Date('2026-09-01T04:00:00.000Z') });
  });

  it('una fecha invalida se ignora en vez de romper la consulta', () => {
    expect(buildAccountsReceivableFilter({ desde: 'ayer' })).toEqual({});
  });

  it('el texto busca en factura, descripcion y nombre', () => {
    const q = buildAccountsReceivableFilter({ q: 'zambrano' });
    expect(q.$or).toEqual([
      {
        $and: [
          {
            $or: [
              {
                invoiceNumber: {
                  $regex: 'z[aáàäâã]mbr[aáàäâã][nñ][oóòöô]',
                  $options: 'i',
                },
              },
              {
                description: {
                  $regex: 'z[aáàäâã]mbr[aáàäâã][nñ][oóòöô]',
                  $options: 'i',
                },
              },
              {
                customerName: {
                  $regex: 'z[aáàäâã]mbr[aáàäâã][nñ][oóòöô]',
                  $options: 'i',
                },
              },
            ],
          },
        ],
      },
    ]);
  });

  it('el N° de accion entra por los clientes que ya se resolvieron', () => {
    // La accion vive en `customers`, no en la cuenta: el servicio la resuelve
    // antes y pasa los ids por aqui.
    const q = buildAccountsReceivableFilter({
      q: '00590',
      customerIdsPorTexto: ['c1', 'c2'],
    });
    expect((q.$or as unknown[])[0]).toEqual({
      customerId: { $in: ['c1', 'c2'] },
    });
  });

  it('la condicion de estado NUNCA pierde la exclusion de anuladas', () => {
    // El bug del 20/09/2026: el resumen juntaba una exclusion de anuladas con
    // otra de pagadas en el MISMO objeto, y la segunda clave `status` pisaba a
    // la primera, asi que las anuladas volvian a sumar en el total. Se vio
    // porque la cartera decia 184 cuentas y el desglose por estado 159.
    const cond = condicionDeEstado({ soloVivas: true, tab: 'pending' });
    expect(cond).toEqual({ status: { $nin: ['cancelled', 'paid'] } });
    expect(Object.keys(cond)).toHaveLength(1);
  });

  it('la lista y el resumen piden EXACTAMENTE el mismo estado', () => {
    // Si estas dos dejan de coincidir, la tarjeta vuelve a contar algo que la
    // lista de abajo no muestra, que es el defecto original.
    for (const caso of [
      { soloVivas: true, tab: 'pending' },
      { soloVivas: true, tab: 'history' },
      { soloVivas: true },
      { soloVivas: true, tab: 'pending', status: 'cancelled' },
    ]) {
      const deLaLista = buildAccountsReceivableFilter(caso);
      const delResumen = condicionDeEstado(caso);
      expect(delResumen.status).toEqual(deLaLista.status);
    }
  });
  it('un texto en blanco no filtra', () => {
    expect(buildAccountsReceivableFilter({ q: '   ' })).toEqual({});
  });
});

describe('el texto de busqueda', () => {
  // Cada caso de aqui abajo daba CERO contra los datos de produccion, medido
  // el 20/09/2026 sobre los 2.993 clientes reales.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const u = require('./accounts-receivable-filter.util') as {
    normalizarTexto: (t: string) => string;
    palabrasDe: (t?: string) => string[];
    patronTolerante: (p: string) => string;
    patronDeDigitos: (d: string) => string;
    patronesDePalabra: (p: string) => string[];
    filtroDeTexto: (
      t: string | undefined,
      campos: readonly string[],
    ) => Record<string, unknown> | null;
  };

  const encuentra = (patron: string, valor: string) =>
    new RegExp(patron, 'i').test(valor);

  it('quita tildes, baja a minusculas y colapsa espacios', () => {
    expect(u.normalizarTexto('  JOSÉ   MARÍA ')).toBe('jose maria');
  });

  it('la tilde deja de importar en los dos sentidos', () => {
    // `jose` encontraba 293 clientes y `josé` otros 21 DISTINTOS: habia que
    // adivinar como estaba escrito el nombre en la base.
    const p = u.patronTolerante('jose');
    expect(encuentra(p, 'PEDRO JOSE')).toBe(true);
    expect(encuentra(p, 'ACOSTA LEÓN JOSÉ CARLOS')).toBe(true);
  });

  it('la enye y la cedilla tambien', () => {
    expect(encuentra(u.patronTolerante('nono'), 'Distribuidora ÑOÑO')).toBe(
      true,
    );
  });

  it('todas las palabras tienen que aparecer, en cualquier orden', () => {
    const f = u.filtroDeTexto('luis alves', ['customerName']) as {
      $and: unknown[];
    };
    // Una clausula por palabra: «luis alves» a «ALVES OLIVEIRA LUIS CARLOS»
    // daba cero cuando se buscaba el texto entero de una pieza.
    expect(f.$and).toHaveLength(2);
  });

  it('el telefono se encuentra con otro separador', () => {
    const patrones = u.patronesDePalabra('0000003');
    expect(patrones.some((p) => encuentra(p, '0414-0000003'))).toBe(true);
    expect(u.patronDeDigitos('414')).toBe('4[^0-9]*1[^0-9]*4');
  });

  it('la cedula se encuentra como se ve en pantalla', () => {
    // La columna muestra «V-90000001-0»; el campo guarda solo el numero.
    const patrones = u.patronesDePalabra('v-8828343');
    expect(patrones.some((p) => encuentra(p, '8828343'))).toBe(true);
  });

  it('el N° de accion se encuentra sin los ceros de delante', () => {
    const patrones = u.patronesDePalabra('327');
    expect(patrones.some((p) => new RegExp(p).test('00327'))).toBe(true);
  });

  it('el texto se escapa: es texto, no una expresion regular', () => {
    // Sin esto, escribir un parentesis en el buscador revienta la consulta.
    expect(() => new RegExp(u.patronTolerante('Mesa (2)'))).not.toThrow();
    expect(encuentra(u.patronTolerante('Mesa (2)'), 'Mesa (2) del fondo')).toBe(
      true,
    );
  });

  it('sin texto no hay filtro', () => {
    expect(u.filtroDeTexto('', ['customerName'])).toBeNull();
    expect(u.filtroDeTexto('   ', ['customerName'])).toBeNull();
    expect(u.palabrasDe(undefined)).toEqual([]);
  });
});

describe('parseBandera', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parseBandera } = require('./accounts-receivable-filter.util') as {
    parseBandera: (raw?: string) => boolean;
  };

  it('ausente es false; presente es true', () => {
    expect(parseBandera(undefined)).toBe(false);
    expect(parseBandera('')).toBe(true);
    expect(parseBandera('1')).toBe(true);
    expect(parseBandera('true')).toBe(true);
  });

  it('apagarla a proposito se respeta', () => {
    expect(parseBandera('0')).toBe(false);
    expect(parseBandera('false')).toBe(false);
  });
});

describe('parseCustomerIds', () => {
  // Se importa aparte para no obligar al controlador a partir la cadena.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parseCustomerIds } = require('./accounts-receivable-filter.util') as {
    parseCustomerIds: (raw?: string) => string[] | undefined;
  };

  it('sin parametro no hay lista', () => {
    expect(parseCustomerIds(undefined)).toBeUndefined();
  });

  it('parte por comas y recorta', () => {
    expect(parseCustomerIds('c1, c2 ,c3')).toEqual(['c1', 'c2', 'c3']);
  });

  it('una cadena vacia SI es una lista vacia, no "sin filtro"', () => {
    expect(parseCustomerIds('')).toEqual([]);
    expect(parseCustomerIds('  ')).toEqual([]);
  });
});
