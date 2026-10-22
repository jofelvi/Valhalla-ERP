/**
 * Lógica pura del logo de la marca (sin React Native, para poder probarla con `node --test`).
 *
 * El logo se sube desde Ajustes → Marca y queda guardado como URL. Puede ser absoluta
 * (`https://…`) o una ruta de la API (`/uploads/…`) si el servidor no tiene definida su URL
 * pública: en ese caso se resuelve contra la API, porque el teléfono no tiene "origen" propio.
 */

/** Convierte lo guardado en una URL que el teléfono pueda abrir. '' = sin logo. */
export function resolverUrlLogo(
  url: string | undefined,
  apiUrl: string,
): string {
  const u = (url ?? '').trim();
  if (u === '') return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/') && !u.startsWith('//')) {
    return `${apiUrl.replace(/\/+$/, '')}${u}`;
  }
  return '';
}

/**
 * Logo según el tema. Si solo hay uno, se usa en los dos temas: es lo habitual, casi nadie
 * sube dos versiones.
 */
export function elegirLogo(
  marca: { logoLightUrl: string; logoDarkUrl: string },
  oscuro: boolean,
  apiUrl: string,
): string {
  const principal = oscuro ? marca.logoDarkUrl : marca.logoLightUrl;
  const alterno = oscuro ? marca.logoLightUrl : marca.logoDarkUrl;
  return resolverUrlLogo(principal, apiUrl) || resolverUrlLogo(alterno, apiUrl);
}

/** Iniciales para el distintivo cuando no hay logo ("Taquería Los Ejemplos" → "TL"). */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => /[\p{L}\p{N}]/u.test(p));
  if (palabras.length === 0) return 'P';
  const primera = Array.from(palabras[0])[0] ?? '';
  const segunda = palabras.length > 1 ? (Array.from(palabras[1])[0] ?? '') : '';
  return (primera + segunda).toUpperCase();
}
