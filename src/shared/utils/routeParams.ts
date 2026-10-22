/**
 * Normaliza un valor de `useParams()` de Next.js (que puede venir como
 * `string | string[] | undefined`) al string único que las rutas dinámicas
 * `[id]` siempre representan en la práctica. Evita repetir el narrowing en
 * cada pantalla y quita los errores de `ParamValue` no asignable a `string`.
 */
export const getRouteParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
