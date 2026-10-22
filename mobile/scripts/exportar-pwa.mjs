#!/usr/bin/env node
/**
 * Compila la app móvil como PWA (web, bajo /app/) y la deja lista para servir como archivos estáticos.
 *
 *   EXPO_PUBLIC_API_URL=https://api.ejemplo.com node scripts/exportar-pwa.mjs
 *
 * Después de `expo export --platform web`:
 *   1. Falla si algún bundle trae `import.meta` (SyntaxError en navegadores: pantalla blanca).
 *   2. Falla si la URL de la API no quedó horneada en el bundle.
 *   3. Copia `assets/pwa/*` (íconos y manifest) y enlaza el manifest en el index.html, para que se
 *      pueda instalar en la pantalla de inicio del teléfono.
 * El resultado queda en `dist/`; publicarlo en una carpeta servida en la ruta /app/.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const api = process.env.EXPO_PUBLIC_API_URL;
if (!api || !/^https?:\/\//.test(api)) {
  console.error('Falta EXPO_PUBLIC_API_URL (ej.: https://api.ejemplo.com): se hornea en el bundle.');
  process.exit(1);
}
const raiz = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dist = join(raiz, 'dist');
rmSync(dist, { recursive: true, force: true });

const exp = spawnSync(
  process.execPath,
  [join(raiz, 'node_modules/expo/bin/cli'), 'export', '--platform', 'web'],
  { cwd: raiz, stdio: 'inherit', env: { ...process.env, CI: '1' } },
);
if (exp.status !== 0) process.exit(exp.status ?? 1);

const carpetaJs = join(dist, '_expo/static/js/web');
const bundles = readdirSync(carpetaJs).filter((f) => f.endsWith('.js'));
let conImportMeta = 0;
let conApi = 0;
for (const f of bundles) {
  const t = readFileSync(join(carpetaJs, f), 'utf8');
  if (t.includes('import.meta')) conImportMeta++;
  if (t.includes(new URL(api).host)) conApi++;
}
if (conImportMeta > 0) {
  console.error(`${conImportMeta} bundle(s) con import.meta: no publicar (ver metro.config.js).`);
  process.exit(1);
}
if (conApi === 0) {
  console.error(`La API ${api} no quedó horneada en ningún bundle.`);
  process.exit(1);
}

cpSync(join(raiz, 'assets/pwa'), join(dist, 'assets/pwa'), { recursive: true });
const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('rel="manifest"')) {
  html = html.replace(
    '</head>',
    '<link rel="manifest" href="/app/assets/pwa/manifest.webmanifest" />\n' +
      '<link rel="apple-touch-icon" href="/app/assets/pwa/apple-touch-icon.png" />\n' +
      '<meta name="apple-mobile-web-app-capable" content="yes" />\n</head>',
  );
  writeFileSync(indexPath, html);
}
if (!existsSync(join(dist, 'assets/pwa/manifest.webmanifest'))) {
  console.error('Falta el manifest en dist/assets/pwa.');
  process.exit(1);
}
console.log(`PWA lista en ${dist}: ${bundles.length} bundles, 0 import.meta, API ${api}.`);
