import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { OrderDocument, Order } from '../../orders/schemas/order.schema';
import { OperacionConfig } from '@odin6/types';
import { ConfigsService } from '../../configs/configs.service';
import { paredEnZona } from '../../../common/operacion/operacion.util';
import {
  Payment,
  PaymentDocument,
} from '../../payments/schemas/payment.schema';
import { SociosExcluidosService } from '../../socios-excluidos/socios-excluidos.service';
import {
  IntervaloPanel,
  RangoPanel,
  etiquetaDeJornada,
  rangoDe,
  sumarJornadas,
} from './panel-rango.util';

/**
 * Los numeros del panel, calculados en la base.
 *
 * Antes el panel se armaba en el navegador: bajaba `/api/orders` (11,22 MB,
 * 4.740 ordenes), `/api/payments` (1,55 MB), `/api/customers` (1,11 MB) y
 * `/api/products` (0,46 MB) — 14,35 MB y ~9 s — y recorria todo eso en el hilo
 * principal para pintar seis tarjetas. Ademas cada tarjeta aplicaba su propio
 * criterio de "que cuenta como venta", asi que la venta del dia y el ranking de
 * mesoneros nunca cuadraban entre si.
 *
 * Aqui hay UN solo criterio, escrito una vez (`ventaContable`), y cada tarjeta
 * es una consulta independiente.
 */

/** Pago por nomina: es un descuento contra el sueldo, no plata que entro. */
const DESCUENTO_NOMINA = 'PAYROLL_DEDUCTION';

const METODOS_PAGO_MOVIL = ['PAGO_MOVIL', 'PAGO_MOVIL_MANUAL'];
const METODO_PUNTO = 'CARD';
const METODO_EFECTIVO_USD = 'CASH_USD';
const METODO_EFECTIVO_BS = 'CASH_BS';

/**
 * Bolivares a su valor nominal: sale de la tasa que quedo grabada en el pago,
 * no de la de hoy. `p` es donde vive el pago en el documento: '$' o '$pagos.'.
 */
const nominalEnBs = (p: string) => ({
  $cond: [
    { $eq: [`${p}method`, METODO_EFECTIVO_BS] },
    {
      $ifNull: [
        `${p}expectedAmountBS`,
        {
          $multiply: [
            { $ifNull: [`${p}amount`, 0] },
            { $ifNull: [`${p}bcvRate`, 0] },
          ],
        },
      ],
    },
    0,
  ],
});

export interface VentasDelPanel {
  periodo: { desde: string; hasta: string; etiqueta: string };
  /** Facturado en el periodo, se haya cobrado o no. Sin propina. */
  venta: number;
  ordenes: number;
  /** Lo que de verdad entro, calculado desde los PAGOS y sin propina. */
  cobrado: number;
  /** Propina que entro junto con esos pagos. Es del mesonero, no del negocio. */
  propinaCobrada: number;
  /** Propina total del periodo, incluida la de cuentas aun sin cobrar. */
  propinaTotal: number;
  /** Facturado que sigue sin cobrarse. */
  porCobrar: number;
  socios: { monto: number; ordenes: number };
  comparacion: {
    etiqueta: string;
    venta: number;
    variacionPct: number | null;
  } | null;
}

export interface DetalleDeMetodo {
  etiqueta: string;
  monto: number;
  /** Valor nominal en la moneda real, cuando no es USD (bolivares). */
  nominal?: { moneda: string; monto: number };
}

export interface MetodoDePago {
  clave: string;
  etiqueta: string;
  /** Lo que entro por ese metodo, propina incluida: contra esto cuadra el banco. */
  bruto: number;
  /** La parte que es venta del negocio. */
  venta: number;
  /** La parte que es del mesonero. */
  propina: number;
  pagos: number;
  /** Desglose interno, cuando el metodo agrupa varias monedas o variantes. */
  detalle?: DetalleDeMetodo[];
}

export interface MetodosDePagoDelPanel {
  periodo: { desde: string; hasta: string; etiqueta: string };
  metodos: MetodoDePago[];
  /**
   * Suma de `bruto` de todos los metodos: TODO lo que entro en el periodo, se
   * haya vendido cuando se haya vendido. Es lo que ve el banco.
   */
  totalEntro: number;
  /** La parte de `totalEntro` que viene de ordenes nacidas en el periodo. */
  totalDeVentas: number;
  totalVenta: number;
  totalPropina: number;
  /** Efectivo en bolivares, en su valor nominal (a la tasa del dia del pago). */
  bolivaresNominal: number;
  credito: { monto: number; cuentas: number };
  creditoSocios: { monto: number; cuentas: number };
  /** La parte de `totalEntro` que se vendio ANTES del periodo. */
  otrosPeriodos: {
    deOrdenesAnteriores: number;
    /** Cobros de cuentas por cobrar consolidadas: el pago apunta a la cuenta. */
    deCartera: number;
    /** Pagos cuya orden ya no existe: la plata entro igual. */
    sinOrden: number;
    pagos: number;
  };
  descuentoNomina: number;
}

export interface DiaDeVenta {
  dia: string;
  etiqueta: string;
  venta: number;
  ordenes: number;
}

export interface ProductoDelRanking {
  productId: string;
  nombre: string;
  cantidad: number;
  venta: number;
}

export interface MesoneroDelRanking {
  waiterId: string;
  nombre: string;
  ordenes: number;
  venta: number;
  ticketPromedio: number;
}

export interface OrdenReciente {
  id: string;
  numero: string;
  total: number;
  mesonero: string | null;
  mesa: string | null;
  estado: string;
  estadoPago: string;
  cuando: string;
}

/**
 * La fila tal como vuelve de `.lean()`. `createdAt` lo pone
 * `@Schema({ timestamps: true })`, asi que no esta en la clase del schema y
 * hay que declararlo aqui — sin recurrir a `any`.
 */
interface FilaOrdenReciente {
  _id: string;
  orderNumber?: string;
  total?: number;
  waiterName?: string;
  tableId?: string;
  status?: string;
  paymentStatus?: string;
  createdAt?: Date;
}

interface ResumenAgrupado {
  _id: boolean;
  venta: number;
  ordenes: number;
  propinaTotal: number;
  cobradoBruto: number;
  propinaCobrada: number;
}

@Injectable()
export class PanelService {
  private readonly logger = new Logger(PanelService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    private readonly sociosExcluidos: SociosExcluidosService,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Que cuenta como venta. UNA sola definicion para todo el panel.
   *
   * El panel viejo tenia tres: la tarjeta grande contaba todo lo facturado, el
   * desglose de cobros solo miraba `status`, y los dos rankings exigian
   * `paymentStatus === 'paid'` — o sea que el Top Mesoneros ignoraba el credito
   * entero. Por eso la suma del ranking nunca daba la venta del dia.
   */
  private ventaContable(rango: RangoPanel): PipelineStage.Match['$match'] {
    return {
      isDeleted: { $ne: true },
      createdAt: { $gte: rango.start, $lt: rango.end },
      status: { $ne: 'CANCELLED' },
      paymentStatus: { $nin: ['CANCELLED', 'REFUNDED'] },
    };
  }

  private async idsDeSocios(): Promise<string[]> {
    const socios = await this.sociosExcluidos.resolver();
    return socios.habilitado ? socios.customerIds : [];
  }

  private periodo(rango: RangoPanel) {
    return {
      desde: rango.start.toISOString(),
      hasta: rango.end.toISOString(),
      etiqueta: rango.etiqueta,
    };
  }

  // ─── Tarjeta grande: cuanto vendimos ─────────────────────────────────

  async ventas(
    intervalo: IntervaloPanel,
    ahora: Date = new Date(),
  ): Promise<VentasDelPanel> {
    const op = await this.configs.obtener('operacion');
    const rango = rangoDe(intervalo, op, ahora);
    const socios = await this.idsDeSocios();

    const actual = await this.resumirVenta(rango, socios);

    let comparacion: VentasDelPanel['comparacion'] = null;
    if (rango.comparaCon && rango.etiquetaComparacion) {
      const rangoPrevio = rangoDe(rango.comparaCon, op, ahora);
      const previo = await this.resumirVenta(rangoPrevio, socios);
      comparacion = {
        etiqueta: rango.etiquetaComparacion,
        venta: previo.venta,
        variacionPct: variacion(previo.venta, actual.venta),
      };
    }

    return { periodo: this.periodo(rango), ...actual, comparacion };
  }

  /**
   * Venta, cobrado y propina de un rango, en UNA pasada por la base.
   *
   * Lo cobrado sale de los PAGOS, no del estado de la orden: antes una orden
   * mal cerrada aportaba su total entero al ingreso aunque el dinero no
   * existiera, y el panel nunca cuadraba contra el arqueo.
   */
  private async resumirVenta(
    rango: RangoPanel,
    socios: string[],
  ): Promise<Omit<VentasDelPanel, 'periodo' | 'comparacion'>> {
    const filas = await this.orderModel
      .aggregate<ResumenAgrupado>([
        { $match: this.ventaContable(rango) },
        {
          $project: {
            total: { $ifNull: ['$total', 0] },
            tipAmount: { $ifNull: ['$tipAmount', 0] },
            esSocio: { $in: [{ $ifNull: ['$customerId', ''] }, socios] },
          },
        },
        {
          $lookup: {
            from: 'payments',
            localField: '_id',
            foreignField: 'orderId',
            as: 'pagos',
            pipeline: [
              { $match: { method: { $ne: DESCUENTO_NOMINA } } },
              { $project: { amount: 1 } },
            ],
          },
        },
        {
          $addFields: {
            cobradoDeLaOrden: { $sum: '$pagos.amount' },
          },
        },
        {
          $addFields: {
            // La propina viaja DENTRO de los pagos. Se prorratea igual que en
            // la pantalla de cobro y nunca por encima de lo que entro: una
            // orden a credito arrastra su propina sin que nadie la haya pagado.
            propinaQueEntro: {
              $min: ['$tipAmount', '$cobradoDeLaOrden'],
            },
          },
        },
        {
          $group: {
            _id: '$esSocio',
            venta: { $sum: '$total' },
            ordenes: { $sum: 1 },
            propinaTotal: { $sum: '$tipAmount' },
            cobradoBruto: { $sum: '$cobradoDeLaOrden' },
            propinaCobrada: { $sum: '$propinaQueEntro' },
          },
        },
      ])
      .exec();

    const normal = filas.find((f) => f._id === false);
    const deSocios = filas.find((f) => f._id === true);

    // Se redondea UNA sola vez, al final. Restar dos numeros ya redondeados
    // inventa centavos: en la semana del 08/09 daba $472,83 de por cobrar
    // contra los $472,82 reales.
    const ventaCruda = normal?.venta ?? 0;
    const cobradoCrudo =
      (normal?.cobradoBruto ?? 0) - (normal?.propinaCobrada ?? 0);

    return {
      venta: redondear(ventaCruda),
      ordenes: normal?.ordenes ?? 0,
      cobrado: redondear(cobradoCrudo),
      propinaCobrada: redondear(normal?.propinaCobrada ?? 0),
      propinaTotal: redondear(normal?.propinaTotal ?? 0),
      porCobrar: redondear(ventaCruda - cobradoCrudo),
      socios: {
        monto: redondear(deSocios?.venta ?? 0),
        ordenes: deSocios?.ordenes ?? 0,
      },
    };
  }

  // ─── Por donde entro la plata ────────────────────────────────────────

  async metodosDePago(
    intervalo: IntervaloPanel,
    ahora: Date = new Date(),
  ): Promise<MetodosDePagoDelPanel> {
    const op = await this.configs.obtener('operacion');
    const rango = rangoDe(intervalo, op, ahora);
    const socios = await this.idsDeSocios();

    const [deVentas, credito, otros] = await Promise.all([
      this.cobrosPorMetodo(rango, socios),
      this.creditoDelPeriodo(rango, socios),
      this.cobrosDeOtrosPeriodos(rango),
    ]);

    // Lo que entro en el periodo, por el metodo en que entro, se haya vendido
    // cuando se haya vendido (dueño, 14/10/2026). Antes solo contaba lo vendido
    // en el periodo y tres cobros de cartera por punto ($169,55) no aparecian
    // en ningun lado: el punto no cuadraba contra el banco.
    const metodos = this.agruparMetodos([...deVentas.filas, ...otros.filas]);
    const deLoVendido = this.agruparMetodos(deVentas.filas);

    return {
      periodo: this.periodo(rango),
      metodos,
      totalEntro: redondear(metodos.reduce((a, m) => a + m.bruto, 0)),
      totalDeVentas: redondear(deLoVendido.reduce((a, m) => a + m.bruto, 0)),
      totalVenta: redondear(metodos.reduce((a, m) => a + m.venta, 0)),
      totalPropina: redondear(metodos.reduce((a, m) => a + m.propina, 0)),
      bolivaresNominal: redondear(
        deVentas.bolivaresNominal + otros.bolivaresNominal,
      ),
      credito: credito.normal,
      creditoSocios: credito.socios,
      otrosPeriodos: otros.entradas,
      descuentoNomina: otros.descuentoNomina,
    };
  }

  /**
   * Lo cobrado entre dos fechas cualquiera, por metodo.
   *
   * `metodosDePago` solo sabe de intervalos con nombre (hoy, esta semana...) y
   * su semana arranca LUNES. El informe de gastos usa la semana de los socios,
   * que arranca MARTES "porque el lunes no se factura". Para cruzar lo que
   * entro contra lo que se gasto hacen falta las MISMAS fechas de los dos
   * lados, asi que este recibe el rango explicito.
   */
  async cobrosEntre(
    desde: Date,
    hasta: Date,
    etiqueta = '',
  ): Promise<MetodoDePago[]> {
    const socios = await this.idsDeSocios();
    const rango: RangoPanel = {
      start: desde,
      end: hasta,
      etiqueta,
      comparaCon: null,
      etiquetaComparacion: null,
    };
    // Mismo criterio que la tarjeta "Entró en caja": tambien entra lo cobrado
    // en el rango de cuentas y ordenes de antes.
    const [deVentas, otros] = await Promise.all([
      this.cobrosPorMetodo(rango, socios),
      this.cobrosDeOtrosPeriodos(rango),
    ]);
    return this.agruparMetodos([...deVentas.filas, ...otros.filas]);
  }

  /**
   * Pagos de las ordenes del periodo, por metodo, con la propina prorrateada.
   *
   * La propina vive en la ORDEN y una orden puede tener varios pagos, asi que
   * se reparte proporcional al monto de cada uno. Si no, cuadrar el punto de
   * venta contra el banco es imposible: el banco ve el bruto.
   */
  private async cobrosPorMetodo(rango: RangoPanel, socios: string[]) {
    const filas = await this.orderModel
      .aggregate<{
        _id: string;
        bruto: number;
        propina: number;
        pagos: number;
        nominalBs: number;
      }>([
        { $match: this.ventaContable(rango) },
        {
          $match: {
            $expr: {
              $not: [{ $in: [{ $ifNull: ['$customerId', ''] }, socios] }],
            },
          },
        },
        {
          $project: { tipAmount: { $ifNull: ['$tipAmount', 0] } },
        },
        {
          $lookup: {
            from: 'payments',
            localField: '_id',
            foreignField: 'orderId',
            as: 'pagos',
            pipeline: [
              { $match: { method: { $ne: DESCUENTO_NOMINA } } },
              {
                $project: {
                  amount: 1,
                  method: 1,
                  bcvRate: 1,
                  expectedAmountBS: 1,
                },
              },
            ],
          },
        },
        { $match: { 'pagos.0': { $exists: true } } },
        {
          $addFields: {
            totalPagado: { $sum: '$pagos.amount' },
          },
        },
        { $unwind: '$pagos' },
        {
          $project: {
            method: '$pagos.method',
            monto: { $ifNull: ['$pagos.amount', 0] },
            nominalBs: nominalEnBs('$pagos.'),
            propina: {
              $cond: [
                { $gt: ['$totalPagado', 0] },
                {
                  $multiply: [
                    '$tipAmount',
                    {
                      $divide: [
                        { $ifNull: ['$pagos.amount', 0] },
                        '$totalPagado',
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $group: {
            _id: '$method',
            bruto: { $sum: '$monto' },
            propina: { $sum: '$propina' },
            pagos: { $sum: 1 },
            nominalBs: { $sum: '$nominalBs' },
          },
        },
      ])
      .exec();

    return {
      filas,
      bolivaresNominal: filas.reduce((a, f) => a + (f.nominalBs ?? 0), 0),
    };
  }

  private agruparMetodos(
    filas: {
      _id: string;
      bruto: number;
      propina: number;
      pagos: number;
      nominalBs?: number;
    }[],
  ): MetodoDePago[] {
    const de = (metodos: string[]) =>
      filas.filter((f) => metodos.includes(f._id));
    const sumar = (
      clave: string,
      etiqueta: string,
      metodos: string[],
      detalle?: DetalleDeMetodo[],
    ): MetodoDePago => {
      const suyas = de(metodos);
      const bruto = suyas.reduce((a, f) => a + f.bruto, 0);
      const propina = suyas.reduce((a, f) => a + f.propina, 0);
      return {
        clave,
        etiqueta,
        bruto: redondear(bruto),
        venta: redondear(bruto - propina),
        propina: redondear(propina),
        pagos: suyas.reduce((a, f) => a + f.pagos, 0),
        detalle,
      };
    };

    const enUsd = de([METODO_EFECTIVO_USD]).reduce((a, f) => a + f.bruto, 0);
    const enBs = de([METODO_EFECTIVO_BS]).reduce((a, f) => a + f.bruto, 0);
    const nominalBs = de([METODO_EFECTIVO_BS]).reduce(
      (a, f) => a + (f.nominalBs ?? 0),
      0,
    );

    // El efectivo se cuenta junto pero se arquea por separado: la divisa y los
    // bolivares van a cajones distintos.
    const detalleEfectivo: DetalleDeMetodo[] = [
      { etiqueta: 'Divisa', monto: redondear(enUsd) },
      {
        etiqueta: 'Bolívares',
        monto: redondear(enBs),
        nominal: { moneda: 'Bs', monto: redondear(nominalBs) },
      },
    ];

    return [
      sumar('pagoMovil', 'Pago Móvil', METODOS_PAGO_MOVIL),
      sumar('punto', 'Punto de Venta', [METODO_PUNTO]),
      sumar(
        'efectivo',
        'Efectivo',
        [METODO_EFECTIVO_USD, METODO_EFECTIVO_BS],
        detalleEfectivo,
      ),
      sumar('transferencia', 'Transferencia', ['TRANSFER']),
      // La transferencia casi nunca se usa: si no entro nada por ahi, no se
      // muestra una tarjeta en cero que solo ocupa espacio.
    ].filter((m) => m.clave !== 'transferencia' || m.bruto > 0);
  }

  /** Ordenes del periodo que quedaron a credito. */
  private async creditoDelPeriodo(rango: RangoPanel, socios: string[]) {
    const filas = await this.orderModel
      .aggregate<{ _id: boolean; monto: number; cuentas: number }>([
        {
          $match: {
            ...this.ventaContable(rango),
            status: 'CREDIT',
          },
        },
        {
          $group: {
            _id: { $in: [{ $ifNull: ['$customerId', ''] }, socios] },
            monto: { $sum: { $ifNull: ['$total', 0] } },
            cuentas: { $sum: 1 },
          },
        },
      ])
      .exec();

    const normal = filas.find((f) => f._id === false);
    const deSocios = filas.find((f) => f._id === true);
    return {
      normal: {
        monto: redondear(normal?.monto ?? 0),
        cuentas: normal?.cuentas ?? 0,
      },
      socios: {
        monto: redondear(deSocios?.monto ?? 0),
        cuentas: deSocios?.cuentas ?? 0,
      },
    };
  }

  /**
   * Plata que entro EN el periodo pero se vendio antes, por metodo.
   *
   * Tres origenes: ordenes de otros dias, cuentas por cobrar consolidadas (el
   * pago apunta a la cuenta, no a una orden) y pagos cuya orden ya no existe.
   * Las ordenes nacidas en el periodo las cuenta `cobrosPorMetodo`; aqui se
   * saltan para no contarlas dos veces.
   */
  private async cobrosDeOtrosPeriodos(rango: RangoPanel) {
    const filas = await this.paymentModel
      .aggregate<{
        _id: { clase: string; method: string };
        bruto: number;
        propina: number;
        pagos: number;
        nominalBs: number;
      }>([
        { $match: { createdAt: { $gte: rango.start, $lt: rango.end } } },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'orden',
            pipeline: [
              {
                $lookup: {
                  from: 'payments',
                  localField: '_id',
                  foreignField: 'orderId',
                  as: 'suyos',
                  pipeline: [
                    { $match: { method: { $ne: DESCUENTO_NOMINA } } },
                    { $project: { amount: 1 } },
                  ],
                },
              },
              {
                $project: {
                  createdAt: 1,
                  tipAmount: { $ifNull: ['$tipAmount', 0] },
                  totalPagado: { $sum: '$suyos.amount' },
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: 'accountReceivables',
            localField: 'orderId',
            foreignField: '_id',
            as: 'cuenta',
            pipeline: [{ $project: { _id: 1 } }],
          },
        },
        {
          $addFields: {
            orden: { $arrayElemAt: ['$orden', 0] },
          },
        },
        {
          $addFields: {
            clase: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$method', DESCUENTO_NOMINA] },
                    then: 'nomina',
                  },
                  {
                    // La orden existe y nacio DENTRO del periodo: ya la cuentan
                    // las tarjetas de metodo, no se repite aqui.
                    case: {
                      $and: [
                        { $ne: [{ $ifNull: ['$orden', null] }, null] },
                        { $gte: ['$orden.createdAt', rango.start] },
                        { $lt: ['$orden.createdAt', rango.end] },
                      ],
                    },
                    then: 'delPeriodo',
                  },
                  {
                    case: { $ne: [{ $ifNull: ['$orden', null] }, null] },
                    then: 'ordenAnterior',
                  },
                  {
                    case: { $gt: [{ $size: '$cuenta' }, 0] },
                    then: 'cartera',
                  },
                ],
                // Ni orden ni cuenta: la orden se borro, la plata entro igual.
                default: 'sinOrden',
              },
            },
          },
        },
        { $match: { clase: { $ne: 'delPeriodo' } } },
        {
          $project: {
            clase: 1,
            method: 1,
            monto: { $ifNull: ['$amount', 0] },
            nominalBs: nominalEnBs('$'),
            // La propina de una orden vieja se reparte igual que en
            // `cobrosPorMetodo`. Una cuenta consolidada no la separa: es venta.
            propina: {
              $cond: [
                { $gt: [{ $ifNull: ['$orden.totalPagado', 0] }, 0] },
                {
                  $multiply: [
                    '$orden.tipAmount',
                    {
                      $divide: [
                        { $ifNull: ['$amount', 0] },
                        '$orden.totalPagado',
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $group: {
            _id: { clase: '$clase', method: '$method' },
            bruto: { $sum: '$monto' },
            propina: { $sum: '$propina' },
            pagos: { $sum: 1 },
            nominalBs: { $sum: '$nominalBs' },
          },
        },
      ])
      .exec();

    const monto = (clase: string) =>
      redondear(
        filas
          .filter((f) => f._id.clase === clase)
          .reduce((a, f) => a + f.bruto, 0),
      );
    const entraron = filas.filter((f) => f._id.clase !== 'nomina');

    return {
      filas: entraron.map((f) => ({
        _id: f._id.method,
        bruto: f.bruto,
        propina: f.propina,
        pagos: f.pagos,
        nominalBs: f.nominalBs,
      })),
      bolivaresNominal: entraron.reduce((a, f) => a + (f.nominalBs ?? 0), 0),
      entradas: {
        deOrdenesAnteriores: monto('ordenAnterior'),
        deCartera: monto('cartera'),
        sinOrden: monto('sinOrden'),
        pagos: entraron.reduce((a, f) => a + f.pagos, 0),
      },
      descuentoNomina: monto('nomina'),
    };
  }

  // ─── Tendencia ───────────────────────────────────────────────────────

  /**
   * Venta por jornada dentro del periodo elegido.
   *
   * El grafico viejo dibujaba SIEMPRE la semana actual, eligieras lo que
   * eligieras en el selector: el titulo decia una cosa y las barras otra.
   */
  async ventaPorDia(
    intervalo: IntervaloPanel,
    ahora: Date = new Date(),
  ): Promise<{ periodo: VentasDelPanel['periodo']; dias: DiaDeVenta[] }> {
    const op = await this.configs.obtener('operacion');
    const rango = rangoDe(intervalo, op, ahora);
    const socios = await this.idsDeSocios();

    const filas = await this.orderModel
      .aggregate<{ _id: string; venta: number; ordenes: number }>([
        { $match: this.ventaContable(rango) },
        {
          $match: {
            $expr: {
              $not: [{ $in: [{ $ifNull: ['$customerId', ''] }, socios] }],
            },
          },
        },
        {
          $group: {
            // Se imputa a la JORNADA: lo vendido antes de la hora de arranque cuenta para el
            // dia anterior. Se resta esa hora y se recorta la fecha en la zona de la operacion.
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: {
                  $subtract: [
                    '$createdAt',
                    op.businessDayStartHour * 3_600_000,
                  ],
                },
                timezone: op.timezone,
              },
            },
            venta: { $sum: { $ifNull: ['$total', 0] } },
            ordenes: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();

    const porDia = new Map(filas.map((f) => [f._id, f]));
    const dias: DiaDeVenta[] = [];
    for (
      let cursor = rango.start;
      cursor < rango.end;
      cursor = sumarJornadas(cursor, 1)
    ) {
      const dia = etiquetaDeJornada(cursor, op);
      const fila = porDia.get(dia);
      dias.push({
        dia,
        etiqueta: etiquetaCorta(cursor, op),
        venta: redondear(fila?.venta ?? 0),
        ordenes: fila?.ordenes ?? 0,
      });
    }

    return { periodo: this.periodo(rango), dias };
  }

  // ─── Rankings ────────────────────────────────────────────────────────

  async topProductos(
    intervalo: IntervaloPanel,
    orden: 'desc' | 'asc' = 'desc',
    limite = 10,
    ahora: Date = new Date(),
  ): Promise<{
    periodo: VentasDelPanel['periodo'];
    productos: ProductoDelRanking[];
  }> {
    const op = await this.configs.obtener('operacion');
    const rango = rangoDe(intervalo, op, ahora);

    const productos = await this.orderModel
      .aggregate<ProductoDelRanking>([
        { $match: this.ventaContable(rango) },
        { $unwind: '$items' },
        // Las cortesias no son venta: regalar 20 postres no es rotacion.
        { $match: { 'items.noCharge': { $ne: true } } },
        {
          $group: {
            _id: { $ifNull: ['$items.productId', '$items.name'] },
            nombre: { $first: '$items.name' },
            cantidad: { $sum: { $ifNull: ['$items.quantity', 0] } },
            venta: { $sum: { $ifNull: ['$items.total', 0] } },
          },
        },
        { $sort: { cantidad: orden === 'desc' ? -1 : 1, venta: -1 } },
        { $limit: Math.min(Math.max(limite, 1), 50) },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            nombre: 1,
            cantidad: 1,
            venta: { $round: ['$venta', 2] },
          },
        },
      ])
      .exec();

    return { periodo: this.periodo(rango), productos };
  }

  async topMesoneros(
    intervalo: IntervaloPanel,
    ahora: Date = new Date(),
  ): Promise<{
    periodo: VentasDelPanel['periodo'];
    mesoneros: MesoneroDelRanking[];
  }> {
    const op = await this.configs.obtener('operacion');
    const rango = rangoDe(intervalo, op, ahora);

    const mesoneros = await this.orderModel
      .aggregate<MesoneroDelRanking>([
        {
          $match: {
            ...this.ventaContable(rango),
            waiterId: { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: '$waiterId',
            // El nombre mas reciente, no el primero: si el mesonero se
            // renombro, el ranking de hoy debe decir como se llama hoy.
            nombre: { $last: '$waiterName' },
            ordenes: { $sum: 1 },
            // Venta SIN servicio ni propina: es lo que el mesonero vendio.
            venta: { $sum: { $ifNull: ['$subtotal', 0] } },
          },
        },
        { $sort: { venta: -1 } },
        {
          $project: {
            _id: 0,
            waiterId: '$_id',
            nombre: { $ifNull: ['$nombre', 'Sin nombre'] },
            ordenes: 1,
            venta: { $round: ['$venta', 2] },
            ticketPromedio: {
              $round: [{ $divide: ['$venta', { $max: ['$ordenes', 1] }] }, 2],
            },
          },
        },
      ])
      .exec();

    return { periodo: this.periodo(rango), mesoneros };
  }

  // ─── Actividad ───────────────────────────────────────────────────────

  /**
   * Ultimas ordenes reales.
   *
   * Reemplaza a la "Actividad Reciente" vieja, que mezclaba ordenes con
   * "Producto actualizado: X" — y para poner esas dos lineas bajaba el catalogo
   * de productos (0,46 MB) y la lista completa de clientes (1,11 MB).
   */
  async actividad(limite = 8): Promise<OrdenReciente[]> {
    const filas = await this.orderModel
      .find({ isDeleted: { $ne: true } })
      .select({
        orderNumber: 1,
        total: 1,
        waiterName: 1,
        tableId: 1,
        status: 1,
        paymentStatus: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limite, 1), 25))
      .lean<FilaOrdenReciente[]>()
      .exec();

    // La orden guarda el ID de la mesa, no su nombre. Mostrarlo crudo pone
    // "mesa 0Uk2fz8oKOmv9NVFXfVg" en pantalla, que no le dice nada a nadie:
    // se resuelve a "Mesa 11" con una sola consulta para todas las filas.
    const nombresDeMesa = await this.nombresDeMesa(
      filas.map((o) => o.tableId).filter((id): id is string => !!id),
    );

    return filas.map((o) => ({
      id: String(o._id),
      numero: o.orderNumber ?? String(o._id).slice(-4).toUpperCase(),
      total: redondear(o.total ?? 0),
      mesonero: o.waiterName ?? null,
      mesa: o.tableId ? (nombresDeMesa.get(o.tableId) ?? null) : null,
      estado: o.status ?? '',
      estadoPago: o.paymentStatus ?? '',
      cuando: (o.createdAt ?? new Date()).toISOString(),
    }));
  }

  /** id de mesa -> nombre legible ("Mesa 11"). Una consulta, no una por fila. */
  private async nombresDeMesa(ids: string[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids)];
    if (!unicos.length) return new Map();

    const mesas = await this.orderModel.db
      .collection<{ _id: string; name?: string; number?: number }>('tables')
      .find({ _id: { $in: unicos } })
      .project<{ _id: string; name?: string; number?: number }>({
        name: 1,
        number: 1,
      })
      .toArray();

    return new Map(
      mesas.map((m) => [
        String(m._id),
        m.name ?? (m.number !== undefined ? `Mesa ${m.number}` : String(m._id)),
      ]),
    );
  }
}

/** Dinero con dos decimales: evita que el JSON arrastre 0.30000000000000004. */
const redondear = (n: number): number => Math.round((n || 0) * 100) / 100;

const variacion = (previo: number, actual: number): number | null => {
  if (previo === 0 && actual === 0) return 0;
  if (previo === 0) return null; // Sin base: un "+100%" ahi es mentira.
  return Math.round(((actual - previo) / previo) * 100);
};

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** "Vie 18" — etiqueta del eje del grafico, en la zona de la operacion. */
const etiquetaCorta = (inicioJornada: Date, op: OperacionConfig): string => {
  const { anio, mes, dia } = paredEnZona(inicioJornada, op.timezone);
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return `${DIAS[diaSemana]} ${dia}`;
};
