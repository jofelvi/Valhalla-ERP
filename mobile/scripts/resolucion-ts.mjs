/**
 * Hooks para `node --test` sobre el código TypeScript de `mobile/` y de `packages/types`.
 *
 * 1. resolve: los módulos de `packages/types/src` importan sin extensión (`'../config/nomina'`),
 *    como manda Metro; Node en modo ESM la exige. Se prueba `.ts` e `index.ts`.
 * 2. load: Node no puede quitar los tipos de `packages/types` (importa interfaces sin
 *    `import type`). Se transpilan con el compilador de TypeScript, que elide esas importaciones
 *    igual que Babel en Metro.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const SIN_EXTENSION = ['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relativo = specifier.startsWith('./') || specifier.startsWith('../');
    if (!relativo || !SIN_EXTENSION.includes(error.code)) throw error;
    for (const sufijo of ['.ts', '/index.ts']) {
      try {
        return await nextResolve(specifier + sufijo, context);
      } catch {
        // probar el siguiente sufijo
      }
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:') || !url.endsWith('.ts'))
    return nextLoad(url, context);
  const archivo = fileURLToPath(url);
  const codigo = await readFile(archivo, 'utf8');
  const { outputText } = ts.transpileModule(codigo, {
    fileName: archivo,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return { format: 'module', source: outputText, shortCircuit: true };
}
