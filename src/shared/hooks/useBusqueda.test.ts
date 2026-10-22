import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  normalizar,
  prepararBusqueda,
  prepararCampo,
  puntuarElemento,
} from '../utils/busquedaTexto.ts';

// El hook usa `useMemo`, que necesita un React montado. Lo que se prueba aquí
// es la REGLA, importada del módulo de verdad —no copiada— para que no se
// puedan separar. Si la regla cambia, esto falla.

type Campo = string | number | null | undefined;

/** Lo mismo que hace el hook: puntuar, descartar los ceros y ordenar. */
const filtrar = <T>(items: T[], camposDe: (i: T) => Campo[], texto: string) => {
  const busqueda = prepararBusqueda(texto);
  if (busqueda.length === 0) return items;
  return items
    .map((item, orden) => ({
      item,
      orden,
      puntos: puntuarElemento(camposDe(item).map(prepararCampo), busqueda),
    }))
    .filter((r) => r.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden)
    .map((r) => r.item);
};

const PROVEEDORES = [
  {
    name: 'Polar',
    contactName: 'Ana Ruiz',
    email: 'ana@polar.com',
    phone: '04141234567',
  },
  {
    name: 'Viveluso',
    contactName: null,
    email: undefined,
    phone: '02121112233',
  },
  {
    name: 'Distribuidora ÑOÑO',
    contactName: 'Luis',
    email: 'LUIS@dist.com',
    phone: null,
  },
];
const campos = (s: (typeof PROVEEDORES)[number]) => [
  s.name,
  s.contactName,
  s.email,
  s.phone,
];

describe('useBusqueda — lo que ya funcionaba sigue funcionando', () => {
  test('sin texto devuelve la misma lista, no una copia', () => {
    assert.equal(filtrar(PROVEEDORES, campos, ''), PROVEEDORES);
    assert.equal(filtrar(PROVEEDORES, campos, '   '), PROVEEDORES);
  });

  test('no distingue mayusculas ni en el texto ni en el dato', () => {
    assert.deepEqual(filtrar(PROVEEDORES, campos, 'POLAR'), [PROVEEDORES[0]]);
    assert.deepEqual(filtrar(PROVEEDORES, campos, 'luis@'), [PROVEEDORES[2]]);
  });

  test('un campo vacio o ausente no revienta ni cuenta como coincidencia', () => {
    assert.deepEqual(filtrar(PROVEEDORES, campos, 'viveluso'), [
      PROVEEDORES[1],
    ]);
    assert.equal(filtrar(PROVEEDORES, campos, 'undefined').length, 0);
    assert.equal(filtrar(PROVEEDORES, campos, 'null').length, 0);
  });

  test('los telefonos se buscan por trozo, como antes', () => {
    assert.deepEqual(filtrar(PROVEEDORES, campos, '0414'), [PROVEEDORES[0]]);
    assert.deepEqual(filtrar(PROVEEDORES, campos, '1112233'), [PROVEEDORES[1]]);
  });

  test('busca en cualquiera de los campos, no solo en el nombre', () => {
    assert.equal(filtrar(PROVEEDORES, campos, 'ana ruiz').length, 1);
  });

  test('el texto se recorta por los lados', () => {
    assert.deepEqual(filtrar(PROVEEDORES, campos, '  polar  '), [
      PROVEEDORES[0],
    ]);
  });

  test('sin coincidencias devuelve lista vacia', () => {
    assert.deepEqual(filtrar(PROVEEDORES, campos, 'zzz'), []);
  });

  test('los numeros se buscan como texto', () => {
    const items = [{ n: 1234 }, { n: 9999 }];
    assert.deepEqual(
      filtrar(items, (i) => [i.n], '23'),
      [items[0]],
    );
  });
});

// Cada caso de aquí abajo devolvía CERO o el conjunto equivocado contra los
// 2.993 clientes de producción, medido el 20/09/2026.
describe('useBusqueda — lo que estaba roto', () => {
  const CLIENTES = [
    {
      name: 'PEREZ GARCIA JUAN CARLOS',
      phone: '0414-7000001',
      cedula: '7000100',
      accion: '00327',
    },
    {
      name: 'DIAZ LOPEZ PEDRO ALFREDO',
      phone: '0416-7004327',
      cedula: '15234567',
      accion: '01751',
    },
    {
      name: 'MENDEZ RIVAS JOSÉ CARLOS',
      phone: '0414-7000002',
      cedula: '11223344',
      accion: '00525',
    },
    {
      name: 'BLANCO SALCEDO. PEDRO JOSE',
      phone: '0412-7000003',
      cedula: '9988776',
      accion: '00371',
    },
  ];
  const deCliente = (c: (typeof CLIENTES)[number]) => [
    c.name,
    c.phone,
    c.cedula,
    c.accion,
  ];
  const nombres = (texto: string) =>
    filtrar(CLIENTES, deCliente, texto).map((c) => c.name);

  test('la tilde deja de importar: `jose` y `josé` encuentran lo mismo', () => {
    // Antes eran conjuntos DISTINTOS (293 contra 21) y había que adivinar
    // cómo estaba escrito el nombre en la base.
    assert.deepEqual(nombres('jose').sort(), nombres('josé').sort());
    assert.equal(nombres('jose').length, 2);
  });

  test('dos palabras del nombre, en cualquier orden', () => {
    // «PEREZ GARCIA JUAN CARLOS»: antes las dos daban 0.
    assert.deepEqual(nombres('juan perez'), ['PEREZ GARCIA JUAN CARLOS']);
    assert.deepEqual(nombres('perez juan'), ['PEREZ GARCIA JUAN CARLOS']);
  });

  test('todas las palabras tienen que aparecer, no una cualquiera', () => {
    assert.deepEqual(nombres('perez zzz'), []);
  });

  test('se puede buscar la cedula como se ve en pantalla', () => {
    // La columna muestra «V-7000100»; el campo guarda solo el número.
    assert.deepEqual(nombres('V-7000100'), ['PEREZ GARCIA JUAN CARLOS']);
  });

  test('el telefono se encuentra escrito con espacio en vez de guion', () => {
    assert.deepEqual(nombres('0414 7000001'), ['PEREZ GARCIA JUAN CARLOS']);
  });

  test('el N° de accion se encuentra sin los ceros de delante', () => {
    // 327 vale lo mismo que 00327: se comparan como números.
    assert.deepEqual(nombres('00327'), ['PEREZ GARCIA JUAN CARLOS']);
    assert.equal(nombres('327')[0], 'PEREZ GARCIA JUAN CARLOS');
  });

  test('la accion exacta gana al telefono que casualmente contiene el numero', () => {
    // `327` sale en la acción 00327 y dentro del teléfono 0416-7004327. Antes
    // el orden era casualidad; ahora la coincidencia exacta va primero.
    const r = nombres('327');
    assert.equal(r[0], 'PEREZ GARCIA JUAN CARLOS');
    assert.ok(r.includes('DIAZ LOPEZ PEDRO ALFREDO'));
  });

  test('el doble espacio no rompe la busqueda', () => {
    assert.deepEqual(nombres('juan  carlos'), ['PEREZ GARCIA JUAN CARLOS']);
  });

  test('coincidir exacto pesa mas que empezar igual, y eso mas que contener', () => {
    const items = [{ t: 'carlos luis' }, { t: 'luis' }, { t: 'luisana perez' }];
    assert.deepEqual(
      filtrar(items, (i) => [i.t], 'luis').map((i) => i.t),
      ['luis', 'luisana perez', 'carlos luis'],
    );
  });
});

describe('normalizar', () => {
  test('quita tildes, baja a minusculas y colapsa espacios', () => {
    assert.equal(normalizar('  JOSÉ   MARÍA  '), 'jose maria');
    assert.equal(normalizar('ÑOÑO'), 'nono');
  });
});
