/**
 * Origen público (`https://host`) desde el que llegó la petición, para armar URLs absolutas de
 * archivos cuando el servidor no tiene `PUBLIC_BASE_URL`. Detrás de nginx el protocolo real viene
 * en `x-forwarded-proto` y el host en `x-forwarded-host`/`host`.
 */
export interface SolicitudConOrigen {
  protocol?: string;
  headers: Record<string, string | string[] | undefined>;
}

const primero = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : (v ?? '')).split(',')[0].trim();

export function baseUrlDeSolicitud(req: SolicitudConOrigen): string {
  const host =
    primero(req.headers['x-forwarded-host']) || primero(req.headers.host);
  // Un host con caracteres raros no se usa: acabaría dentro de una URL guardada.
  if (!/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) return '';
  const proto =
    primero(req.headers['x-forwarded-proto']) || req.protocol || 'http';
  return `${proto === 'https' ? 'https' : 'http'}://${host}`;
}

/**
 * Las URLs de archivos subidos se guardan absolutas (`https://host/uploads/...`). Si el dominio
 * de la API cambia (de IP a subdominio, de http a https), esas URLs quedan apuntando al host viejo
 * y el navegador las bloquea como contenido mixto. Al SERVIR la configuración se reanclan a la
 * base pública actual. Solo se tocan las que pasan por `/uploads/`; cualquier otra URL se respeta.
 */
export function reanclarUploads(url: string, base: string): string {
  const b = base.trim().replace(/\/+$/, '');
  if (!b || typeof url !== 'string') return url;
  const m = /^https?:\/\/[^/]+(\/uploads\/[^?#]*)$/i.exec(url.trim());
  return m ? `${b}${m[1]}` : url;
}
