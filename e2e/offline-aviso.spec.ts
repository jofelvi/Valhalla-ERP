import { test, expect } from './fixtures';

/**
 * El aviso de "sin conexion" de la web.
 *
 * Se midieron 28 cortes de internet en 30 dias, 13 de mas de media hora y el
 * peor de 1h56m, varios en hora pico. Cuando eso pasa, la caja tiene que
 * saber dos cosas: que el problema es la red, y —sobre todo— que lo que
 * guarde ahora NO se guarda.
 *
 * La segunda parte es la que este guion cuida de verdad. Una version del
 * aviso decia "los cambios se sincronizaran cuando vuelva la conexion", y
 * era mentira: la web no tiene cola de escrituras. Prometerle a la cajera
 * que su cobro se va a guardar cuando no se va a guardar es peor que no
 * avisar nada. El dia que exista la cola (O3 del plan), se cambia el texto y
 * se cambia este test, en el mismo commit.
 *
 * OJO: falla contra un ambiente donde todavia no este desplegado el aviso.
 * Esa falla es verdadera, no ruido: quiere decir que ese ambiente no lo tiene.
 */
test('avisa que no hay red, y no promete guardar lo que no guarda', async ({
  page,
  context,
}) => {
  await page.goto('/public/login');
  await page.waitForLoadState('networkidle');

  const aviso = page.getByRole('alert').filter({ hasText: /Sin conexion/i });
  await expect(aviso).toHaveCount(0);

  await context.setOffline(true);
  await expect(aviso).toBeVisible({ timeout: 15_000 });

  const texto = (await aviso.innerText()).replace(/\s+/g, ' ');
  expect(
    texto,
    'el aviso no puede prometer una sincronizacion que la web no hace',
  ).not.toMatch(/sincroniza/i);
  expect(texto).toMatch(/no se va a registrar/i);

  // Y se va solo: nadie tiene que recargar para volver a trabajar.
  await context.setOffline(false);
  await expect(aviso).toHaveCount(0, { timeout: 15_000 });
});
