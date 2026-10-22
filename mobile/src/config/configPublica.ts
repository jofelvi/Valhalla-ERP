import { ConfigPublica, normalizeConfig } from '../shared/contrato';

/** Clave de AsyncStorage con la última configuración válida. Prefijo neutro `pos:`. */
export const CLAVE_CACHE_CONFIG = 'pos:configPublica';

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Una respuesta de `GET /api/config/publico` es utilizable si trae sus bloques
 * principales como objetos. Lo demás se normaliza campo por campo.
 */
export function esRespuestaValida(
  raw: unknown,
): raw is Record<string, unknown> {
  return (
    esObjeto(raw) &&
    esObjeto(raw.marca) &&
    esObjeto(raw.tarifas) &&
    esObjeto(raw.negocio)
  );
}

/**
 * Pasa cada bloque por su normalizador: lo que falta o viene corrupto cae al valor
 * neutro, así que una respuesta a medias nunca rompe una pantalla.
 */
export function normalizarConfigPublica(raw: unknown): ConfigPublica {
  const r = esObjeto(raw) ? raw : {};
  return {
    configured: r.configured === true,
    negocio: normalizeConfig('negocio', r.negocio),
    marca: normalizeConfig('marca', r.marca),
    tarifas: normalizeConfig('tarifas', r.tarifas),
    operacion: normalizeConfig('operacion', r.operacion),
    vocabulario: normalizeConfig('vocabulario', r.vocabulario),
    modulos: normalizeConfig('modulos', r.modulos),
  };
}

/**
 * Lee el texto guardado en caché. Devuelve null si no hay nada, si no es JSON o si no
 * es una configuración válida: en esos casos la app usa los valores neutros.
 */
export function leerCacheConfig(texto: string | null): ConfigPublica | null {
  if (!texto) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(texto);
  } catch {
    return null;
  }
  return esRespuestaValida(parsed) ? normalizarConfigPublica(parsed) : null;
}
