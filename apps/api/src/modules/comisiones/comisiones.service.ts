import { Logger, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { calcularComision as comisionDeBase, NominaConfig } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { ConfigDeCalculo, nominaDeOrden } from '../orders/config-de-orden.util';
import {
  PagoComision,
  PagoComisionDocument,
} from './schemas/pago-comision.schema';
import { CreatePagoComisionDto } from './dto/create-pago-comision.dto';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { firstDateRangeFilter } from '../../common/utils/date-range-filter.util';

/** El valor si todos los de la lista son iguales; undefined si no hay lista o difieren. */
function uniforme<T>(valores: T[]): T | undefined {
  if (valores.length === 0) return undefined;
  return valores.every((v) => v === valores[0]) ? valores[0] : undefined;
}

/**
 * Interfaz local para tipificar shares en órdenes con comisión compartida
 */
interface OrderShare {
  waiterId: string;
  waiterName?: string;
  pct: number;
  comisionPagada?: boolean;
  comisionPagadaAt?: Date;
  comisionPagoId?: string;
}

@Injectable()
export class ComisionesService {
  private readonly logger = new Logger(ComisionesService.name);

  constructor(
    @InjectModel(PagoComision.name)
    private pagoComisionModel: Model<PagoComisionDocument>,
    @InjectModel(Order.name)
    private orderModel: Model<OrderDocument>,
    private readonly configs: ConfigsService,
  ) {}

  async findOrdenespendientes(waiterId: string) {
    // Órdenes con comisión POR PAGAR para este mesonero: pagadas con servicio,
    // propias sin liquidar (sin shares) o con SU share sin liquidar (traspasadas)
    const pendingOrders = await this.orderModel
      .find(
        {
          paymentStatus: 'paid',
          // Comision O propina: antes exigia `serviceCharge > 0` y una orden
          // con propina pero sin 10% de servicio no entraba NUNCA a la
          // liquidacion — la propina quedaba registrada, atribuida al
          // mesonero, y sin forma de llegarle jamas.
          //
          // La comision va sobre `comisionBase` (10% de lo cobrado, SIN
          // cortesias ni consumo de socios), no sobre `serviceCharge` (lo que
          // paga el cliente). Una cortesia total o un consumo de socio tienen
          // comisionBase = 0 y solo entran aca si dejaron propina (que se
          // conserva para el mesonero).
          $and: [
            {
              $or: [{ comisionBase: { $gt: 0 } }, { tipAmount: { $gt: 0 } }],
            },
          ],
          isDeleted: { $ne: true },
          $or: [
            {
              waiterShares: {
                $elemMatch: {
                  waiterId: waiterId,
                  comisionPagada: { $ne: true },
                },
              },
            },
            {
              $and: [
                {
                  $or: [
                    { waiterShares: { $exists: false } },
                    { waiterShares: { $size: 0 } },
                  ],
                },
                { waiterId: waiterId },
                { comisionPagada: { $ne: true } },
              ],
            },
          ],
        },
        { _id: 1 },
      )
      .lean<{ _id: string }[]>()
      .exec();

    const pagos = await this.pagoComisionModel.find({ waiterId }).lean().exec();

    return {
      waiterId,
      pendingOrderIds: pendingOrders.map((o) => String(o._id)),
      totalCommissions: pagos.length,
    };
  }

  async calcularComision(waiterId: string) {
    const pagos = await this.pagoComisionModel.find({ waiterId }).lean().exec();

    const totalMonto = pagos.reduce((sum, pago) => sum + pago.montoTotal, 0);
    const totalTip = pagos.reduce((sum, pago) => sum + (pago.tipTotal || 0), 0);

    // Share-aware: también sumar comisiones pendientes de órdenes donde tiene share sin pagar
    const sharedOrders = await this.orderModel
      .find(
        {
          waiterShares: {
            $elemMatch: {
              waiterId: waiterId,
              comisionPagada: { $ne: true },
            },
          },
        },
        {
          comisionBase: 1,
          tipAmount: 1,
          waiterShares: 1,
          configAplicada: 1,
        },
      )
      .lean<
        {
          comisionBase?: number;
          tipAmount?: number;
          configAplicada?: Partial<ConfigDeCalculo> | null;
          waiterShares?: Array<{
            waiterId: string;
            pct: number;
            comisionPagada?: boolean;
          }>;
        }[]
      >()
      .exec();

    let sharedMonto = 0;
    let sharedTip = 0;
    for (const order of sharedOrders) {
      const share = order.waiterShares?.find((s) => s.waiterId === waiterId);
      if (share && !share.comisionPagada) {
        // Comision de la orden (su base con la tasa que guardo al nacer), repartida por el share.
        const comision = comisionDeBase(
          order.comisionBase ?? 0,
          nominaDeOrden(order),
        );
        sharedMonto += this.roundMoney((comision * share.pct) / 100);
        sharedTip += this.roundMoney(
          ((order.tipAmount ?? 0) * share.pct) / 100,
        );
      }
    }

    return {
      waiterId,
      totalAmount: totalMonto + sharedMonto,
      totalTip: totalTip + sharedTip,
      paymentCount: pagos.length,
    };
  }

  /**
   * Helper: redondea a 2 decimales (patrón consistente con orders.service)
   */
  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async pagarComision(createPagoComisionDto: CreatePagoComisionDto) {
    const orderIds = createPagoComisionDto.orderIds ?? [];
    const waiterId = createPagoComisionDto.waiterId;
    // Tasa explicita del pago (0 a 100, validada en el DTO). Si no llega, cada orden
    // usa la que guardo al nacer: cambiar la nomina no mueve comisiones ya generadas.
    const tasaExplicita =
      createPagoComisionDto.comisionPct !== undefined
        ? createPagoComisionDto.comisionPct / 100
        : null;
    const nominasUsadas: NominaConfig[] = [];

    // Calcular los campos derivados (montoTotal, tipTotal, periodos) desde
    // las ordenes. Si la orden tiene waiterShares (traspaso), calculamos
    // solo la comisión de este camarero (su porcentaje del monto).
    const computed: {
      montoTotal: number;
      tipTotal: number;
      periodoDesde?: Date;
      periodoHasta?: Date;
    } = { montoTotal: 0, tipTotal: 0 };

    if (orderIds.length > 0) {
      const orders = await this.orderModel
        .find(
          { _id: { $in: orderIds } },
          {
            _id: 1,
            comisionBase: 1,
            tipAmount: 1,
            createdAt: 1,
            waiterShares: 1,
            configAplicada: 1,
          },
        )
        .lean<
          {
            _id: string;
            comisionBase?: number;
            tipAmount?: number;
            createdAt?: Date;
            waiterShares?: OrderShare[];
            configAplicada?: Partial<ConfigDeCalculo> | null;
          }[]
        >()
        .exec();

      for (const o of orders) {
        // Si la orden tiene waiterShares (fue transferida), buscar este camarero
        // en el array y calcular su porcentaje. Si no está en shares, loguear warning
        // y NO contar esta orden (excluir).
        // La comision es la formula unica sobre comisionBase (sin cortesias ni socios),
        // con la tasa que la orden guardo al nacer.
        const nomina = nominaDeOrden(o);
        let monto = comisionDeBase(o.comisionBase ?? 0, {
          ...nomina,
          commissionRate: tasaExplicita ?? nomina.commissionRate,
        });
        let tip = o.tipAmount ?? 0;

        if (o.waiterShares && o.waiterShares.length > 0) {
          const share = o.waiterShares.find(
            (s: OrderShare) => s.waiterId === waiterId,
          );
          if (!share) {
            // Este camarero no tiene share en esta orden transferida — excluir
            console.warn(
              `[Comisiones] Orden ${o._id} no tiene share para waiterId ${waiterId}, excluida del cálculo`,
            );
            continue;
          }
          // Calcular su porcentaje
          monto = this.roundMoney((monto * share.pct) / 100);
          tip = this.roundMoney((tip * share.pct) / 100);
        }

        nominasUsadas.push(nomina);
        computed.montoTotal += monto;
        computed.tipTotal += tip;

        const ts = o.createdAt ? new Date(o.createdAt) : null;
        if (ts) {
          if (!computed.periodoDesde || ts < computed.periodoDesde)
            computed.periodoDesde = ts;
          if (!computed.periodoHasta || ts > computed.periodoHasta)
            computed.periodoHasta = ts;
        }
      }
    }

    // Tasa y base que quedan escritas en el pago. Si las órdenes traen configuraciones
    // distintas, se avisa y se registra la vigente, pero cada orden ya cobró con la suya.
    const tasaDeOrdenes = uniforme(nominasUsadas.map((n) => n.commissionRate));
    if (nominasUsadas.length > 1 && tasaDeOrdenes === undefined) {
      this.logger.warn(
        `Pago de comision de ${waiterId}: las ordenes tienen tasas distintas; ` +
          `el pago registra la vigente y cada orden conserva la suya.`,
      );
    }
    const nominaVigente = await this.configs.obtener('nomina');
    const commissionRate =
      tasaExplicita ?? tasaDeOrdenes ?? nominaVigente.commissionRate;
    const commissionBasis =
      uniforme(nominasUsadas.map((n) => n.commissionBasis)) ??
      nominaVigente.commissionBasis;

    const now = new Date();
    const payload = {
      ...createPagoComisionDto,
      commissionRate,
      commissionBasis,
      comisionPct: this.roundMoney(commissionRate * 100),
      montoTotal:
        createPagoComisionDto.montoTotal ??
        this.roundMoney(computed.montoTotal),
      tipTotal:
        createPagoComisionDto.tipTotal ?? this.roundMoney(computed.tipTotal),
      periodoDesde:
        createPagoComisionDto.periodoDesde ?? computed.periodoDesde ?? now,
      periodoHasta:
        createPagoComisionDto.periodoHasta ?? computed.periodoHasta ?? now,
      fechaPago: createPagoComisionDto.fechaPago ?? now,
      usuarioPago: createPagoComisionDto.usuarioPago ?? 'system',
    };

    // ── Anti doble pago de comision (auditoria 19/08/2026) ──
    // El 26/04/2026 se crearon CUATRO registros identicos del mismo pago:
    // 11 ordenes quedaron con la comision pagada 4 veces ($41,42 de mas). No
    // habia candado ni idempotencia, igual que en el cobro. Si en los ultimos
    // 60s ya se le pago a este mesonero por las mismas ordenes, se devuelve
    // aquel pago en vez de crear otro.
    const ordenesDelPago = [...(payload.orderIds ?? [])].sort();
    if (ordenesDelPago.length > 0) {
      const desde = new Date(Date.now() - 60_000);
      const recientes = await this.pagoComisionModel
        .find({ waiterId: payload.waiterId, createdAt: { $gte: desde } })
        .lean()
        .exec();
      const gemelo = recientes.find((r) => {
        const suyas = [...((r.orderIds as string[]) ?? [])].sort();
        return (
          suyas.length === ordenesDelPago.length &&
          suyas.every((id, i) => id === ordenesDelPago[i])
        );
      });
      if (gemelo) {
        this.logger.warn(
          `Pago de comision duplicado descartado: ${payload.waiterName ?? payload.waiterId}, ` +
            `${ordenesDelPago.length} ordenes — ya existia ${String(gemelo._id)}`,
        );
        return { ...gemelo, id: String(gemelo._id) };
      }
    }

    const pago = await this.pagoComisionModel.create(payload);

    if (orderIds.length > 0) {
      // Marcar comisiones pagadas — share-aware
      for (const orderId of orderIds) {
        const order = await this.orderModel.findOne({ _id: orderId }).exec();
        if (!order) continue;

        if (order.waiterShares && order.waiterShares.length > 0) {
          // Orden transferida: marcar SOLO el share de este camarero
          const shareIndex = order.waiterShares.findIndex(
            (s: OrderShare) => s.waiterId === waiterId,
          );
          if (shareIndex >= 0) {
            const share = order.waiterShares[shareIndex];
            // Guard: si ya está pagado, no hacer nada (evitar doble pago)
            if (share.comisionPagada === true) {
              continue;
            }
            share.comisionPagada = true;
            share.comisionPagadaAt = pago.fechaPago ?? now;
            share.comisionPagoId = String(pago._id);

            // Marcar order.comisionPagada global SOLO si TODOS los shares están pagados
            const allPaid = order.waiterShares.every(
              (s: OrderShare) => s.comisionPagada === true,
            );
            if (allPaid) {
              order.comisionPagada = true;
              order.comisionPagadaAt = pago.fechaPago ?? now;
              order.comisionPagoId = String(pago._id);
            }
            // waiterShares es [Object] (Mixed): sin esto la mutación no persiste
            order.markModified('waiterShares');
            await order.save();
          }
        } else {
          // Orden sin shares (caso legacy): marcar orden globalmente
          await this.orderModel.updateOne(
            { _id: orderId },
            {
              $set: {
                comisionPagada: true,
                comisionPagadaAt: pago.fechaPago ?? now,
                comisionPagoId: String(pago._id),
              },
            },
          );
        }
      }
    }

    const obj = pago.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findHistorial(
    waiterId?: string,
    rango?: { from?: string; to?: string },
  ) {
    // Sin waiterId devuelve TODO el histórico (para la vista unificada de Nómina);
    // con waiterId filtra por ese mesonero.
    // El rango mira `fechaPago` Y `createdAt` porque los pagos viejos no
    // guardaron `fechaPago`, igual que hace la pantalla al agrupar por semana.
    const filter: Record<string, unknown> = {
      ...(waiterId ? { waiterId } : {}),
      ...(firstDateRangeFilter(
        ['fechaPago', 'createdAt'],
        rango?.from,
        rango?.to,
      ) ?? {}),
    };
    const pagos = await this.pagoComisionModel
      .find(filter)
      .sort({ fechaPago: -1 })
      .lean()
      .exec();

    return pagos.map((pago) => ({ ...pago, id: pago._id }));
  }

  async findById(id: string) {
    const pago = await this.pagoComisionModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!pago) {
      throw new NotFoundException(
        `Pago de comisión con id ${id} no encontrado`,
      );
    }
    return { ...pago, id: pago._id };
  }
}
