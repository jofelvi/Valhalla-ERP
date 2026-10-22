import type { NextConfig } from 'next';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Version, commit y hora de build, horneados en el bundle.
 *
 * Antes existia `NEXT_PUBLIC_APP_VERSION` pero NUNCA se seteo en el
 * `.env.production` del VPS, asi que la web reportaba '1.0.0' a todo el mundo y
 * la telemetria de `ClientVersionInterceptor` guardaba ese literal en
 * `users.lastAppVersion`. Por eso el valor se calcula aca, en build, y no se
 * depende de que alguien se acuerde de declarar una variable.
 *
 * TRAMPA DEL SERVIDOR: no se puede sacar el SHA con `git rev-parse` dentro del
 * directorio publicado si ahí quedó un `.git` vestigial. El hook de deploy exporta
 * `NEXT_PUBLIC_COMMIT_SHA` y esa variable manda sobre el git local.
 */
// El ultimo numero se muestra con dos cifras: 1.1.3 se ve "1.1.03" (dueño,
// 18/09/2026). En package.json va sin el cero porque semver no admite ceros a
// la izquierda y pnpm rechazaria "1.1.03"; el relleno es solo para mostrar.
// La API ya lo hacia en `gen-version.mjs` y la web no: por eso produccion
// reportaba "1.1.2" mientras la API reportaba "1.8.02".
const version = JSON.parse(
  readFileSync('./package.json', 'utf8'),
).version.replace(/^(\d+\.\d+\.)(\d)(?!\d)/, '$10$2');

const commitSha =
  process.env.NEXT_PUBLIC_COMMIT_SHA?.trim() ||
  (() => {
    try {
      return execSync('git rev-parse --short HEAD', {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      return 'desconocido';
    }
  })();

/** Host de la API (`NEXT_PUBLIC_API_URL`): sus subidas se sirven como imágenes optimizadas. */
const apiUrl = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL)
  : null;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },

  // Generar bundle standalone para deployment en VPS (PM2 + nginx).
  // Produce .next/standalone/server.js autocontenido con solo las deps usadas.
  output: 'standalone',

  // En monorepo pnpm, standalone necesita saber el root del workspace para
  // colectar correctamente symlinks de node_modules.
  outputFileTracingRoot: process.cwd(),

  images: {
    // VPS tiene disco y CPU libre → activar optimizer (sirve WebP/AVIF con resize
    // automatico y cache en .next/cache/images). Reduce bandwidth del navegador
    // y el egress de Firebase una sola vez por variante+ttl.
    formats: ['image/avif', 'image/webp'],
    // TTL del cache de imagenes optimizadas en el VPS (1 semana)
    minimumCacheTTL: 60 * 60 * 24 * 7,
    // Tamanos tipicos que usamos en UI (cards 48-128, previews hasta 640, hero 1200)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    // Solo el host de la API (sus subidas) y el de imágenes de catálogo. Nada de dominios
    // de un negocio en el código: la API la dice el entorno.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      ...(apiUrl
        ? [
            {
              protocol:
                apiUrl.protocol === 'https:'
                  ? ('https' as const)
                  : ('http' as const),
              hostname: apiUrl.hostname,
              port: apiUrl.port,
              pathname: '/uploads/**',
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
