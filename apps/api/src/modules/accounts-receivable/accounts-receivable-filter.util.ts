/**
 * El filtro con el que se listan las cuentas por cobrar.
 *
 * Sale a un archivo aparte por dos razones: se puede probar sin levantar
 * Mongo, y ahi vive la regla que evita el peor fallo posible de este endpoint
 * — que una lista de clientes vacia se interprete como "sin filtro" y devuelva
 * la cartera completa.
 *
 * `customerIds` nace el 08/09/2026 para el N+1 de la nomina: cada fila de
 * empleado pedia sus cuentas por separado (9 peticiones medidas en modo
 * usuario). Con la lista, la pantalla entera hace una sola.
 *
 * `soloVivas`, `tab`, `desde`, `hasta` y `q` nacen el 20/09/2026: la pantalla
 * de cuentas por cobrar se bajaba las 1.067 cuentas (911 KB) para mostrar 175,
 * porque filtraba en el navegador. 627 de esas cuentas eran unificadas que se
 * descartaban en el acto. Ahora el filtro se aplica donde estan los datos.
 */

import { OperacionConfig } from '@odin6/types';
import {
  finDeDiaCalendario,
  medianocheDe,
} from '../../common/operacion/operacion.util';
import { filtroDeTexto } from '../../common/busqueda-texto.util';

export interface AccountsReceivableFilters {
  customerId?: string;
  customerIds?: string[];
  status?: string;
  /**
   * Aparta lo que no es cartera real: las absorbidas por una unificacion (la
   * consolidada ya suma sus montos, contarlas otra vez es doble conteo) y las
   * anuladas (borrado logico).
   */
  soloVivas?: boolean;
  /** `history` = pagadas. `pending` = todo lo que no esta pagado. */
  tab?: string;
  /** `YYYY-MM-DD`, interpretado en la zona de la operacion. */
  desde?: string;
  hasta?: string;
  /** Texto libre: factura, descripcion o nombre del cliente. */
  q?: string;
  /**
   * Ids de clientes que el texto buscado ya encontro por nombre o por N° de
   * accion. El N° de accion vive en `customers`, no en la cuenta, asi que el
   * servicio lo resuelve antes y lo pasa por aqui.
   */
  customerIdsPorTexto?: string[];
}

/** Filtro de Mongo listo para `find()`. */
export type AccountsReceivableQuery = Record<string, unknown>;

const ESTADO_PAGADA = 'paid';
const ESTADO_ANULADA = 'cancelled';

/** Los campos de la cuenta en los que se busca texto. */
const CAMPOS_DE_TEXTO = ['invoiceNumber', 'description', 'customerName'];

const clean = (ids: readonly string[]): string[] => [
  ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
];

/**
 * Parte el parametro `?customerIds=a,b,c`.
 *
 * Devuelve `undefined` solo cuando el parametro NO viene. Una cadena vacia
 * devuelve `[]`, que significa "ningun cliente" y no "todos": el que pide una
 * lista vacia tiene que recibir cero cuentas.
 */
export const parseCustomerIds = (raw?: string): string[] | undefined =>
  raw === undefined ? undefined : clean(raw.split(','));

/** `true` para `'1'`, `'true'` y `''` (bandera presente sin valor). */
export const parseBandera = (raw?: string): boolean =>
  raw !== undefined && raw !== '0' && raw !== 'false';

/**
 * La regla de busqueda de texto vive en `common/busqueda-texto.util.ts` desde
 * el 25/09/2026: nacio aqui, pero la usan tambien el catalogo de productos y
 * el bot de gastos. Se re-exporta para no romper a quien ya la importaba por
 * este camino (las pruebas de este archivo, entre otros).
 */
export {
  escaparRegex,
  normalizarTexto,
  palabrasDe,
  patronTolerante,
  patronDeDigitos,
  patronesDePalabra,
  clausulasDePalabra,
  filtroDeTexto,
} from '../../common/busqueda-texto.util';

/**
 * La zona NUNCA se toma del servidor: un rango "del 1 al 5" que se interprete en UTC se come
 * las ventas de la última parte de la noche. Se interpreta en la zona de `operacion`.
 */
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha `YYYY-MM-DD` válida (no `2026-02-30`), o `null`. */
const fechaValida = (fecha?: string): string | null => {
  if (!fecha || !FECHA_ISO.test(fecha)) return null;
  const d = new Date(`${fecha}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== fecha
    ? null
    : fecha;
};

/** Instante en que empieza ese dia en la zona de la operacion, o `null` si la fecha no sirve. */
export const inicioDelDia = (
  fecha: string | undefined,
  op: OperacionConfig,
): Date | null => {
  const dia = fechaValida(fecha);
  return dia ? medianocheDe(dia, op) : null;
};

/** Instante en el que termina ese dia en la zona de la operacion (inclusive). */
export const finDelDia = (
  fecha: string | undefined,
  op: OperacionConfig,
): Date | null => {
  const dia = fechaValida(fecha);
  return dia ? finDeDiaCalendario(dia, op) : null;
};

/**
 * La parte del filtro que comparte la lista con el resumen: cliente, fechas y
 * texto. El estado va aparte porque el resumen necesita contar tambien lo que
 * la lista esconde (anuladas y unificadas).
 */
export const buildAccountsReceivableBaseFilter = (
  filters: AccountsReceivableFilters,
  op: OperacionConfig,
): AccountsReceivableQuery => {
  const query: AccountsReceivableQuery = {};

  // La lista manda sobre el cliente suelto: quien pide varias no quiere que
  // un `customerId` heredado le recorte el resultado.
  if (filters.customerIds !== undefined) {
    query.customerId = { $in: clean(filters.customerIds) };
  } else if (filters.customerId) {
    query.customerId = filters.customerId;
  }

  const desde = inicioDelDia(filters.desde, op);
  const hasta = finDelDia(filters.hasta, op);
  if (desde || hasta) {
    query.createdAt = {
      ...(desde ? { $gte: desde } : {}),
      ...(hasta ? { $lte: hasta } : {}),
    };
  }

  // O coincide la cuenta por sus propios campos, o coincide el cliente: el
  // N° de accion y el nombre viven en `customers`, y el servicio ya resolvio
  // quienes son antes de llegar aqui.
  const porCampos = filtroDeTexto(filters.q, CAMPOS_DE_TEXTO);
  if (porCampos) {
    const porCliente = clean(filters.customerIdsPorTexto ?? []);
    query.$or = porCliente.length
      ? [{ customerId: { $in: porCliente } }, porCampos]
      : [porCampos];
  }

  return query;
};

/**
 * La condicion sobre `status`, en UN solo sitio.
 *
 * Existe porque estuvo escrita dos veces —aqui y en la agregacion del
 * resumen— y la copia se equivoco: juntaba `{status: {$ne:'cancelled'}}` con
 * `{status: {$ne:'paid'}}` en el mismo objeto, y la segunda pisaba a la
 * primera. Resultado: las cuentas anuladas volvian a entrar en el total, que
 * es EXACTAMENTE el bug que todo esto venia a arreglar (detectado el
 * 20/09/2026 al ver 184 cuentas en la cartera contra 159 en el desglose).
 *
 * Devuelve `{}` cuando no hay que restringir nada.
 */
export const condicionDeEstado = (
  filters: AccountsReceivableFilters = {},
): AccountsReceivableQuery => {
  // Un estado pedido a mano manda sobre todo lo demas: si alguien pide ver las
  // anuladas, se le muestran.
  if (filters.status) return { status: filters.status };
  if (filters.tab === 'history') return { status: ESTADO_PAGADA };

  const fuera: string[] = [];
  if (filters.soloVivas) fuera.push(ESTADO_ANULADA);
  if (filters.tab) fuera.push(ESTADO_PAGADA);

  if (fuera.length === 0) return {};
  if (fuera.length === 1) return { status: { $ne: fuera[0] } };
  return { status: { $nin: fuera } };
};

export const buildAccountsReceivableFilter = (
  filters: AccountsReceivableFilters,
  op: OperacionConfig,
): AccountsReceivableQuery => {
  const query = buildAccountsReceivableBaseFilter(filters, op);

  if (filters.soloVivas) {
    query.isMerged = { $ne: true };
  }

  return { ...query, ...condicionDeEstado(filters) };
};
