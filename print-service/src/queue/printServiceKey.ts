/**
 * Clave con la que este print-service se identifica ante la API.
 *
 * La cola de impresion lleva el qrData de cada ficha de barra (el token que
 * permite entregar); la API solo se la da a quien presente esta clave cuando
 * tiene PRINT_SERVICE_KEY_ENFORCE=true (ver apps/api/.../print-service-key.ts).
 * Sin PRINT_SERVICE_KEY en el .env de la caja no se manda nada y todo sigue
 * como antes.
 */
export const PRINT_SERVICE_KEY_HEADER = 'X-Print-Service-Key';

export const claveDelPrintService = (): string | undefined => {
  const clave = (process.env.PRINT_SERVICE_KEY ?? '').trim();
  return clave || undefined;
};

export const cabecerasDelPrintService = (): Record<string, string> => {
  const clave = claveDelPrintService();
  return clave ? { [PRINT_SERVICE_KEY_HEADER]: clave } : {};
};
