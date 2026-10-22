import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  GERENCIA_Y_CAJA,
  SOLO_GERENCIA,
  TODAS_LAS_RUTAS_CON_ACCESO,
  redireccionPorAcceso,
} from './accesoPorRol.ts';

// El 07/09/2026, con Playwright y las cuentas de prueba, un mesonero abría
// /private/reports y veía el ingreso del mes. El middleware protegía
// `/private/reportes` —con "e"—, una carpeta que no existe. La regla estaba
// bien escrita; el nombre, no. Esta prueba impide que vuelva a pasar: si una
// ruta protegida no tiene página, falla aquí y no en producción.

const RAIZ_APP = path.join(process.cwd(), 'src', 'app');

const hayPagina = (ruta: string): boolean =>
  existsSync(path.join(RAIZ_APP, ruta, 'page.tsx'));

describe('acceso por rol', () => {
  test('toda ruta protegida existe como pantalla', () => {
    const fantasmas = TODAS_LAS_RUTAS_CON_ACCESO.filter((r) => !hayPagina(r));
    assert.deepEqual(
      fantasmas,
      [],
      `Estas rutas se protegen pero no existen: ${fantasmas.join(', ')}. ` +
        'Una ruta mal escrita aquí deja la pantalla real abierta a todos.',
    );
  });

  test('no hay rutas repetidas entre las listas', () => {
    const vistas = new Set<string>();
    const repetidas = TODAS_LAS_RUTAS_CON_ACCESO.filter((r) => {
      if (vistas.has(r)) return true;
      vistas.add(r);
      return false;
    });
    assert.deepEqual(repetidas, []);
  });

  test('gerencia entra a todo', () => {
    for (const rol of ['admin', 'manager']) {
      for (const ruta of TODAS_LAS_RUTAS_CON_ACCESO) {
        assert.equal(redireccionPorAcceso(ruta, rol), null, `${rol} ${ruta}`);
      }
    }
  });

  test('el mesonero no entra a las pantallas de gerencia', () => {
    for (const ruta of SOLO_GERENCIA) {
      assert.equal(
        redireccionPorAcceso(ruta, 'waiter'),
        '/private/waiter',
        ruta,
      );
    }
  });

  test('las estaciones tampoco, pero sí a recetas e inventario', () => {
    for (const rol of ['kitchen', 'bar', 'pizza']) {
      assert.equal(
        redireccionPorAcceso('/private/reports', rol),
        '/private/recipes',
      );
      assert.equal(redireccionPorAcceso('/private/recipes', rol), null);
      assert.equal(redireccionPorAcceso('/private/inventory', rol), null);
    }
  });

  test('pedir insumos queda abierto a quien no ve el inventario', () => {
    for (const rol of ['waiter', 'cashier']) {
      assert.equal(
        redireccionPorAcceso('/private/inventory/insumo-requests', rol),
        null,
      );
      assert.equal(
        redireccionPorAcceso('/private/inventory', rol),
        rol === 'cashier' ? '/private/pos' : '/private/waiter',
      );
    }
  });

  test('caja entra a por cobrar y a las solicitudes de credito', () => {
    for (const ruta of GERENCIA_Y_CAJA) {
      assert.equal(redireccionPorAcceso(ruta, 'cashier'), null, ruta);
      assert.equal(
        redireccionPorAcceso(ruta, 'waiter'),
        '/private/waiter',
        ruta,
      );
      assert.equal(
        redireccionPorAcceso(ruta, 'kitchen'),
        '/private/recipes',
        ruta,
      );
    }
  });

  test('las subrutas heredan el candado de su pantalla', () => {
    assert.equal(
      redireccionPorAcceso('/private/products/abc123/details', 'waiter'),
      '/private/waiter',
    );
    // Y no se cierra una ruta distinta que empiece igual.
    assert.equal(redireccionPorAcceso('/private/productsX', 'waiter'), null);
  });

  test('lo que el mesonero usa a diario sigue abierto', () => {
    for (const ruta of [
      '/private/waiter',
      '/private/waiter/pedidos',
      '/private/orders',
      '/private/pos/order',
      '/private/attendance/checkin',
    ]) {
      assert.equal(redireccionPorAcceso(ruta, 'waiter'), null, ruta);
    }
  });
});
