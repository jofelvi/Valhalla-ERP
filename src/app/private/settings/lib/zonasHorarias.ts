/** Zonas horarias frecuentes para la lista sugerida. Cualquier otra zona IANA también se acepta. */
export const ZONAS_COMUNES: readonly string[] = [
  'America/Caracas',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/Montevideo',
  'America/Asuncion',
  'America/La_Paz',
  'America/Guayaquil',
  'America/Panama',
  'America/Costa_Rica',
  'America/Guatemala',
  'America/Santo_Domingo',
  'America/Mexico_City',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'UTC',
];

/** Válida si el runtime la reconoce como zona IANA (misma comprobación que la API). */
export function esZonaValida(zona: string): boolean {
  if (zona === '' || zona.length > 60) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}
