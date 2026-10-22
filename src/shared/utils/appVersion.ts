/**
 * Que codigo esta corriendo en esta web.
 *
 * Los tres valores los inyecta `next.config.ts` en tiempo de build (ver el
 * bloque `env`). Se leen como literales `process.env.NEXT_PUBLIC_*` a proposito:
 * Next los reemplaza por su valor al compilar, tanto en el bundle del navegador
 * como en el del servidor, asi que lo que se ve aca no puede contradecir al
 * bundle que lo contiene.
 *
 * El 'desconocido' solo deberia aparecer en un build hecho fuera del flujo
 * normal; si sale en produccion, el deploy no paso por `next.config.ts`.
 */

export interface AppVersionInfo {
  app: 'web' | 'api';
  version: string;
  sha: string;
  buildTime: string;
}

export const WEB_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'desconocido';
export const WEB_COMMIT_SHA =
  process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'desconocido';
export const WEB_BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? '';

export const webVersionInfo: AppVersionInfo = {
  app: 'web',
  version: WEB_VERSION,
  sha: WEB_COMMIT_SHA,
  buildTime: WEB_BUILD_TIME,
};

/** `1.0.0 · 9f45bf5` — lo que se muestra en el pie del sidebar. */
export const formatVersionTag = (info: AppVersionInfo): string =>
  `${info.version} · ${info.sha}`;

/** Fecha de build legible, o cadena vacia si el build no la dejo. */
export const formatBuildTime = (buildTime: string): string => {
  if (!buildTime) return '';
  const fecha = new Date(buildTime);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
