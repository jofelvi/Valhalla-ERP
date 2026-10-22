import { test, expect, credencialDe, motivoDeSalto, Rol } from './fixtures';

/**
 * Entrar y aterrizar donde corresponde segun el rol.
 *
 * El mapa sale de `getDefaultRouteByRole` en
 * `src/shared/constantsRoutes/routes.ts`. Importa que este probado: el dia
 * que `UserRoleEnum.PIZZA` valio `undefined`, el pizzero entro al listado
 * completo de recetas del negocio en vez de a sus 42 pizzas, y nada fallo.
 *
 * Los tests de rol se SALTAN si no hay credencial en el entorno, en vez de
 * fallar: un rojo por un usuario que no existe no distingue de un rojo por
 * una app rota.
 */

const DESTINOS: Array<{ rol: Rol; ruta: RegExp; nota: string }> = [
  { rol: 'admin', ruta: /\/private\/dashboard/, nota: 'panel' },
  { rol: 'cashier', ruta: /\/private\/pos/, nota: 'caja: directo al POS' },
  { rol: 'waiter', ruta: /\/private\/waiter/, nota: 'mesonero: su vista' },
  {
    rol: 'kitchen',
    ruta: /\/private\/recipes/,
    nota: 'estacion: a cargar SUS recetas; el panel les salia vacio',
  },
];

test.describe('Entrar al sistema', () => {
  for (const { rol, ruta, nota } of DESTINOS) {
    test(`${rol} aterriza donde le toca (${nota})`, async ({
      page,
      loginAs,
    }) => {
      test.skip(credencialDe(rol) === null, motivoDeSalto(rol));
      await loginAs(rol);
      await expect(page).toHaveURL(ruta);
    });
  }

  test('una clave mala no deja pasar y lo dice', async ({ page }) => {
    await page.goto('/public/login');
    await page.fill('input[type="email"]', 'no-existe@example.invalid');
    await page.fill('input[type="password"]', 'clave-incorrecta');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/public\/login/);
    await expect(
      page.locator('text=/incorrect|invalid|error|credencial/i').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('sin sesion, una ruta privada manda al login', async ({ page }) => {
    await page.goto('/private/dashboard');
    await expect(page).toHaveURL(/\/public\/login/, { timeout: 20_000 });
  });
});
