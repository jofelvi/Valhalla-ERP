/**
 * Filtros y tope para `GET /api/invoices`.
 *
 * `findAll()` no recibia NI UN parametro: `this.invoiceModel.find().lean()
 * .sort({createdAt:-1})` y afuera. Medido en produccion el 22/09/2026:
 * **4.735 facturas, 5.203.790 bytes crudos / 583.000 comprimidos, 2,7 s**.
 * Solo el campo `items` —las lineas de cada factura— son 2,69 MB.
 *
 * Y lo peor no es el tamano, es quien lo pedia:
 *
 * - `pos/receipt/[orderId]` llamaba `useInvoices()` **sin filtro** y despues
 *   hacia `invoicesData.find((inv) => inv.orderId === orderId)`. O sea que
 *   **imprimir un ticket se bajaba el historico completo de facturacion del
 *   negocio para usar UNA factura**, en la PC de la caja, en hora pico.
 *
 * - `useInvoiceByOrder(orderId)` mandaba `{ orderId }` como parametro y lo
 *   tipaba como `Invoice`. El parametro no existia, asi que la API devolvia el
 *   arreglo entero. El propio codigo de la pantalla de cobro ya tenia un
 *   comentario reconociendo que el tipo mentia.
 *
 * Es el mismo patron que mordio en `/api/orders`: el cliente cree que filtra,
 * el servidor ignora el parametro en silencio, y nadie se entera porque el
 * resultado *contiene* lo que se buscaba.
 */

import { paginar } from '../../common/paginacion.util';
import { facturaDeLaOrden } from '../../common/invoice-once';

/**
 * Techo absoluto. Sale de medir al consumidor mas hambriento que existe hoy:
 * `/private/invoices` lista facturas para revisar, y el mes mas cargado del
 * historico no llega a 1.500. 2.000 deja margen y sigue frenando el caso
 * patologico de bajarse las 4.735.
 */
export const LIMITE_DURO_DE_FACTURAS = 2000;

/** Cuanto se manda si el cliente no pide `limit`. */
export const LIMITE_POR_DEFECTO_DE_FACTURAS = 500;

const TOPE = {
  defecto: LIMITE_POR_DEFECTO_DE_FACTURAS,
  duro: LIMITE_DURO_DE_FACTURAS,
};

export interface FiltrosDeFacturas {
  orderId?: string;
  customerId?: string;
  from?: string;
  to?: string;
  limit?: string;
  page?: string;
  /** Ver `vista-de-facturas.util.ts`. Solo `'lista'` recorta. */
  vista?: string;
}

export interface ConsultaDeFacturas {
  query: Record<string, unknown>;
  limit: number;
  skip: number;
}

export function construirConsultaDeFacturas(
  filtros?: FiltrosDeFacturas,
): ConsultaDeFacturas {
  const query: Record<string, unknown> = {};

  // Con la condicion del indice parcial, o Mongo recorre todas las facturas
  // (ver facturaDeLaOrden).
  if (filtros?.orderId) Object.assign(query, facturaDeLaOrden(filtros.orderId));
  if (filtros?.customerId) query.customerId = filtros.customerId;

  const rango = rangoDeFechas(filtros?.from, filtros?.to);
  if (rango) query.createdAt = rango;

  // La aritmetica del tope vive en `common/paginacion.util.ts`: estaba
  // copiada aca y en ordenes, y print-logs iba a ser la tercera.
  const { limit, skip } = paginar(filtros?.limit, filtros?.page, TOPE);
  return { query, limit, skip };
}

function rangoDeFechas(
  from?: string,
  to?: string,
): { $gte?: Date; $lte?: Date } | null {
  const limites: { $gte?: Date; $lte?: Date } = {};
  if (from) {
    const gte = new Date(from);
    if (!isNaN(gte.getTime())) limites.$gte = gte;
  }
  if (to) {
    const lte = new Date(to);
    if (!isNaN(lte.getTime())) limites.$lte = lte;
  }
  return limites.$gte || limites.$lte ? limites : null;
}
