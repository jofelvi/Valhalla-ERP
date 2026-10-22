/**
 * Cuantas palabras "de verdad" trae una lectura del OCR.
 *
 * Sirve para saber si la foto estaba de lado. Telegram le quita a la foto el
 * dato de orientacion (EXIF), asi que `-auto-orient` no la endereza: la
 * factura de Viveluso fotografiada acostada salio con 0 caracteres y el bot
 * no reconocio nada (18/09/2026). Girada, se lee entera.
 *
 * Una palabra cuenta si tiene 3+ letras, alguna vocal y forma de palabra
 * (TODO MAYUSCULA o Capitalizada): la basura de leer al reves ("eLpay",
 * "cobed") casi nunca cumple las tres. Las palabras de factura pesan mas.
 */
const PALABRAS_DE_FACTURA =
  /^(TOTAL|FECHA|CANTIDAD|CANT|PRECIO|DESCRIPCI[OÓ]N|CLIENTE|FACTURA|PRESUPUESTO|IVA|RIF|CAJA|KILO|UNIDAD|MONTO|SUBTOTAL|OPERACI[OÓ]N|BANCO|CONCEPTO|DIRECCI[OÓ]N)$/i;

export function puntajeDeLectura(raw: string): number {
  const palabras = (raw ?? '').match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/g) ?? [];
  let puntos = 0;
  for (const w of palabras) {
    if (!/[aeiouáéíóú]/i.test(w)) continue;
    if (!/^([A-ZÁÉÍÓÚÑ]+|[A-ZÁÉÍÓÚÑ]?[a-záéíóúñ]+)$/.test(w)) continue;
    puntos += PALABRAS_DE_FACTURA.test(w) ? 5 : 1;
  }
  return puntos;
}

/** Por debajo de esto la foto probablemente esta de lado: se prueban los giros. */
export const PUNTAJE_MINIMO_DERECHA = 8;

/** Los giros a probar cuando la lectura derecha no alcanza. */
export const GIROS = [90, 270, 180] as const;
