#!/usr/bin/env node
/**
 * Escribe `src/version.generated.ts` justo antes de compilar.
 *
 * Por que un archivo generado y no una variable de entorno: `NEXT_PUBLIC_APP_VERSION`
 * de la web llevaba meses sin existir en el `.env.production` del VPS, asi que toda
 * la web reportaba "1.0.0" y la telemetria de `ClientVersionInterceptor` guardaba
 * basura sin que nadie se enterara. Una variable se puede olvidar; lo que queda
 * horneado dentro del bundle NO puede desmentir al bundle que lo contiene.
 *
 * El SHA se toma del git local porque la API se compila aca y se sube por
 * tar+scp. `API_COMMIT_SHA` permite inyectarlo desde fuera si algun dia el build
 * ocurre donde no hay repo.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// El ultimo numero se muestra con dos cifras: 1.7.9 se ve "1.7.09" (dueño,
// 18/09/2026). En package.json va sin el cero porque semver no admite ceros a
// la izquierda y pnpm rechazaria "1.7.09"; el relleno es solo para mostrar.
const version = JSON.parse(
  readFileSync(join(raiz, 'package.json'), 'utf8'),
).version.replace(/^(\d+\.\d+\.)(\d)(?!\d)/, '$10$2');

const sha =
  process.env.API_COMMIT_SHA?.trim() ||
  (() => {
    try {
      return execSync('git rev-parse --short HEAD', {
        cwd: raiz,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      return 'desconocido';
    }
  })();

const contenido = `// GENERADO POR scripts/gen-version.mjs — no editar a mano, no commitear.
export const APP_VERSION = '${version}';
export const COMMIT_SHA = '${sha}';
export const BUILD_TIME = '${new Date().toISOString()}';
`;

writeFileSync(join(raiz, 'src', 'version.generated.ts'), contenido);
console.log(`version.generated.ts -> ${version} (${sha})`);
