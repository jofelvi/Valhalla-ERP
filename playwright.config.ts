import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Se carga ACA tambien, no solo en fixtures.ts: este archivo se evalua en el
// proceso principal de Playwright, antes de los workers, y de aqui sale la
// baseURL. Sin esto, apuntar a otro ambiente por .env.local no tenia efecto.
dotenv.config({ path: path.join(__dirname, 'e2e', '.env.local') });

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ES_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(BASE_URL);

/**
 * Suite e2e de la web del POS.
 *
 * Que cubre: entrar por rol, la regresion del sidebar trabado en
 * `/private/pos/order` (043c571), la conversion a pack, y la regla de red en
 * reposo. Todos los guiones son de SOLO LECTURA: no crean ni modifican
 * ordenes, para que se puedan correr contra produccion sin ensuciar nada.
 *
 * Apuntar a otro ambiente: `e2e/.env.local` (no se commitea).
 */
export default defineConfig({
  testDir: './e2e',
  // EN SERIE, y no es pereza: todos los guiones entran con la MISMA cuenta.
  // Con 6 workers en paralelo contra produccion, los logins simultaneos se
  // pisan y 9 de 20 tests fallaban en el login — los mismos que pasaban
  // cuando se corrian solos. Un rojo asi manda a buscar un bug que no existe.
  // Con un usuario por rol, esto se puede volver a abrir.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: './e2e/test-results' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Solo se levanta el servidor cuando la baseURL es local. Contra un
  // ambiente remoto, arrancar `pnpm dev` ademas de inutil bloquea el arranque
  // hasta el timeout.
  ...(ES_LOCAL
    ? {
        webServer: {
          command: 'pnpm dev',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
