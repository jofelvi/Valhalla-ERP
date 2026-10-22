import { api } from './api/apiClient';

/**
 * Convertir cervezas entregadas en un tobo, media caja o caja.
 *
 * **El calculo vive en el servidor.** Antes vivia aca, con los precios
 * cableados en `constants/toboRegistry.ts`, y esa tabla se habia quedado
 * atras: decia que el tobo de lata costaba $11 cuando la ficha del producto
 * dice $14. Como el servidor pisa el precio del cliente con el del catalogo
 * en cada PATCH, la pantalla mostraba un numero y la cuenta decia otro. Y
 * cambiar el precio de un tobo obligaba a publicar una APK nueva y a esperar
 * semanas a que los telefonos se actualizaran.
 *
 * Ahora son dos llamadas, y la separacion es la regla del dueno
 * (20/09/2026): **convertir es una opcion, no una obligacion**. El GET
 * ofrece y no toca nada; aplicar es una decision explicita de la persona.
 */

export interface ConversionOption {
  sourceProductId: string;
  sourceProductName: string;
  targetPackId: string;
  packName: string;
  /** Unidades que trae el pack. */
  size: number;
  /** Precio de catalogo. Lo pone el servidor. */
  packPrice: number;
  numPacksPossible: number;
  currentDeliveredQty: number;
  savingsUsd: number;
}

/**
 * Que conversiones ofrece el servidor para esta orden. No convierte nada.
 *
 * Se calcula sobre lo ENTREGADO: lo que el cliente pidio y todavia no
 * recibio no cuenta.
 */
export async function opcionesDeConversion(
  orderId: string,
): Promise<ConversionOption[]> {
  const { opciones } = await api.get<{ opciones: ConversionOption[] }>(
    `/api/orders/${orderId}/opciones-conversion`,
  );
  return opciones ?? [];
}

/**
 * Aplica UNA conversion elegida.
 *
 * No se manda el precio: lo pone el servidor desde el catalogo. Tampoco hace
 * falta mandar items ni totales ni una nota aparte — antes esto eran tres
 * llamadas (PATCH de items, recalculo de totales en el telefono y POST de la
 * nota) y entre una y otra la orden podia quedar convertida sin su rastro.
 * Ahora el servidor lo guarda todo de una vez.
 *
 * NO devuelve la orden a proposito. El servidor avisa por WebSocket y la
 * pantalla la recibe por `orderService.subscribeToOrder`, que es quien la
 * NORMALIZA. Meter el JSON crudo de la respuesta en el estado se salta esa
 * normalizacion, y de ahi salieron tres bugs el 28/08/2026 — todos con el
 * build en verde, porque un campo que no se normaliza no falla: queda en
 * cero. Es el mismo patron que usan las demas mutaciones de esa pantalla.
 */
export async function aplicarConversion(
  orderId: string,
  eleccion: {
    sourceProductId: string;
    targetPackId: string;
    packsToConvert: number;
  },
): Promise<void> {
  await api.post(`/api/orders/${orderId}/convertir-pack`, eleccion);
}
