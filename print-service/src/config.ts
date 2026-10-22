import path from 'path';
import dotenv from 'dotenv';

/**
 * Configuración del servicio. Todo sale del .env de la instalación: no hay
 * valores por defecto de ningún negocio (ni URL de API, ni nombres de
 * impresora, ni carpetas de otra instalación).
 *
 * Este módulo se importa ANTES que cualquier otro del servicio: carga el .env
 * aquí, porque los módulos leen process.env al cargarse y el dotenv que estaba
 * en index.ts corría después de sus imports.
 */

// dist/config.js o src/config.ts → la raíz del servicio está un nivel arriba.
export const DIR_SERVICIO = path.resolve(__dirname, '..');

dotenv.config({
  path: process.env.ENV_FILE || path.join(DIR_SERVICIO, '.env'),
});

/** URL base de la API (sin barra final). Vacía si no está configurada. */
export const API_URL = (process.env.API_URL ?? '').trim().replace(/\/+$/, '');

/** Modo prueba: no consume la cola. Entonces API_URL no es obligatoria. */
export const COLA_DESACTIVADA =
  process.env.DISABLE_QUEUE === '1' || process.env.DISABLE_QUEUE === 'true';

/**
 * Carpeta donde el vigilante de impresoras publica estado-impresoras.json.
 * Por defecto, la propia carpeta del servicio.
 */
export const DIR_ESTADO_IMPRESORAS =
  process.env.ESTADO_IMPRESORAS_DIR || DIR_SERVICIO;

/**
 * Patrón (regex, sin barras) de los productos que van a la barra 1 cuando el
 * equipo corre en modo bar-1 / bar-2. Vacío = ningún producto cae por nombre y
 * la barra 1 solo recibe pedidos de mesa.
 */
export const PATRON_BARRA_1_TEXTO = (process.env.BARRA_1_PATRON ?? '').trim();

/** Lista de variables obligatorias que faltan. Vacía si todo está bien. */
export function faltantesObligatorios(): string[] {
  const faltan: string[] = [];
  if (!API_URL && !COLA_DESACTIVADA) faltan.push('API_URL');
  if (PATRON_BARRA_1_TEXTO) {
    try {
      new RegExp(PATRON_BARRA_1_TEXTO, 'i');
    } catch {
      faltan.push('BARRA_1_PATRON (expresión regular inválida)');
    }
  }
  return faltan;
}
