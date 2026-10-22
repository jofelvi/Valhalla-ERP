/**
 * URL utilizable de un archivo de la marca (logo, ícono).
 *
 * Los archivos subidos desde Ajustes → Marca viven en la API (`/uploads/…`). La API devuelve la
 * URL absoluta, pero una subida antigua o un servidor sin `PUBLIC_BASE_URL` pueden haber dejado
 * la ruta relativa, que desde la web apuntaría al dominio equivocado. Esas rutas se resuelven
 * contra la API; cualquier otra cosa (https, `/icono.svg` de la propia web) se deja como está.
 */
export function resolverUrlMarca(
  url: string | undefined,
  apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL,
): string {
  const u = (url ?? '').trim();
  if (u.startsWith('/uploads/') && apiUrl) {
    return `${apiUrl.replace(/\/+$/, '')}${u}`;
  }
  return u;
}
