import { CONFIG_PUBLICA_DEFAULT, type ConfigPublica } from '@odin6/types';

/**
 * Base de la API vista desde el servidor de Next (SSR, rutas API, correos, PDF).
 * `API_URL` es la interna si existe; si no, la pública. Sin dominio fijo.
 */
export function apiBaseUrl(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  );
}

/** Etiqueta de la caché de la configuración pública; la invalida `/api/revalidar-config`. */
export const TAG_CONFIG_PUBLICA = 'config-publica';

/**
 * Configuración pública para el servidor. Cache de 60 s: un cambio en Ajustes se ve en el
 * título, el manifest y los correos en menos de un minuto. Si la API no responde sirve los
 * valores neutros: la página sale igual, solo sin marca.
 */
export async function obtenerConfigPublica(): Promise<ConfigPublica> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/config/publico`, {
      next: { revalidate: 60, tags: [TAG_CONFIG_PUBLICA] },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return CONFIG_PUBLICA_DEFAULT;
    return (await res.json()) as ConfigPublica;
  } catch {
    return CONFIG_PUBLICA_DEFAULT;
  }
}
