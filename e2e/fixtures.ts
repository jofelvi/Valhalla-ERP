import { test as base, expect, Page, Request } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// e2e/.env.local esta en .gitignore: las credenciales NO se commitean.
dotenv.config({ path: path.join(__dirname, '.env.local') });

export type Rol = 'admin' | 'cashier' | 'waiter' | 'kitchen';

export interface Credencial {
  email: string;
  password: string;
}

/**
 * Credenciales por rol, leidas del entorno.
 *
 * NO hay valores por defecto a proposito. Una version anterior ponia
 * `admin@pos.test / admin123` (cuenta de prueba de ambiente), usuarios que no existen en ninguna base:
 * la suite corria, fallaba 18 de 19 y el informe decia "los tests estan bien
 * escritos, falta crear los usuarios". Una suite que falla por datos que
 * nunca existieron no mide nada y ademas ensucia: al tiempo nadie distingue
 * el rojo de "no hay usuario" del rojo de "se rompio la app".
 *
 * Sin la variable, el test que necesita ese rol se SALTA con el motivo a la
 * vista. Ver `e2e/.env.example`.
 */
export function credencialDe(rol: Rol): Credencial | null {
  const prefijo = `E2E_${rol.toUpperCase()}`;
  const email = process.env[`${prefijo}_EMAIL`];
  const password = process.env[`${prefijo}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

/** Texto para el `skip` cuando falta la credencial: que se lea el porque. */
export function motivoDeSalto(rol: Rol): string {
  return `falta E2E_${rol.toUpperCase()}_EMAIL / _PASSWORD en e2e/.env.local (ver .env.example)`;
}

export const test = base.extend<{
  loginAs: (rol: Rol) => Promise<void>;
}>({
  loginAs: async ({ page }, use) => {
    await use(async (rol: Rol) => {
      const cred = credencialDe(rol);
      if (!cred) throw new Error(motivoDeSalto(rol));

      await page.goto('/public/login');
      await page.fill('input[type="email"]', cred.email);
      await page.fill('input[type="password"]', cred.password);

      // Se espera el cambio de URL, no `waitForNavigation()`: con el App
      // Router la transicion puede resolverse sin un evento de navegacion
      // del navegador, y ahi el await se queda colgado hasta el timeout.
      await Promise.all([
        page.waitForURL((u) => !u.pathname.includes('/public/login'), {
          timeout: 30_000,
        }),
        page.click('button[type="submit"]'),
      ]);
    });
  },
});

/** Peticiones que no cuentan: estaticos, mapas de fuente, telemetria de Next. */
function esRuido(url: string): boolean {
  return (
    url.includes('/_next/') ||
    url.includes('.js.map') ||
    /\.(png|jpe?g|gif|svg|ico|woff2?|ttf|css)(\?|$)/i.test(url)
  );
}

/**
 * Captura las peticiones de datos durante `segundos`, sin tocar la pantalla.
 *
 * La regla del dueno es explicita y la llamo "vital": **en reposo la red
 * tiene que estar en cero**. Un endpoint que se repite solo, sin que nadie
 * toque nada, es un hook con dependencias mal puestas, dos hooks con query
 * keys distintas para lo mismo, o un `refetchInterval` olvidado. Sobre los
 * datos del telefono del dueno durante un corte, eso se paga en plata.
 */
export async function capturarRedEnReposo(
  page: Page,
  segundos: number,
): Promise<string[]> {
  const urls: string[] = [];
  const alPedir = (req: Request) => {
    const url = req.url();
    if (!esRuido(url)) urls.push(url);
  };
  page.on('request', alPedir);
  await page.waitForTimeout(segundos * 1000);
  page.off('request', alPedir);
  return urls;
}

export interface ReporteDeReposo {
  resumen: string;
  repetidos: Array<{ endpoint: string; veces: number }>;
  porEndpoint: Record<string, number>;
}

/** Agrupa por endpoint (sin query) y senala los que se repiten. */
export function revisarRedEnReposo(urls: string[]): ReporteDeReposo {
  const porEndpoint: Record<string, number> = {};
  for (const url of urls) {
    const endpoint = url.split('?')[0];
    porEndpoint[endpoint] = (porEndpoint[endpoint] ?? 0) + 1;
  }
  const repetidos = Object.entries(porEndpoint)
    .filter(([, veces]) => veces > 1)
    .map(([endpoint, veces]) => ({ endpoint, veces }))
    .sort((a, b) => b.veces - a.veces);

  const resumen =
    repetidos.length === 0
      ? `red en reposo OK (${urls.length} peticiones, ninguna repetida)`
      : `se repiten ${repetidos.length}: ` +
        repetidos.map((r) => `${r.endpoint} x${r.veces}`).join(', ');

  return { resumen, repetidos, porEndpoint };
}

export { expect };
