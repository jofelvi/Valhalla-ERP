import { OrderStatusEnum } from '@odin6/types';

/** Filtros aceptados por findAll para armar la consulta de ordenes. */
export interface OrdersQueryFilters {
  status?: string;
  paymentStatus?: string;
  tableId?: string;
  waiterId?: string;
  orderType?: string;
  active?: boolean;
  includeDeleted?: boolean;
  ids?: string[];
  comisionPendiente?: boolean;
  creditRequested?: boolean;
  transferPendingFor?: string;
  from?: string;
  to?: string;
  /** Vista con nombre: limita los campos que viajan (ver order-views.util). */
  view?: string;
}

/**
 * Un valor suelto o varios separados por coma.
 *
 * `?paymentStatus=pending` filtraba bien, pero `?paymentStatus=pending,partial`
 * devolvia `[]`: se buscaba la cadena literal "pending,partial" como si fuera
 * un estado. Por eso la caja no podia pedirle al servidor "las pendientes de
 * cobro" —que son tres estados— y terminaba bajandose las 4.766 ordenes para
 * filtrarlas en el telefono.
 *
 * Se descartan los vacios para que "pending,," o una coma de mas no metan un
 * `''` en el `$in` y dejen la consulta sin resultados.
 */
function unoOVarios(valor: string): string | { $in: string[] } {
  if (!valor.includes(',')) return valor;
  const partes = valor
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (partes.length === 0) return valor;
  if (partes.length === 1) return partes[0];
  return { $in: partes };
}

/** Limites Mongo para un rango donde cualquiera de los dos extremos puede faltar. */
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

/**
 * Arma el objeto de filtro Mongo de findAll a partir de los params. Funcion
 * pura: no ejecuta la consulta ni proyecta (eso queda en el servicio). Toda la
 * aritmetica/orden de precedencia entre clausulas se conserva IDENTICA:
 * comisionPendiente pisa el $and de transferPendingFor y active:true pisa
 * status, tal cual el comportamiento original.
 */
export function buildOrdersQuery(
  filters?: OrdersQueryFilters,
): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  // Filtro de transferencias pendientes para un camarero específico
  if (filters?.transferPendingFor) {
    query.$and = [
      { 'transferRequest.status': 'REQUESTED' },
      { 'transferRequest.toWaiterId': filters.transferPendingFor },
    ];
  }

  // Solo órdenes con comisión por pagar (pagadas, con servicio, sin liquidar).
  // Usado por la nómina para no descargar TODAS las órdenes.
  // Share-aware: si hay waiterId, también incluir órdenes donde tiene share sin pagar
  if (filters?.comisionPendiente) {
    // La comision se paga sobre `comisionBase` (10% de lo cobrado, SIN
    // cortesias ni consumo de socios), no sobre `serviceCharge` (lo que paga
    // el cliente): una cortesia total o un consumo de socio tienen
    // serviceCharge > 0 pero comisionBase = 0, y no generan comision.
    // Incluimos tambien las que solo llevan propina: en el consumo de un
    // socio la comision es 0 pero la PROPINA se conserva (tipAmount) y la
    // nomina la reparte por weekTips.
    const comisionConditions: Record<string, unknown>[] = [
      { paymentStatus: 'paid' },
      { $or: [{ comisionBase: { $gt: 0 } }, { tipAmount: { $gt: 0 } }] },
    ];

    // Si viene waiterId, aplicar lógica share-aware
    if (filters.waiterId) {
      // Orden sin shares (legacy) o orden con shares pero este waiter no está pagado
      comisionConditions.push({
        $or: [
          // Caso 1: Orden sin shares, pertenece al waiter y comisión no pagada
          {
            $and: [
              {
                $or: [
                  { waiterShares: { $exists: false } },
                  { waiterShares: { $size: 0 } },
                ],
              },
              { waiterId: filters.waiterId },
              { comisionPagada: { $ne: true } },
            ],
          },
          // Caso 2: Orden con shares, este waiter tiene share sin pagar
          {
            waiterShares: {
              $elemMatch: {
                waiterId: filters.waiterId,
                comisionPagada: { $ne: true },
              },
            },
          },
        ],
      });
      // Ya aplicamos el filtro de waiterId en el $or, así que NO lo aplicamos después
    } else {
      // Sin waiterId específico, la lógica es la misma de antes
      comisionConditions.push({ comisionPagada: { $ne: true } });
    }

    query.$and = comisionConditions;
  }

  // Filtro de solicitudes de crédito pendientes
  if (filters?.creditRequested) {
    query['creditRequest.status'] = 'REQUESTED';
  }

  // Rango de fecha/hora: entra si fue CREADA o CERRADA (updatedAt) en el rango.
  // Soporta intervalos que cruzan medianoche. Trae solo lo del rango.
  //
  // `from` y `to` son INDEPENDIENTES. Antes la condicion era
  // `if (filters?.from && filters?.to)`, o sea que mandar uno solo no filtraba
  // NADA y la API devolvia el historico entero sin avisar. Medido en
  // produccion el 21/09/2026: `?from=2026-09-21` devolvia 1.558.989 bytes
  // contra los 80.620 de `?from=…&to=…`. El cliente cree que pidio un dia y
  // se lleva cuatro anios.
  const limites = rangoDeFechas(filters?.from, filters?.to);
  if (limites) {
    query.$or = [{ createdAt: limites }, { updatedAt: limites }];
  }

  // Por defecto excluir soft-deleted (cancelled via PIN)
  if (!filters?.includeDeleted) {
    query.isDeleted = { $ne: true };
  }

  if (filters?.status) {
    query.status = unoOVarios(filters.status);
  }

  if (filters?.paymentStatus) {
    query.paymentStatus = unoOVarios(filters.paymentStatus);
  }

  if (filters?.tableId) {
    query.tableId = filters.tableId;
  }

  // Aplicar filtro waiterId SOLO si no fue manejado ya por comisionPendiente share-aware
  if (filters?.waiterId && !filters?.comisionPendiente) {
    query.waiterId = filters.waiterId;
  }

  if (filters?.orderType) {
    query.orderType = filters.orderType;
  }

  if (filters?.ids?.length) {
    query._id = { $in: filters.ids };
  }

  if (filters?.active !== undefined) {
    if (filters.active) {
      query.status = {
        $in: [
          OrderStatusEnum.PENDING,
          OrderStatusEnum.IN_PROGRESS,
          OrderStatusEnum.READY,
        ],
      };
    }
  }

  return query;
}
