/**
 * Cantidad de un conteo físico tal como la teclea la persona.
 *
 * El campo guarda el TEXTO, no un número. Con `parseFloat(texto) || 0` en cada
 * tecla, "0." volvía a "0" y no se podían escribir decimales ("0.5" quedaba 5,
 * "1,5" quedaba 15) y borrar el campo lo convertía en 0 — medido en la PWA el
 * 12/09 con Playwright. El número solo se saca al enviar.
 */
const DECIMAL_INPUT = /^\d*([.,]\d*)?$/;

/** Solo deja pasar lo que puede llegar a ser una cantidad mientras se escribe. */
export const isTypingCountQuantity = (text: string): boolean =>
  DECIMAL_INPUT.test(text);

/** Texto → cantidad. Vacío o incompleto ("." / ",") = sin contar. Acepta coma. */
export const parseCountQuantity = (text: string): number | undefined => {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || normalized === '.') return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};
