import { test, expect, credencialDe, motivoDeSalto } from './fixtures';

/**
 * El menu lateral tiene que seguir funcionando desde `/private/pos/order`.
 *
 * Regresion de 043c571 (07/09/2026). El dueno reporto que desde esa pantalla
 * no respondia NINGUNA entrada del menu; solo "Mesas", que "destrababa todo"
 * porque recargaba la aplicacion entera. Se replico: 0 de 4 entradas
 * navegaban y la consola repetia "Maximum update depth exceeded".
 *
 * La causa no era el router: era un bucle infinito de renders en
 * `ProductSelector` — `categories` se recreaba en cada render y estaba en las
 * dependencias de un efecto que hacia `setFilteredProducts`. React nunca
 * terminaba de renderizar y por eso no procesaba la transicion de ruta.
 *
 * Antes de eso, alguien habia parchado las DOS salidas que le importaban con
 * `<a>` nativo y `window.location.href` en vez de buscar la causa. Este
 * guion existe para que, si el bucle vuelve, se entere una maquina y no el
 * dueno en el medio del servicio.
 *
 * Ojo con las etiquetas: en el sidebar dicen "Órdenes" CON tilde. Una version
 * anterior de este guion buscaba /Ordenes/ sin tilde y fallaba sola.
 */

test.describe('El menu lateral desde la pantalla de pedido', () => {
  // La caja es quien vive en esta pantalla, pero el admin la ve igual: se usa
  // el rol del que haya credencial, y solo se salta si no hay ninguna.
  const ROL = credencialDe('cashier') ? 'cashier' : 'admin';

  const erroresDeConsola: string[] = [];

  test.beforeEach(async ({ page, loginAs }) => {
    test.skip(credencialDe(ROL) === null, motivoDeSalto(ROL));

    erroresDeConsola.length = 0;
    page.on('console', (msg) => {
      if (msg.type() === 'error') erroresDeConsola.push(msg.text());
    });
    page.on('pageerror', (err) => erroresDeConsola.push(err.message));

    await loginAs(ROL);
    await page.goto('/private/pos/order');
    await page.waitForURL(/\/private\/pos\/order/);
    await page.waitForLoadState('networkidle');
  });

  // Etiqueta EXACTA del sidebar (src/components/sidebar/Sidebar.tsx) y la
  // ruta a la que tiene que llegar.
  const ENTRADAS: Array<{ etiqueta: string; ruta: RegExp }> = [
    { etiqueta: 'Mesas', ruta: /\/private\/tables/ },
    { etiqueta: 'Órdenes', ruta: /\/private\/orders/ },
    { etiqueta: 'Productos', ruta: /\/private\/products/ },
    { etiqueta: 'Panel', ruta: /\/private\/dashboard/ },
  ];

  for (const { etiqueta, ruta } of ENTRADAS) {
    test(`"${etiqueta}" navega`, async ({ page }) => {
      const entrada = page
        .getByRole('link', { name: etiqueta, exact: true })
        .first();
      await expect(entrada).toBeVisible({ timeout: 15_000 });
      await entrada.click();
      await expect(page).toHaveURL(ruta, { timeout: 20_000 });
    });
  }

  test('las 4 entradas navegan una tras otra, sin recargar', async ({
    page,
  }) => {
    const fallaron: string[] = [];
    for (const { etiqueta, ruta } of ENTRADAS) {
      await page.goto('/private/pos/order');
      await page.waitForURL(/\/private\/pos\/order/);
      const entrada = page
        .getByRole('link', { name: etiqueta, exact: true })
        .first();
      try {
        await entrada.click({ timeout: 15_000 });
        await page.waitForURL(ruta, { timeout: 20_000 });
      } catch {
        fallaron.push(etiqueta);
      }
    }
    expect(
      fallaron,
      `no navegaron desde /private/pos/order: ${fallaron.join(', ')}`,
    ).toEqual([]);
  });

  test('la pantalla no entra en bucle de renders', async ({ page }) => {
    // El sintoma exacto del bug: React avisando que no puede terminar de
    // renderizar. Mientras eso pasa, ninguna transicion de ruta se procesa.
    await page.waitForTimeout(6_000);
    const bucle = erroresDeConsola.filter((e) =>
      /Maximum update depth exceeded/i.test(e),
    );
    expect(bucle, `consola:\n${bucle.join('\n')}`).toEqual([]);
  });
});
