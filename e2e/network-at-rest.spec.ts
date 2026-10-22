import {
  test,
  expect,
  credencialDe,
  motivoDeSalto,
  capturarRedEnReposo,
  revisarRedEnReposo,
  Rol,
} from './fixtures';

/**
 * Red en reposo: se carga la pantalla, no se toca nada, y la red se calla.
 *
 * Regla del dueno, dicha asi el 07/09/2026: "es vital". No es cosmetica.
 * Un endpoint que se repite solo suele ser un hook con dependencias mal
 * puestas, dos hooks con query keys distintas pidiendo lo mismo, o un
 * `refetchInterval` que quedo olvidado. Cuando el local se queda sin
 * internet y trabaja sobre los datos del telefono del dueno, cada peticion
 * de mas es plata y es espera en cada toque de pantalla.
 *
 * Que NO cuenta como repeticion: los estaticos (`_next`, fuentes, imagenes)
 * los filtra `capturarRedEnReposo`.
 */

const VENTANA_SEG = Number(process.env.E2E_VENTANA_REPOSO_SEG ?? 30);

const PANTALLAS: Array<{ nombre: string; rol: Rol; ruta: string }> = [
  { nombre: 'Panel', rol: 'admin', ruta: '/private/dashboard' },
  { nombre: 'POS (mapa de mesas)', rol: 'cashier', ruta: '/private/pos' },
  { nombre: 'Ordenes', rol: 'admin', ruta: '/private/orders' },
  { nombre: 'Productos', rol: 'admin', ruta: '/private/products' },
  { nombre: 'Recetas', rol: 'kitchen', ruta: '/private/recipes' },
];

test.describe('Red en reposo', () => {
  // La ventana de observacion domina el tiempo del test.
  test.describe.configure({ timeout: (VENTANA_SEG + 90) * 1000 });

  for (const { nombre, rol, ruta } of PANTALLAS) {
    test(`${nombre}: nada se repite en ${VENTANA_SEG} s`, async ({
      page,
      loginAs,
    }) => {
      test.skip(credencialDe(rol) === null, motivoDeSalto(rol));

      await loginAs(rol);
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');

      const urls = await capturarRedEnReposo(page, VENTANA_SEG);
      const reporte = revisarRedEnReposo(urls);

      // Se imprime siempre: cuando falla, el informe ES el diagnostico.
      console.log(`[reposo] ${nombre}: ${reporte.resumen}`);

      expect(
        reporte.repetidos,
        `${nombre} no quedo en reposo. Repetidos:\n` +
          reporte.repetidos
            .map((r) => `  ${r.endpoint} x${r.veces}`)
            .join('\n'),
      ).toEqual([]);
    });
  }
});
