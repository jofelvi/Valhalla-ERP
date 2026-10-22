import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  ORDER_VIEW_FIELDS,
  isOrderView,
  projectionForOrderView,
} from './order-views.util';

describe('projectionForOrderView', () => {
  it('sin vista no proyecta nada: la orden viaja entera, como siempre', () => {
    expect(projectionForOrderView(undefined)).toBeUndefined();
    expect(projectionForOrderView('')).toBeUndefined();
  });

  it('una vista inventada tampoco proyecta: nunca se responde a medias', () => {
    // Antes devolver de mas que una orden a la que le falten campos porque
    // alguien escribio mal el nombre de la vista.
    expect(projectionForOrderView('payrol')).toBeUndefined();
    expect(projectionForOrderView('../../etc/passwd')).toBeUndefined();
  });

  it('la vista de nomina deja fuera lo que pesa y no se usa', () => {
    const projection = projectionForOrderView('payroll');
    expect(projection).toBeDefined();
    // Medido el 08/09/2026 sobre las 291 ordenes con comision pendiente:
    // `items` son 233 KB de 740 KB, y la tabla de nomina no los mira.
    expect(projection).not.toHaveProperty('items');
    expect(projection).not.toHaveProperty('cancelledItems');
    // Los comprobantes (193 KB) solo los abre el detalle por mesonero.
    expect(projection).not.toHaveProperty('pendingPayments');
    expect(projection).not.toHaveProperty('paymentProofUrls');
  });

  it('la vista de nomina trae lo que el calculo de comision necesita', () => {
    const projection = projectionForOrderView('payroll');
    for (const field of [
      'createdAt',
      'waiterId',
      'waiterName',
      'waiterShares',
      'serviceCharge',
      'comisionBase',
      'total',
      'tipAmount',
    ]) {
      expect(projection).toHaveProperty(field, 1);
    }
  });

  it('el detalle por mesonero añade los comprobantes a la vista de nomina', () => {
    const payroll = Object.keys(ORDER_VIEW_FIELDS.payroll);
    const waiter = Object.keys(ORDER_VIEW_FIELDS['payroll-waiter']);
    for (const field of payroll) expect(waiter).toContain(field);
    expect(waiter).toContain('pendingPayments');
    expect(waiter).toContain('paymentProofUrls');
  });

  it('las proyecciones son de inclusion: ningun campo se pide con 0', () => {
    // Mezclar 1 y 0 en la misma proyeccion es un error de Mongo, y un 0
    // suelto invertiria el sentido de la vista entera.
    for (const view of Object.keys(ORDER_VIEW_FIELDS)) {
      const projection = projectionForOrderView(view) ?? {};
      expect(Object.values(projection)).not.toContain(0);
      expect(Object.keys(projection).length).toBeGreaterThan(0);
    }
  });

  it('isOrderView reconoce solo las vistas declaradas', () => {
    expect(isOrderView('payroll')).toBe(true);
    expect(isOrderView('payroll-waiter')).toBe(true);
    expect(isOrderView('cualquier-cosa')).toBe(false);
    expect(isOrderView(undefined)).toBe(false);
  });
});

/**
 * La prueba que de verdad protege la nomina.
 *
 * Una proyeccion a la que le falte un campo NO da error: la pantalla recibe
 * `undefined` y calcula de menos, en silencio, sobre dinero que se le paga a
 * una persona. Asi que esta prueba lee el codigo de la nomina y exige que
 * cada `order.<campo>` que aparezca alli este declarado en la vista.
 */
describe('la vista de nomina cubre lo que lee la web', () => {
  const RAIZ = resolve(__dirname, '../../../../..');
  const PAYROLL_DIR = join(RAIZ, 'src', 'features', 'payroll');
  const WAITER_DETAIL = join(
    RAIZ,
    'src',
    'app',
    'private',
    'payroll',
    'mesonero',
    '[employeeId]',
    'page.tsx',
  );

  /**
   * Campos que la nomina lee pero que NO vienen de esta consulta:
   * los pide aparte con `/api/orders?ids=...`, que devuelve la orden entera.
   */
  const FUERA_DE_LA_VISTA = new Set([
    'id', // lo añade la API al mapear `_id`
    'items', // desglose de una cuenta concreta, por ids
  ]);

  const camposLeidos = (source: string): string[] => {
    const encontrados = new Set<string>();
    const re = /\b(?:order|o|ord)\.([A-Za-z_][A-Za-z0-9_]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) encontrados.add(m[1]);
    return [...encontrados];
  };

  const fuentes = (): string[] => {
    if (!existsSync(PAYROLL_DIR)) return [];
    const archivos = readdirSync(PAYROLL_DIR)
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'))
      .map((f) => join(PAYROLL_DIR, f));
    if (existsSync(WAITER_DETAIL)) archivos.push(WAITER_DETAIL);
    return archivos.map((f) => readFileSync(f, 'utf8'));
  };

  it('ningun campo que lee la nomina se queda fuera de la vista', () => {
    const sources = fuentes();
    // Si la API se compila sola, sin el monorepo al lado, no hay nada que
    // comprobar. Dentro del repo siempre lo hay.
    if (sources.length === 0) return;

    const declarados = new Set(
      Object.keys(ORDER_VIEW_FIELDS['payroll-waiter']),
    );
    const faltan = new Set<string>();
    for (const source of sources) {
      for (const campo of camposLeidos(source)) {
        if (FUERA_DE_LA_VISTA.has(campo)) continue;
        if (!declarados.has(campo)) faltan.add(campo);
      }
    }
    expect([...faltan].sort()).toEqual([]);
  });

  it('la prueba anterior de verdad esta mirando el codigo de la nomina', () => {
    // Sin esto, un cambio de rutas dejaria la comprobacion vacia y en verde.
    expect(fuentes().length).toBeGreaterThan(3);
  });
});
