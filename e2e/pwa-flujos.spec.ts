import { test, expect, credencialDe } from './fixtures';

/**
 * La PWA (el mismo codigo del APK compilado a web) servida en /app/.
 *
 * Existe por lo que encontro: el aviso de "sin conexion" se publico roto y
 * los tests unitarios no podian verlo. Dos causas encadenadas, las dos solo
 * visibles cortando la red de verdad:
 *
 * 1. El aviso colgaba de `isOffline` del authStore, que SOLO se pone en true
 *    dentro de `initialize()` — o sea al abrir la app. Si la red se cae
 *    mientras alguien trabaja, ese campo se queda en false para siempre.
 * 2. Arreglado eso, seguia sin salir: NetInfo en web se suscribe a
 *    `connection.change` cuando existe `navigator.connection` (Chrome y Edge
 *    la tienen) y solo cae a `window.online`/`offline` cuando NO existe.
 *    `connection.change` no dispara al perder la red; lo que cambia es
 *    `navigator.onLine`. NetInfo nunca reportaba.
 *
 * Moraleja para el que venga: 84 tests unitarios en verde y el aviso no
 * aparecia. Esto se prueba cortando la red.
 */
test.use({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' });

test('PWA: entra, navega las 5 pestanas y avisa al cortar la red', async ({
  page,
  context,
}) => {
  const cred = credencialDe('admin');
  test.skip(cred === null, 'falta admin');

  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });

  await page.goto('/app/');
  await page.waitForLoadState('networkidle');

  // Login (React Native Web: inputs sin type=email)
  const inputs = page.locator('input');
  await expect(inputs.first()).toBeVisible({ timeout: 20_000 });
  await inputs.nth(0).fill(cred!.email);
  await inputs.nth(1).fill(cred!.password);
  await page.getByText('Iniciar Sesión', { exact: true }).click();
  await expect(page).toHaveTitle(/Panel/i, { timeout: 30_000 });
  console.log('[pwa] entro, titulo =', await page.title());

  // Las 5 pestanas
  for (const tab of ['Salón', 'Caja', 'Almacén', 'Perfil', 'Panel']) {
    await page.getByText(tab, { exact: true }).last().click();
    await page.waitForTimeout(1500);
    console.log(`[pwa] ${tab} -> titulo = ${await page.title()}`);
  }

  // Cortar la red: tiene que aparecer el aviso
  await context.setOffline(true);
  const aviso = page
    .getByText(/Sin conexion\.|El servidor no responde\./i)
    .first();
  await expect(aviso).toBeVisible({ timeout: 30_000 });
  console.log(
    '[pwa] con la red cortada dice:',
    (await aviso.innerText()).trim(),
  );

  await context.setOffline(false);
  await expect(aviso).toBeHidden({ timeout: 30_000 });
  console.log('[pwa] al volver la red, el aviso se fue');

  const graves = errores.filter((e) =>
    /SyntaxError|import\.meta|is not a function/i.test(e),
  );
  expect(graves, `errores graves:\n${graves.join('\n')}`).toEqual([]);
});
