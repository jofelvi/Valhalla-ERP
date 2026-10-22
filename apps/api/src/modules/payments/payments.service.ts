import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentStatusEnum } from '@odin6/types';
import { CustomerNotifierService } from '../sms/customer-notifier.service';
import { buildPurchaseSms } from '../sms/sms-messages';
import { buildPurchaseEmail } from '../sms/email-templates';
import { nombreVisible } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { CustomerDebtService } from '../sms/customer-debt.service';
import { pareceOtraMoneda, resolveUsdAmount } from '../../common/money';
import {
  PagoMovil,
  PagoMovilDocument,
} from '../pago-movil/schemas/pago-movil.schema';

// ─── Interfaz mínima para el modelo Customer (solo lo que usa el aviso) ────
interface CustomerLean {
  _id: string;
  name?: string;
  phone?: string;
  // Respaldo cuando el cliente no tiene telefono: el aviso se manda por correo.
  email?: string;
}

/** Item de la orden, en lo minimo que necesita el aviso. */
/** Cuenta por cobrar, en lo minimo que necesita el calculo de la deuda. */
interface AccountReceivableLean {
  amount?: number;
  paidAmount?: number;
  status?: string;
  isMerged?: boolean;
}

interface OrderItemLean {
  quantity?: number;
  name?: string;
  productName?: string;
  total?: number;
}

// ─── Interfaz mínima para queries al modelo Order ─────────────────────────
interface OrderLean {
  _id: string;
  orderNumber?: string;
  tableName?: string;
  total: number;
  tipAmount?: number;
  serviceCharge?: number;
  paymentStatus?: string;
  createdAt: Date;
  waiterId: string;
  isDeleted?: boolean;
}

// ─── Interfaz de retorno para findByWaiter ─────────────────────────────────
// Representa una orden embebida en un pago del mesonero.
export interface OrderEmbedded {
  id: string;
  orderNumber?: string;
  tableName?: string;
  total: number;
  tipAmount?: number;
  serviceCharge?: number;
  paymentStatus?: string;
  createdAt: Date;
}

// Representa el pago con la orden embebida (normalizado: _id → id, sin __v).
export interface PaymentWithOrder {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  reference?: string;
  bcvRate?: number;
  expectedAmountBS?: number;
  notes?: string;
  userId: string;
  createdAt?: Date;
  order: OrderEmbedded;
}

// ─── Interfaz para conflicto de referencia ────────────────────────────────
interface ConflictEntry {
  part: string;
  source: 'payments' | 'pagoMoviles' | 'pagoMoviles_suffix' | 'pendingPayments';
  paymentId?: string;
  orderId: string;
  amount: number;
  method?: string;
  createdAt?: Date;
  reference?: string;
  note?: string;
}

// ─── Interfaz para Pago Movil desde lean() ────────────────────────────────
interface PagoMovilLean {
  _id: string;
  orderId: string;
  referenceNumber: string;
  expectedAmount?: number;
  expectedAmountUSD?: number;
  createdAt?: Date;
  status?: string;
  [key: string]: unknown;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel('Order') private orderModel: Model<OrderLean>,
    @InjectModel(PagoMovil.name)
    private pagoMovilModel: Model<PagoMovilDocument>,
    @InjectModel('Customer') private customerModel: Model<CustomerLean>,
    private readonly debtService: CustomerDebtService,
    private readonly notifier: CustomerNotifierService,
    private readonly configService: ConfigService,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Aviso por SMS de compra pagada. Se dispara cuando la orden queda saldada,
   * no en cada abono, para no mandar un SMS por cada metodo de un pago mixto.
   *
   * Fire-and-forget: el cobro ya esta hecho y no se puede deshacer por un SMS.
   */
  private async notifyPurchaseBySms(orderId: string): Promise<void> {
    try {
      const order = await this.orderModel
        .findOne({ _id: orderId })
        .select('customerId total items')
        .lean()
        .exec();
      const withCustomer = order as
        | (OrderLean & {
            customerId?: string;
            items?: OrderItemLean[];
          })
        | null;
      if (!withCustomer?.customerId) return;

      const customer = await this.customerModel
        .findOne({ _id: withCustomer.customerId })
        .select('phone name email')
        .lean()
        .exec();
      // Sin ningun contacto no hay a donde avisar.
      if (!customer?.phone && !customer?.email) return;

      // Lo consumido: es el corazon del aviso, va en SMS y en correo.
      const items = (withCustomer.items ?? []).map((it) => ({
        quantity: it.quantity ?? 1,
        name: it.name ?? it.productName ?? 'Producto',
        total: it.total,
      }));

      // Dominio público de la instalación: lo fija el despliegue (PUBLIC_APP_URL).
      // Sin él el aviso no tiene enlace válido, así que no se envía.
      const publicAppUrl =
        this.configService.get<string>('PUBLIC_APP_URL') ?? '';
      if (!publicAppUrl) {
        this.logger.warn(
          'PUBLIC_APP_URL no configurado: no se envia aviso de compra',
        );
        return;
      }

      // Lo que el cliente sigue debiendo aparte de esta compra ya pagada.
      const debt = await this.debtService.forCustomer(withCustomer.customerId);

      // Nombre que firma el aviso: el de la marca, o el nombre comercial (configs).
      const marca = nombreVisible(
        await this.configs.obtener('marca'),
        await this.configs.obtener('negocio'),
      );

      const body = buildPurchaseSms({
        customerName: customer.name,
        orderId,
        total: withCustomer.total,
        itemCount: items.length,
        items,
        outstandingTotal: debt.total,
        publicAppUrl,
        marca,
      });

      const mail = buildPurchaseEmail({
        customerName: customer.name,
        orderId,
        total: withCustomer.total,
        items,
        outstandingTotal: debt.total,
        publicAppUrl,
        marca,
      });

      const res = await this.notifier.notify({
        phone: customer.phone,
        email: customer.email,
        smsBody: body,
        emailSubject: mail.subject,
        emailHtml: mail.html,
        clientMessageId: `compra-${orderId}`,
        context: `orden ${orderId}`,
      });
      if (!res.sent) {
        this.logger.warn(
          `Aviso de compra no enviado (orden ${orderId}): ${res.reason}`,
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Aviso de compra por SMS fallo: ${msg}`);
    }
  }

  /** Ventana para considerar dos cobros identicos como el mismo doble submit. */
  private static readonly DUPLICATE_WINDOW_MS = 30_000;

  /**
   * Cobro repetido ya registrado, o null si el pago es nuevo.
   *
   * Blindaje SERVER-SIDE: el candado del boton vive en cada cliente y los
   * telefonos tardan semanas en actualizarse, asi que la ultima palabra la
   * tiene el servidor. Se comprobo en un entorno aislado que un doble clic
   * creaba dos cobros de $5.50 sobre una orden de $5.50.
   *
   * Dos reglas, ninguna bloquea un cobro legitimo:
   *
   *  a) Misma orden + misma referencia. Dos vouchers distintos SIEMPRE traen
   *     referencias distintas; repetir la misma referencia en la misma cuenta
   *     es siempre un error. (El chequeo de referencias duplicadas existente
   *     no ve este caso: pasa `excludeOrderId` con la propia orden.)
   *
   *  b) Misma orden + mismo metodo + mismo monto dentro de 30s, para los
   *     metodos sin referencia (efectivo). Nadie cobra dos veces lo mismo en
   *     medio minuto a proposito.
   */
  private async findDuplicate(
    orderId: string,
    method: string,
    amount: number,
    transactionId?: string,
  ): Promise<PaymentDocument | null> {
    if (transactionId) {
      const sameRef = await this.paymentModel
        .findOne({ orderId, transactionId })
        .exec();
      if (sameRef) return sameRef;
    }

    const since = new Date(Date.now() - PaymentsService.DUPLICATE_WINDOW_MS);
    return this.paymentModel
      .findOne({
        orderId,
        method,
        amount: { $gte: amount - 0.01, $lte: amount + 0.01 },
        createdAt: { $gte: since },
      })
      .exec();
  }

  /**
   * Tolerancia de cobro: absorbe el redondeo de la doble conversion Bs→USD→Bs
   * sin dejar pasar un cobro doble. Un duplicado siempre es del orden del
   * total; esto es del orden de los centavos.
   */
  private static tolerancia(techo: number): number {
    return Math.max(1, techo * 0.02);
  }

  /**
   * Reserva cupo en la orden para un cobro, de forma ATOMICA.
   *
   * Aca vive la garantia de que no haya cobros dobles. Mongo esta en
   * standalone (sin transacciones), asi que la unica proteccion real ante dos
   * cierres a la vez —la web y el APK cerrando la misma cuenta— es un
   * `findOneAndUpdate` condicional sobre UN documento: Mongo evalua la
   * condicion y aplica el $inc sin que nadie se meta en el medio.
   *
   * Devuelve null si el cobro no cabe. El llamador debe rechazarlo.
   */
  private async reservarCupo(
    orderId: string,
    amount: number,
  ): Promise<{
    ok: boolean;
    total: number;
    tip: number;
    cobrado: number;
  } | null> {
    const order = await this.orderModel
      .findOne({ _id: orderId })
      .select('total tipAmount paidAmount')
      .lean()
      .exec();
    if (!order) return null;

    const total = order.total ?? 0;
    const tip = (order as { tipAmount?: number }).tipAmount ?? 0;
    const cobrado = (order as { paidAmount?: number }).paidAmount ?? 0;
    // Sin total no hay techo posible (ordenes viejas o en construccion): se
    // deja pasar, que para eso esta `pareceOtraMoneda` como red aparte.
    if (total <= 0) return { ok: true, total, tip, cobrado };

    const techo = total + tip + PaymentsService.tolerancia(total + tip);

    const actualizada = await this.orderModel
      .findOneAndUpdate(
        {
          _id: orderId,
          $expr: {
            $lte: [{ $add: [{ $ifNull: ['$paidAmount', 0] }, amount] }, techo],
          },
        },
        { $inc: { paidAmount: amount } },
        { new: true },
      )
      .lean()
      .exec();

    if (!actualizada) return { ok: false, total, tip, cobrado };
    return { ok: true, total, tip, cobrado };
  }

  /** Devuelve el cupo si el cobro no llego a registrarse. */
  private async liberarCupo(orderId: string, amount: number): Promise<void> {
    await this.orderModel
      .updateOne({ _id: orderId }, { $inc: { paidAmount: -amount } })
      .exec();
  }

  /**
   * Estado de cobro AUTORITATIVO de una orden.
   *
   * La web y el APK deben consultarlo antes de cerrar una cuenta, en vez de
   * confiar en lo que tengan en pantalla: la pantalla puede estar vieja, y dos
   * dispositivos pueden estar mirando la misma orden.
   */
  async estadoDeCobro(orderId: string) {
    const order = await this.orderModel
      .findOne({ _id: orderId })
      .select('total tipAmount paidAmount paymentStatus')
      .lean()
      .exec();
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);

    const pagos = await this.paymentModel.find({ orderId }).lean().exec();
    const cobrado =
      Math.round(pagos.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100;
    const total = order.total ?? 0;
    const tip = (order as { tipAmount?: number }).tipAmount ?? 0;
    const totalACobrar = Math.round((total + tip) * 100) / 100;
    const falta = Math.round(Math.max(0, totalACobrar - cobrado) * 100) / 100;

    return {
      orderId,
      /** Consumo: lo que valen los productos, sin propina. */
      total,
      /** Propina, separada a proposito: no es venta del restaurante. */
      tipAmount: tip,
      /** Lo que hay que cobrarle al cliente: consumo + propina. */
      totalACobrar,
      cobrado,
      falta,
      paymentStatus:
        (order as { paymentStatus?: string }).paymentStatus ?? null,
      /** false = la cuenta ya esta saldada; cobrar de nuevo seria un doble. */
      puedeCobrar: falta > 0.01,
      pagos: pagos.map((p) => ({
        id: String(p._id),
        amount: p.amount,
        method: p.method,
        reference: p.transactionId ?? null,
        createdAt: p.createdAt,
      })),
    };
  }

  async create(createPaymentDto: CreatePaymentDto) {
    // ── Idempotencia por clientRequestId (outbox offline) ──
    // Si el cliente manda una llave y ya existe un pago con ella, es un
    // reintento de la misma operacion: se devuelve el pago ya creado en vez de
    // crear otro. Corre ANTES de todo lo demas para que un replay ni reserve
    // cupo ni toque nada. Hoy ningun cliente la manda (campo aditivo).
    if (createPaymentDto.clientRequestId) {
      const previo = await this.paymentModel
        .findOne({ clientRequestId: createPaymentDto.clientRequestId })
        .exec();
      if (previo) {
        this.logger.warn(
          `Pago idempotente: clientRequestId=${createPaymentDto.clientRequestId} ` +
            `ya existe como pago ${String(previo._id)} — se devuelve sin duplicar`,
        );
        const existing = previo.toObject();
        return { ...existing, id: String(existing._id), duplicate: true };
      }
    }

    // Merge paymentMethod (APK) → method (campo canonico).
    const method = createPaymentDto.method ?? createPaymentDto.paymentMethod;
    if (!method) {
      throw new BadRequestException('method o paymentMethod es requerido');
    }
    // reference (APK) → transactionId (canonico) si no viene transactionId
    const transactionId =
      createPaymentDto.transactionId ?? createPaymentDto.reference;

    // ── Monto canonico en USD (bug de unidades, 28/02–30/07/2026) ──
    // Si vienen bolivares y tasa, el USD se DERIVA; el que mando el cliente
    // se ignora. 603 pagos historicos quedaron guardados en Bs por confiar en
    // ese campo, y sumar la coleccion en crudo daba 128x el ingreso real.
    const amount = resolveUsdAmount({
      amountUsd: createPaymentDto.amount,
      amountBs: createPaymentDto.expectedAmountBS,
      bcvRate: createPaymentDto.bcvRate,
    });

    // Red de seguridad: un monto que supera 20x el total de su orden no es un
    // cobro, es otra moneda. Se rechaza en vez de guardarlo, porque un numero
    // asi envenena cierres y reportes y despues cuesta muchisimo desenredarlo.
    const orderForCheck = await this.orderModel
      .findOne({ _id: createPaymentDto.orderId })
      .select('total bcvRate')
      .lean()
      .exec();
    if (pareceOtraMoneda(amount, orderForCheck?.total)) {
      this.logger.error(
        `Cobro rechazado por monto imposible: orden ${createPaymentDto.orderId} ` +
          `total $${orderForCheck?.total} pero llego $${amount} ` +
          `(${method}, bcvRate=${createPaymentDto.bcvRate ?? '-'}). ` +
          `Parece un monto en bolivares en el campo de dolares.`,
      );
      throw new BadRequestException(
        `El monto ($${amount}) es desproporcionado frente al total de la orden ` +
          `($${orderForCheck?.total}). Verifique si esta enviando bolivares en vez de dolares.`,
      );
    }

    // ── Guardia antiduplicado (bug del doble clic, 12/08/2026) ──
    // Se devuelve el cobro YA registrado en vez de lanzar error: para el
    // cliente el cobro salio bien (que es la verdad, el dinero entro una vez)
    // y no se le muestra un fallo al cajero por algo que ya funciono.
    const duplicate = await this.findDuplicate(
      createPaymentDto.orderId,
      method,
      amount,
      transactionId,
    );
    if (duplicate) {
      this.logger.warn(
        `Cobro duplicado descartado: orden ${createPaymentDto.orderId}, ` +
          `${method} $${createPaymentDto.amount}` +
          `${transactionId ? `, ref ${transactionId}` : ''} — ` +
          `ya existia el pago ${String(duplicate._id)}`,
      );
      const existing = duplicate.toObject();
      return { ...existing, id: String(existing._id), duplicate: true };
    }

    // ── Tasa BCV siempre presente en los pagos en bolivares ──
    // El 74% de los Pago Movil y el 98% de los manuales se guardaron sin tasa:
    // sin ella no se puede auditar la conversion NI repararla, que es por lo
    // que el error de moneda vivio cinco meses sin que nadie lo viera.
    //
    // Se RELLENA, no se rechaza. Si el scraper del BCV falla —y falla— un
    // cobro rechazado dejaria al cajero sin poder cobrar en plena noche, que
    // es peor que el problema que arregla.
    const METODOS_EN_BS = ['CASH_BS', 'PAGO_MOVIL', 'PAGO_MOVIL_MANUAL'];
    let bcvRate = createPaymentDto.bcvRate;
    if (METODOS_EN_BS.includes(method) && !(bcvRate && bcvRate > 0)) {
      const orderRate = (orderForCheck as { bcvRate?: number } | null)?.bcvRate;
      if (orderRate && orderRate > 0) {
        bcvRate = orderRate;
      } else {
        const ultimo = await this.paymentModel
          .findOne({ bcvRate: { $gt: 0 } })
          .sort({ createdAt: -1 })
          .select('bcvRate')
          .lean()
          .exec();
        bcvRate = ultimo?.bcvRate;
      }
      if (bcvRate && bcvRate > 0) {
        this.logger.warn(
          `Pago sin tasa: orden ${createPaymentDto.orderId} (${method}). ` +
            `Se completa con ${bcvRate} para que quede auditable.`,
        );
      } else {
        this.logger.error(
          `Pago sin tasa y sin ninguna de respaldo: orden ${createPaymentDto.orderId} (${method}). ` +
            `Queda sin poder auditarse.`,
        );
      }
    }

    // ── Cupo en la orden: el candado contra el cobro doble ──
    // Se reserva ANTES de insertar. Si dos dispositivos cierran la misma
    // cuenta a la vez, Mongo deja pasar uno solo.
    const cupo = await this.reservarCupo(createPaymentDto.orderId, amount);
    if (cupo && !cupo.ok) {
      const faltaba = Math.max(0, cupo.total + cupo.tip - cupo.cobrado);
      this.logger.error(
        `Cobro rechazado por exceder la cuenta: orden ${createPaymentDto.orderId} ` +
          `(consumo $${cupo.total} + propina $${cupo.tip}), ya cobrado $${cupo.cobrado}, ` +
          `intentaron $${amount}.`,
      );
      throw new BadRequestException(
        `Esta cuenta ya tiene $${cupo.cobrado.toFixed(2)} cobrados de ` +
          `$${(cupo.total + cupo.tip).toFixed(2)}. ` +
          (faltaba > 0.01
            ? `Solo faltan $${faltaba.toFixed(2)}.`
            : 'La cuenta ya esta saldada: cobrar de nuevo seria un cobro doble.'),
      );
    }

    let payment: PaymentDocument;
    try {
      payment = await this.paymentModel.create({
        ...createPaymentDto,
        method,
        transactionId,
        // Despues del spread a proposito: pisan lo que mando el cliente con
        // el monto derivado y la tasa resuelta.
        amount,
        ...(bcvRate && bcvRate > 0 ? { bcvRate } : {}),
        createdAt: new Date(),
      });
    } catch (error) {
      // E11000: el indice unico (orderId, transactionId) freno un cobro
      // simultaneo. Es la unica defensa que aguanta dos peticiones a la vez,
      // porque `findDuplicate` corre antes de que la otra haya insertado.
      const code = (error as { code?: number }).code;
      // El cobro no entro: se devuelve el cupo para no dejar la orden con un
      // paidAmount que no corresponde a ningun pago.
      await this.liberarCupo(createPaymentDto.orderId, amount);
      if (code !== 11000) throw error;
      // Dos indices unicos pueden frenar un simultaneo: (orderId, transactionId)
      // y clientRequestId. Se busca el pago ya insertado por el que aplique.
      let existing = await this.paymentModel
        .findOne({ orderId: createPaymentDto.orderId, transactionId })
        .lean()
        .exec();
      if (!existing && createPaymentDto.clientRequestId) {
        existing = await this.paymentModel
          .findOne({ clientRequestId: createPaymentDto.clientRequestId })
          .lean()
          .exec();
      }
      this.logger.warn(
        `Cobro simultaneo frenado por el indice unico: orden ` +
          `${createPaymentDto.orderId}, ref ${transactionId}` +
          `${createPaymentDto.clientRequestId ? `, key ${createPaymentDto.clientRequestId}` : ''}`,
      );
      if (existing) {
        return { ...existing, id: String(existing._id), duplicate: true };
      }
      throw error;
    }

    // Update order's paymentStatus
    const order = await this.orderModel.findOne({
      _id: createPaymentDto.orderId,
    });
    if (order) {
      const allPayments = await this.paymentModel.find({
        orderId: createPaymentDto.orderId,
      });
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

      if (totalPaid >= order.total) {
        await this.orderModel.updateOne(
          { _id: createPaymentDto.orderId },
          { paymentStatus: PaymentStatusEnum.PAID },
        );
        // Solo al quedar saldada: en un pago mixto esto corre una vez, con el
        // ultimo abono, en vez de un SMS por cada metodo.
        if (order.paymentStatus !== PaymentStatusEnum.PAID) {
          void this.notifyPurchaseBySms(createPaymentDto.orderId);
        }
      } else if (totalPaid > 0) {
        await this.orderModel.updateOne(
          { _id: createPaymentDto.orderId },
          { paymentStatus: PaymentStatusEnum.PARTIAL },
        );
      }
    }

    const obj = payment.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll(filters?: { orderId?: string }) {
    const query: Record<string, string> = {};

    if (filters?.orderId) {
      query.orderId = filters.orderId;
    }

    const payments = await this.paymentModel
      .find(query)
      .lean()
      .sort({ createdAt: -1 })
      .exec();
    return payments.map((payment) => ({ ...payment, id: payment._id }));
  }

  async findByOrderId(orderId: string) {
    const payments = await this.paymentModel
      .find({ orderId })
      .lean()
      .sort({ createdAt: -1 })
      .exec();
    return payments.map((payment) => ({ ...payment, id: payment._id }));
  }

  async checkReference(reference: string) {
    const payment = await this.paymentModel.findOne({
      transactionId: reference,
    });
    return { exists: !!payment };
  }

  /**
   * Parsea una referencia que puede venir concatenada por el mesonero
   * (ej: "5987/5986/4492" cuando paga con 3 vouchers en una sola entrada).
   * Devuelve cada parte individual >= 4 chars, sin duplicados.
   */
  private splitReferences(reference: string): string[] {
    if (!reference) return [];
    // Separadores aceptados: / , ; | + - espacios y saltos de linea.
    // Cualquier ruido no-numerico se descarta. Luego nos quedamos con
    // tokens de 4+ digitos (referencias bancarias estandar).
    const parts = reference
      .split(/[\/,;|+\-\s\n\r]+/)
      .map((s) => s.replace(/[^0-9]/g, '').trim())
      .filter((s) => s.length >= 4);
    return Array.from(new Set(parts));
  }

  /**
   * Check si una referencia (o cada una de sus partes si viene concatenada)
   * ya esta usada. Busca en 3 fuentes:
   *   1) payments.transactionId / reference
   *   2) pagoMoviles.referenceNumber
   *   3) orders.pendingPayments[].reference (cobros pendientes verificacion)
   *
   * Devuelve { conflicts: [...] } con TODOS los conflictos encontrados, o
   * { conflicts: [] } si esta limpia. El frontend itera y muestra cada uno.
   *
   * Mantiene compat con consumidores existentes que esperan el primer
   * conflicto: si llaman como `if (await checkReferenceUsed(...))` el
   * objeto siempre es truthy, asi que se chequea `.conflicts.length > 0`
   * o se accede al primer elemento via `.conflicts[0]`.
   */
  async checkReferenceUsed(
    reference: string,
    excludeOrderId?: string,
    method?: string,
  ) {
    const conflicts: ConflictEntry[] = [];
    const parts = this.splitReferences(reference);
    if (parts.length === 0) return null;

    // PAGO_MOVIL usa un sistema de numeracion independiente al de tarjetas/transferencias.
    // Si se indica el metodo, solo comparamos contra registros del mismo metodo para
    // evitar falsos positivos (ej: ref "0087" de Pago Movil no bloquea ref "0087" de tarjeta).
    const isPagoMovil = method === 'PAGO_MOVIL';
    const skipPagoMovil = !!method && !isPagoMovil;
    const skipCards = !!method && isPagoMovil;

    for (const part of parts) {
      // 1. payments por transactionId O reference
      if (!skipCards) {
        const methodFilter = method ? { method } : {};
        const payments = (await this.paymentModel
          .find({
            ...methodFilter,
            $or: [
              { transactionId: part },
              { reference: part },
              {
                transactionId: {
                  $regex: `(^|[\\/,;\\s])${part}($|[\\/,;\\s])`,
                },
              },
              { reference: { $regex: `(^|[\\/,;\\s])${part}($|[\\/,;\\s])` } },
            ],
          })
          .lean()
          .exec()) as unknown as PaymentDocument[];
        for (const p of payments) {
          if (excludeOrderId && p.orderId === excludeOrderId) continue;
          conflicts.push({
            part,
            source: 'payments',
            paymentId: p._id,
            orderId: p.orderId,
            amount: p.amount,
            method: p.method,
            createdAt: p.createdAt,
          });
        }
      }

      // 2. pagoMoviles — solo si el metodo es PAGO_MOVIL o no se especifica metodo
      if (!skipPagoMovil) {
        const pagoMoviles = (await this.pagoMovilModel
          .find({ referenceNumber: part })
          .lean()
          .exec()) as unknown as PagoMovilLean[];
        for (const pm of pagoMoviles) {
          if (excludeOrderId && pm.orderId === excludeOrderId) continue;
          conflicts.push({
            part,
            source: 'pagoMoviles',
            paymentId: pm._id,
            orderId: pm.orderId,
            amount: pm.expectedAmount ?? pm.expectedAmountUSD ?? 0,
            method: 'PAGO_MOVIL',
            createdAt: pm.createdAt,
          });
        }
      }

      // 2b. Sufijo anti-fraude: detecta refs parciales que terminen igual.
      // Ej: "233341" (6 digitos) bloquea si ya existe "0050995233341" para otra orden.
      if (!skipPagoMovil) {
        const last6 = part.length >= 6 ? part.slice(-6) : part;
        if (last6.length >= 4) {
          const suffixMatches = (await this.pagoMovilModel
            .find({
              referenceNumber: { $regex: `${last6}$` },
              status: { $in: ['pending', 'verified'] },
            })
            .lean()
            .exec()) as unknown as PagoMovilLean[];
          for (const pm of suffixMatches) {
            if (excludeOrderId && pm.orderId === excludeOrderId) continue;
            if (pm.referenceNumber === part) continue; // ya capturado en match exacto
            conflicts.push({
              part,
              source: 'pagoMoviles_suffix',
              paymentId: pm._id,
              orderId: pm.orderId,
              amount: pm.expectedAmount ?? pm.expectedAmountUSD ?? 0,
              method: 'PAGO_MOVIL',
              createdAt: pm.createdAt,
              note: `Posible duplicado: la referencia existente "${pm.referenceNumber}" termina en "${last6}"`,
            });
          }
        }
      }

      // 3. orders.pendingPayments[].reference (cobros pendientes de verificacion)
      interface PendingQueryType {
        'pendingPayments.reference': { $regex: string };
        'pendingPayments.method'?: string;
      }
      const pendingQuery: PendingQueryType = {
        'pendingPayments.reference': {
          $regex: `(^|[\\/,;\\s])${part}($|[\\/,;\\s])`,
        },
      };
      // Si se especifica metodo, filtrar tambien por metodo en el array
      if (method) {
        pendingQuery['pendingPayments.method'] = method;
      }
      const ordersPend: OrderLean[] = await this.orderModel
        .find(pendingQuery)
        .lean()
        .exec();
      interface OrderPending extends OrderLean {
        pendingPayments?: Array<{
          reference?: string;
          method?: string;
          amount?: number;
        }>;
      }
      for (const o of ordersPend as OrderPending[]) {
        if (excludeOrderId && o._id === excludeOrderId) continue;
        const matchPp = (o.pendingPayments || []).find(
          (pp: { reference?: string; method?: string; amount?: number }) => {
            const refMatch = (pp.reference || '').includes(part);
            const methodMatch = !method || pp.method === method;
            return refMatch && methodMatch;
          },
        );
        if (!matchPp) continue;
        conflicts.push({
          part,
          source: 'pendingPayments',
          orderId: o._id,
          amount: matchPp?.amount ?? o.total,
          method: matchPp?.method,
          reference: matchPp?.reference,
          createdAt: o.createdAt,
        });
      }
    }

    if (conflicts.length === 0) return null;

    // Las refs cortas (4-7 digitos) son numeraciones de lote/aprobacion que
    // los puntos de venta reciclan cada pocos dias — compararlas contra TODO
    // el historial genera falsos positivos (ej: voucher "0182" de hoy choca
    // con un pago de hace 3 meses y bloquea el cobro del mesonero). Solo se
    // consideran conflicto si el uso previo es reciente. Las refs largas
    // (8+ digitos) si se validan contra todo el historial.
    const SHORT_REF_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - SHORT_REF_WINDOW_MS;
    const relevant = conflicts.filter((c) => {
      if (String(c.part).length >= 8) return true;
      const ts = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      return ts >= cutoff;
    });

    if (relevant.length === 0) return null;
    return { ...relevant[0], conflicts: relevant };
  }

  async findById(id: string) {
    const payment = await this.paymentModel.findOne({ _id: id }).lean().exec();
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return { ...payment, id: payment._id };
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    const payment = await this.paymentModel
      .findOneAndUpdate(
        { _id: id },
        { ...updatePaymentDto, updatedAt: new Date() },
        { new: true },
      )
      .lean()
      .exec();
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return { ...payment, id: payment._id };
  }

  async remove(id: string) {
    const payment = await this.paymentModel.findOne({ _id: id }).exec();
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    await this.paymentModel.deleteOne({ _id: id });
    // El contador de la orden es espejo de sus pagos: si se borra uno, baja.
    await this.liberarCupo(String(payment.orderId), payment.amount ?? 0);
    return { message: 'Payment deleted successfully' };
  }

  /**
   * Busca pagos confirmados de un mesonero en un rango de fechas opcional.
   * Retorna pagos embebidos con los datos de su orden correspondiente.
   *
   * @param waiterId ID del mesonero (obligatorio)
   * @param from Fecha inicial ISO (opcional) — filtra createdAt de órdenes
   * @param to Fecha final ISO (opcional) — filtra createdAt de órdenes
   * @returns Array de pagos con orden embebida, ordenados por createdAt DESC
   * @throws BadRequestException si waiterId no se proporciona
   */
  async findByWaiter(
    waiterId: string,
    from?: string,
    to?: string,
  ): Promise<PaymentWithOrder[]> {
    if (!waiterId) {
      throw new BadRequestException('waiterId es requerido');
    }

    // Órdenes del mesonero SIN filtro de fecha: el rango aplica a la fecha
    // del PAGO, no de la orden (una orden de ayer puede cobrarse hoy)
    const orderFilter: Record<string, unknown> = {
      waiterId,
      isDeleted: { $ne: true },
    };

    // Buscar órdenes del mesonero
    const orders = await this.orderModel
      .find(orderFilter)
      .select(
        '_id orderNumber tableName total tipAmount serviceCharge paymentStatus createdAt',
      )
      .lean()
      .exec();

    // Crear mapa orderId → orden normalizada (sin _id ni __v)
    const orderMap = new Map<string, OrderEmbedded>();
    for (const order of orders) {
      orderMap.set(String(order._id), {
        id: String(order._id),
        orderNumber: order.orderNumber,
        tableName: order.tableName,
        total: order.total,
        tipAmount: order.tipAmount,
        serviceCharge: order.serviceCharge,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      });
    }

    // Buscar pagos de esas órdenes (rango sobre la fecha del pago), DESC
    const orderIds = Array.from(orderMap.keys());
    const paymentFilter: Record<string, unknown> = {
      orderId: { $in: orderIds },
    };
    if (from || to) {
      const dateRange: Record<string, Date> = {};
      if (from) {
        dateRange.$gte = new Date(from);
      }
      if (to) {
        dateRange.$lte = new Date(to);
      }
      paymentFilter.createdAt = dateRange;
    }
    const payments = await this.paymentModel
      .find(paymentFilter)
      .lean()
      .sort({ createdAt: -1 })
      .exec();

    // Ensamblar pagos con orden embebida; excluir pagos huérfanos
    const result: PaymentWithOrder[] = [];
    for (const payment of payments) {
      const order = orderMap.get(String(payment.orderId));
      if (!order) {
        // Pago cuya orden no está en el set (filtrado por waiterId/fechas) → excluir
        continue;
      }

      result.push({
        id: String(payment._id),
        orderId: String(payment.orderId),
        amount: payment.amount,
        method: payment.method,
        reference: payment.transactionId,
        bcvRate: payment.bcvRate,
        expectedAmountBS: payment.expectedAmountBS,
        notes: payment.notes,
        userId: String(payment.userId),
        createdAt: payment.createdAt,
        order,
      });
    }

    return result;
  }
}
