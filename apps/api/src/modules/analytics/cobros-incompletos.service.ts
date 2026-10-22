import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  AccountReceivable,
  AccountReceivableDocument,
} from '../accounts-receivable/schemas/account-receivable.schema';
import { SociosExcluidosService } from '../socios-excluidos/socios-excluidos.service';
import { TurnosSociosService } from './turnos-socios.service';
import { socioDe } from './turnos-socios.helper';

/** Un pago tal como se le muestra a quien reclama. */
export interface PagoDeclarado {
  id: string;
  method: string;
  amount: number;
  transactionId?: string | null;
  /** Foto del comprobante que subio el mesonero, si la hay. */
  proofImageUrl?: string | null;
  createdAt?: Date;
  /** Quien lo cargo. En el esquema el campo es `userId`. */
  userId?: string | null;
}

export interface OrdenSinCubrir {
  id: string;
  orderNumber?: string;
  createdAt?: Date;
  tableName?: string;
  sector?: string;
  waiterName: string;
  customerName?: string;
  /** Consumo + propina: lo que habia que cobrar. */
  debido: number;
  /** Suma de los pagos registrados. */
  declarado: number;
  /** Lo que falta. Siempre > 0 en esta lista. */
  faltante: number;
  items: Array<{ nombre: string; cantidad: number; total: number }>;
  pagos: PagoDeclarado[];
}

export interface ResumenCobrosIncompletos {
  desde: Date;
  hasta: Date;
  totalFaltante: number;
  ordenes: number;
  sinNingunPago: number;
  porMesonero: Array<{ waiterName: string; ordenes: number; faltante: number }>;
  detalle: OrdenSinCubrir[];
}

/** Una semana de administracion, con lo que paso en ella. */
export interface SemanaDeSocio {
  /** Martes 6am VE en que arranca. */
  desde: Date;
  /** Lunes 6am VE en que termina (el lunes no se factura). */
  hasta: Date;
  socio: string;
  /** true si el socio salio de la rotacion calculada y no de un ajuste manual. */
  estimado: boolean;
  venta: number;
  ordenes: number;
  incompletos: number;
  faltante: number;
  porMesonero: Array<{ waiterName: string; ordenes: number; faltante: number }>;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Ordenes cerradas como PAGADAS cuyos pagos registrados no cubren la cuenta.
 *
 * El panel de ventas confia en `paymentStatus`, no en los pagos: una orden mal
 * cerrada suma al ingreso sin que exista el dinero detras. Esto lo saca a la
 * luz con el detalle para poder reclamarlo — quien atendio, que consumieron,
 * que se declaro y la foto del comprobante.
 *
 * Se excluyen a proposito, porque sin estos tres filtros la lista es ruido:
 *
 * - **Las que tienen cuenta por cobrar.** Es el filtro que mas importa: dejar
 *   una cuenta a credito es un cierre legitimo, no plata faltante. Sin esto,
 *   la lista pasa de 39 casos a 232 y el 84% son creditos normales — incluidas
 *   las dos mas grandes de agosto, que eran invitados con su credito abierto.
 * - Las ordenes migradas de Firebase (`_firestoreCreatedAt`): la orden se
 *   migro pero sus pagos no, asi que TODAS aparecerian como impagas. En
 *   febrero y marzo eran el 100% de los hallazgos.
 * - El consumo de los socios directivos, que por acuerdo no se cobran.
 */
@Injectable()
export class CobrosIncompletosService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(AccountReceivable.name)
    private accountReceivableModel: Model<AccountReceivableDocument>,
    private readonly socios: SociosExcluidosService,
    private readonly turnosSocios: TurnosSociosService,
  ) {}

  async listar(desde: Date, hasta: Date): Promise<ResumenCobrosIncompletos> {
    const excluidos = await this.idsDeSocios();

    const ordenes = await this.orderModel
      .find({
        isDeleted: { $ne: true },
        paymentStatus: 'paid',
        status: { $ne: 'CANCELLED' },
        createdAt: { $gte: desde, $lt: hasta },
        _firestoreCreatedAt: { $exists: false },
      })
      .sort({ createdAt: -1 })
      .lean();

    const ids = ordenes.map((o) => String(o._id));
    const pagos = await this.paymentModel
      .find({ orderId: { $in: ids } })
      .sort({ createdAt: 1 })
      .lean();

    // Ordenes que terminaron en una cuenta por cobrar: el saldo esta declarado
    // como credito, no perdido. Se sacan de la lista.
    const conCredito = new Set(
      (
        await this.accountReceivableModel
          .find({ orderId: { $in: ids } }, { orderId: 1 })
          .lean()
      ).map((a) => String(a.orderId)),
    );

    const pagosPorOrden = new Map<string, PagoDeclarado[]>();
    for (const p of pagos) {
      const key = String(p.orderId);
      const lista = pagosPorOrden.get(key) ?? [];
      lista.push({
        id: String(p._id),
        method: String(p.method ?? '(sin metodo)'),
        amount: p.amount ?? 0,
        transactionId: p.transactionId ?? null,
        proofImageUrl: p.proofImageUrl ?? null,
        createdAt: p.createdAt,
        userId: p.userId ?? null,
      });
      pagosPorOrden.set(key, lista);
    }

    const detalle: OrdenSinCubrir[] = [];
    for (const o of ordenes) {
      if (o.customerId && excluidos.has(String(o.customerId))) continue;
      if (conCredito.has(String(o._id))) continue;

      const debido = r2((o.total ?? 0) + (o.tipAmount ?? 0));
      if (debido <= 0) continue;

      const misPagos = pagosPorOrden.get(String(o._id)) ?? [];
      const declarado = r2(misPagos.reduce((s, p) => s + p.amount, 0));
      const faltante = r2(debido - declarado);
      // Dos centavos de margen: el redondeo de la conversion Bs->USD no es
      // un cobro incompleto.
      if (faltante <= 0.02) continue;

      detalle.push({
        id: String(o._id),
        orderNumber: o.orderNumber,
        createdAt: (o as unknown as { createdAt?: Date }).createdAt,
        tableName: o.tableName,
        sector: o.sector,
        waiterName: o.waiterName ?? '(sin mesonero)',
        customerName: o.customerName ?? undefined,
        debido,
        declarado,
        faltante,
        items: (o.items ?? []).map((i) => ({
          nombre: String(
            (i as { productName?: string; name?: string }).productName ??
              (i as { name?: string }).name ??
              '(?)',
          ),
          cantidad: Number((i as { quantity?: number }).quantity ?? 0),
          total: Number(
            (i as { totalPrice?: number; total?: number }).totalPrice ??
              (i as { total?: number }).total ??
              0,
          ),
        })),
        pagos: misPagos,
      });
    }

    const porMesoneroMap = new Map<
      string,
      { ordenes: number; faltante: number }
    >();
    for (const d of detalle) {
      const previo = porMesoneroMap.get(d.waiterName) ?? {
        ordenes: 0,
        faltante: 0,
      };
      previo.ordenes += 1;
      previo.faltante = r2(previo.faltante + d.faltante);
      porMesoneroMap.set(d.waiterName, previo);
    }

    return {
      desde,
      hasta,
      totalFaltante: r2(detalle.reduce((s, d) => s + d.faltante, 0)),
      ordenes: detalle.length,
      sinNingunPago: detalle.filter((d) => d.pagos.length === 0).length,
      porMesonero: Array.from(porMesoneroMap.entries())
        .map(([waiterName, v]) => ({ waiterName, ...v }))
        .sort((a, b) => b.faltante - a.faltante),
      detalle: detalle.sort((a, b) => b.faltante - a.faltante),
    };
  }

  /** Clientes cuyo consumo no se cobra por acuerdo entre los socios. */
  private async idsDeSocios(): Promise<Set<string>> {
    try {
      // `resolver()` ya traduce las acciones del padron a ids de cliente: es la
      // misma fuente que usa el panel, asi que los dos numeros no se separan.
      const config = await this.socios.resolver();
      if (!config?.habilitado) return new Set();
      return new Set((config.customerIds ?? []).map(String));
    } catch {
      // Sin la lista se muestran de mas, nunca de menos: es preferible revisar
      // una orden que no correspondia a esconder una que si.
      return new Set();
    }
  }

  /**
   * Semanas de administracion con lo que paso en cada una.
   *
   * La semana va de martes 6am a lunes 6am (el lunes no se factura), igual que
   * el cuadre semanal del negocio.
   *
   * De quien es cada semana sale de `configs/turnos_socios`. Vive en Mongo y no
   * en el codigo porque los socios se cambian semanas entre ellos: si estuviera
   * quemado, cada intercambio necesitaria un despliegue y mientras tanto la
   * pantalla acusaria a la persona equivocada. Lo que la rotacion calcula viene
   * marcado como `estimado`; un ajuste manual en `excepciones` lo pisa.
   */
  async porSemana(desde: Date, hasta: Date): Promise<SemanaDeSocio[]> {
    const turnos = await this.turnosSocios.leerTurnos();
    const excluidos = await this.idsDeSocios();

    const ordenes = await this.orderModel
      .find({
        isDeleted: { $ne: true },
        status: { $ne: 'CANCELLED' },
        createdAt: { $gte: desde, $lt: hasta },
      })
      .lean();

    const ids = ordenes.map((o) => String(o._id));
    const conCredito = new Set(
      (
        await this.accountReceivableModel
          .find({ orderId: { $in: ids } }, { orderId: 1 })
          .lean()
      ).map((a) => String(a.orderId)),
    );
    const cobradoPorOrden = new Map<string, number>();
    for (const p of await this.paymentModel
      .find({ orderId: { $in: ids } }, { orderId: 1, amount: 1 })
      .lean()) {
      const k = String(p.orderId);
      cobradoPorOrden.set(k, (cobradoPorOrden.get(k) ?? 0) + (p.amount ?? 0));
    }

    const semanas: SemanaDeSocio[] = [];
    for (
      let ini = new Date(turnos.ancla);
      ini < hasta;
      ini = new Date(ini.getTime() + 7 * 86400000)
    ) {
      if (ini.getTime() + 7 * 86400000 <= desde.getTime()) continue;
      const fin = new Date(ini.getTime() + 6 * 86400000);
      const { socio, estimado } = socioDe(ini, turnos);

      const deLaSemana = ordenes.filter((o) => {
        const c = (o as unknown as { createdAt?: Date }).createdAt;
        if (!c) return false;
        const t = new Date(c).getTime();
        return t >= ini.getTime() && t < fin.getTime();
      });

      let venta = 0;
      let incompletos = 0;
      let faltante = 0;
      const porW = new Map<string, { ordenes: number; faltante: number }>();

      for (const o of deLaSemana) {
        if (o.customerId && excluidos.has(String(o.customerId))) continue;
        venta += o.total ?? 0;

        if (String(o.paymentStatus) !== 'paid') continue;
        if (conCredito.has(String(o._id))) continue;
        if (
          (o as unknown as { _firestoreCreatedAt?: Date })._firestoreCreatedAt
        )
          continue;
        const debido = (o.total ?? 0) + (o.tipAmount ?? 0);
        if (debido <= 0) continue;
        const dif = r2(debido - (cobradoPorOrden.get(String(o._id)) ?? 0));
        if (dif <= 0.02) continue;

        incompletos += 1;
        faltante += dif;
        const w = o.waiterName ?? '(sin mesonero)';
        const previo = porW.get(w) ?? { ordenes: 0, faltante: 0 };
        previo.ordenes += 1;
        previo.faltante = r2(previo.faltante + dif);
        porW.set(w, previo);
      }

      semanas.push({
        desde: new Date(ini),
        hasta: fin,
        socio,
        estimado,
        venta: r2(venta),
        ordenes: deLaSemana.filter(
          (o) => !(o.customerId && excluidos.has(String(o.customerId))),
        ).length,
        incompletos,
        faltante: r2(faltante),
        porMesonero: Array.from(porW.entries())
          .map(([waiterName, v]) => ({ waiterName, ...v }))
          .sort((a, b) => b.faltante - a.faltante),
      });
    }

    return semanas.reverse();
  }
}
