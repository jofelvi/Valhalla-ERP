import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PagoMovil, PagoMovilDocument } from './schemas/pago-movil.schema';
import { resolveUsdAmount } from '../../common/money';
import { createInvoiceOnce, facturaDeLaOrden } from '../../common/invoice-once';
import { CreatePagoMovilDto } from './dto/create-pago-movil.dto';
import {
  UpdatePagoMovilDto,
  VerifyPagoMovilDto,
} from './dto/update-pago-movil.dto';
import { BankVerifyDto } from './dto/bank-verify.dto';
import {
  BanvenesScrapeService,
  BankVerificationResult,
} from './banvenes-scraper.service';
import { PosGateway } from '../websockets/gateways/pos.gateway';
import { TableStatusEnum } from '@odin6/types';
import { Table, TableDocument } from '../tables/schemas/table.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { ConfigsService } from '../configs/configs.service';
import { moduloActivo } from '../../common/modulos/modulo-activo';

// El `order` que recibe PagoMovil llega tanto hidratado (Document) como en
// `lean()` (el llamador en orders.service usa lean); aquí solo se LEEN campos,
// nunca se invocan métodos de Document. Por eso el tipo es la forma plana con
// `_id`, no `OrderDocument` (tiparlo estricto rompía al llamador lean).
type OrderParaPagoMovil = Order & { _id: unknown };

interface QueueEntry {
  orderId: string;
  orderSnapshot: OrderParaPagoMovil;
  pmDoc: PagoMovilDocument;
}

interface PendingPayment {
  method?: string;
  reference?: string;
  pagoMovilPhone?: string;
  pagoMovilCedula?: string;
  pagoMovilBanco?: string;
  amountBs?: number;
  amount?: number;
  bcvRate?: number;
}

interface VerificationEntry {
  pmDoc: PagoMovilDocument;
  bankResult: BankVerificationResult;
}

@Injectable()
export class PagoMovilService implements OnModuleDestroy {
  // ── Cola global de verificaciones pendientes ──────────────────────────────
  // Keyed por referenceNumber para deduplicar. Todos los pagos acumulados
  // se procesan en UNA sola sesión del browser (un único login a Banvenes).
  private readonly queue = new Map<string, QueueEntry>();
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private firstEnqueuedAt: number | null = null;
  // 30s debounce: espera tras el último enqueue para que el mesonero agregue
  // todos sus Pago Móvil antes de abrir la sesión bancaria.
  private readonly DEBOUNCE_MS = 30_000;
  // 5min límite absoluto: si el flujo de pagos es continuo, no esperar indefinidamente.
  private readonly MAX_WAIT_MS = 300_000;

  constructor(
    @InjectModel(PagoMovil.name)
    private pagoMovilModel: Model<PagoMovilDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Table.name) private tableModel: Model<TableDocument>,
    private readonly scraperService: BanvenesScrapeService,
    private readonly posGateway: PosGateway,
    private readonly configService: ConfigService,
    private readonly configs: ConfigsService,
  ) {}

  // Interruptor de confianza: mientras sea false, el bot verifica contra el
  // banco y deja el flag (status: verified) pero NO cierra la orden — el
  // cajero aprueba a mano viendo la verificación. Activar con
  // PAGO_MOVIL_AUTO_COMPLETE=true en el .env cuando el dueño valide el flujo.
  private get autoCompleteEnabled(): boolean {
    return (
      (
        this.configService.get<string>('PAGO_MOVIL_AUTO_COMPLETE') ?? 'false'
      ).toLowerCase() === 'true'
    );
  }

  onModuleDestroy(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD básico
  // ─────────────────────────────────────────────────────────────────────────

  async create(createPagoMovilDto: CreatePagoMovilDto) {
    // El USD se DERIVA de los bolivares, nunca se toma del cliente (ver
    // common/money.ts). El saneo anterior comparaba si USD == Bs para
    // detectar el error; no alcanzaba, porque un Bs mal convertido pasaba
    // el filtro. Derivar siempre no deja rendija.
    const data = { ...createPagoMovilDto } as Record<string, unknown>;
    const { expectedAmountUSD, expectedAmountBS, bcvRate } = data as {
      expectedAmountUSD?: number;
      expectedAmountBS?: number;
      bcvRate?: number;
    };
    data.expectedAmountUSD = resolveUsdAmount({
      amountUsd: expectedAmountUSD,
      amountBs: expectedAmountBS,
      bcvRate,
    });
    const pagoMovil = await this.pagoMovilModel.create({
      ...data,
      createdAt: new Date(),
    });
    const obj = pagoMovil.toObject();
    return { ...obj, id: String(obj._id) };
  }

  async findAll(filters?: { orderId?: string; status?: string }) {
    const query: Record<string, string> = {};
    if (filters?.orderId) query.orderId = filters.orderId;
    if (filters?.status) query.status = filters.status;
    const pagoMoviles = await this.pagoMovilModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return pagoMoviles.map((pm) => ({ ...pm, id: pm._id }));
  }

  async findByReference(ref: string) {
    const pagoMovil = await this.pagoMovilModel
      .findOne({ referenceNumber: ref })
      .lean()
      .exec();
    if (!pagoMovil) return null;
    return { ...pagoMovil, id: pagoMovil._id };
  }

  async isVerified(ref: string) {
    const pagoMovil = await this.pagoMovilModel
      .findOne({ referenceNumber: ref, status: 'verified' })
      .lean()
      .exec();
    if (!pagoMovil) return { isVerified: false, existingPayment: null };
    return {
      isVerified: true,
      existingPayment: { ...pagoMovil, id: pagoMovil._id },
    };
  }

  async verify(verifyDto: VerifyPagoMovilDto) {
    const pagoMovil = await this.pagoMovilModel
      .findOne({ referenceNumber: verifyDto.referenceNumber })
      .lean()
      .exec();
    if (!pagoMovil) {
      throw new NotFoundException(
        `PagoMovil with reference ${verifyDto.referenceNumber} not found`,
      );
    }
    const updated = await this.pagoMovilModel
      .findOneAndUpdate(
        { _id: pagoMovil._id },
        { ...verifyDto, verificationDate: new Date(), updatedAt: new Date() },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException(
        `Failed to update PagoMovil with ID ${pagoMovil._id}`,
      );
    }
    return { ...updated, id: updated._id };
  }

  async findById(id: string) {
    const pagoMovil = await this.pagoMovilModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!pagoMovil)
      throw new NotFoundException(`PagoMovil with ID ${id} not found`);
    return { ...pagoMovil, id: pagoMovil._id };
  }

  async update(id: string, updatePagoMovilDto: UpdatePagoMovilDto) {
    const pagoMovil = await this.pagoMovilModel
      .findOneAndUpdate(
        { _id: id },
        { ...updatePagoMovilDto, updatedAt: new Date() },
        { new: true },
      )
      .lean()
      .exec();
    if (!pagoMovil)
      throw new NotFoundException(`PagoMovil with ID ${id} not found`);
    return { ...pagoMovil, id: pagoMovil._id };
  }

  async remove(id: string) {
    const pagoMovil = await this.pagoMovilModel
      .findOne({ _id: id })
      .lean()
      .exec();
    if (!pagoMovil)
      throw new NotFoundException(`PagoMovil with ID ${id} not found`);
    await this.pagoMovilModel.deleteOne({ _id: id });
    return { message: 'PagoMovil record deleted successfully' };
  }

  async bankVerify(
    dto: BankVerifyDto,
  ): Promise<BankVerificationResult & { pagoMovil?: Record<string, unknown> }> {
    const bankResult = await this.scraperService.verifyTransaction(
      dto.referenceNumber,
      dto.expectedAmountBS,
    );

    if (!dto.pagoMovilId) return bankResult;

    const newStatus = bankResult.found
      ? bankResult.amountMatches
        ? 'verified'
        : 'amount_mismatch'
      : 'not_found';

    const updated = await this.pagoMovilModel
      .findOneAndUpdate(
        { _id: dto.pagoMovilId },
        {
          status: newStatus,
          verificationDate: new Date(),
          errorMessage:
            bankResult.errorMessage ??
            (!bankResult.amountMatches && bankResult.found
              ? `Monto en banco: ${bankResult.amountBS}`
              : undefined),
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException(
        `PagoMovil con ID ${dto.pagoMovilId} no encontrado`,
      );
    }
    return { ...bankResult, pagoMovil: { ...updated, id: updated._id } };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cola de verificación automática
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Llamado desde OrdersService (fire-and-forget) cuando llegan pendingPayments
   * con method='PAGO_MOVIL'. Reserva cada referencia atómicamente y la encola.
   * La verificación bancaria ocurre en batch cuando el debounce se cumple,
   * abriendo UNA sola sesión del browser para todas las refs acumuladas.
   */
  async reserveAndAutoVerify(order: OrderParaPagoMovil): Promise<void> {
    const orderId = String(order._id);
    const pendingPMs = (
      (order.pendingPayments as PendingPayment[]) || []
    ).filter(
      (pp: PendingPayment) => pp.method === 'PAGO_MOVIL' && pp.reference,
    );
    if (!pendingPMs.length) return;

    // La reserva de la referencia es núcleo (evita cobrar dos veces la misma). La verificación
    // automática contra el banco es opcional: con `bankReconciliation` apagado no se encola nada.
    const verificaBanco = await moduloActivo(
      this.configs,
      'bankReconciliation',
    );

    for (const pp of pendingPMs) {
      const ref = String(pp.reference).trim();
      try {
        const pmDoc = await this.reserveOrFind(orderId, ref, pp, order.bcvRate);
        if (String(pmDoc.orderId) !== orderId) {
          console.warn(
            `[PagoMovil] ref ${ref} ya reservada para orden ${pmDoc.orderId}, ignorando para ${orderId}`,
          );
          continue;
        }
        // Solo encolar si no está ya en la cola (puede repetirse si el mesonero re-envía)
        if (verificaBanco && !this.queue.has(ref)) {
          this.queue.set(ref, { orderId, orderSnapshot: order, pmDoc });
          if (!this.firstEnqueuedAt) this.firstEnqueuedAt = Date.now();
        }
      } catch (err) {
        console.error(
          `[PagoMovil] No se pudo reservar ref ${ref}:`,
          (err as Error)?.message,
        );
      }
    }

    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.isProcessing || this.queue.size === 0) return;

    // Si ya lleva 5 min esperando, ejecutar inmediatamente sin más debounce
    if (
      this.firstEnqueuedAt &&
      Date.now() - this.firstEnqueuedAt >= this.MAX_WAIT_MS
    ) {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
      this.executeFlush();
      return;
    }

    // Debounce: reiniciar el timer cada vez que llega un nuevo pago
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.executeFlush(), this.DEBOUNCE_MS);
  }

  private executeFlush(): void {
    this.flushTimer = null;
    this.flushQueue().catch((err) =>
      console.error('[PagoMovil] flushQueue error:', (err as Error)?.message),
    );
  }

  private async flushQueue(): Promise<void> {
    if (this.isProcessing || this.queue.size === 0) return;
    if (!(await moduloActivo(this.configs, 'bankReconciliation'))) {
      // Módulo apagado después de encolar: no se abre ninguna sesión bancaria.
      this.queue.clear();
      this.firstEnqueuedAt = null;
      return;
    }
    this.isProcessing = true;
    this.firstEnqueuedAt = null;

    // Snapshot y limpiar la cola antes de cualquier await para no perder
    // las refs que lleguen durante el procesamiento.
    const batch = [...this.queue.entries()];
    this.queue.clear();

    console.log(
      `[PagoMovil] flushQueue: ${batch.length} ref(s) en una sola sesión bancaria`,
    );

    try {
      // Refs que necesitan scraping (las ya verificadas se saltan)
      const toScrape = batch
        .filter(([, e]) => e.pmDoc.status !== 'verified')
        .map(([ref, e]) => ({
          referenceNumber: ref,
          expectedAmountBS: e.pmDoc.expectedAmountBS ?? 0,
        }));

      const bankResults = new Map<string, BankVerificationResult>();

      // Pre-verificadas: resultado directo sin tocar el banco
      for (const [ref, entry] of batch) {
        if (entry.pmDoc.status === 'verified') {
          bankResults.set(ref, {
            found: true,
            amountMatches: true,
          } as BankVerificationResult);
        }
      }

      // Una sola sesión de browser para todas las refs pendientes
      if (toScrape.length > 0) {
        const scraperResults = await this.scraperService.verifyBatch(toScrape);
        for (const [ref, result] of scraperResults) {
          bankResults.set(ref, result);
        }
      }

      // Persistir estado de cada pagoMovil en DB
      for (const [ref, entry] of batch) {
        if (entry.pmDoc.status === 'verified') continue;
        const bankResult = bankResults.get(ref);
        if (!bankResult) continue;

        const newStatus = bankResult.found
          ? bankResult.amountMatches
            ? 'verified'
            : 'amount_mismatch'
          : 'not_found';

        await this.pagoMovilModel.findOneAndUpdate(
          { _id: entry.pmDoc._id },
          {
            status: newStatus,
            verificationDate: new Date(),
            ...(newStatus !== 'verified'
              ? {
                  errorMessage:
                    bankResult.errorMessage ??
                    `Banco: ${bankResult.amountBS ?? 'no encontrado'}`,
                }
              : {}),
          },
        );
      }

      // Agrupar por orderId y decidir si marcar como PAID
      interface VerificationEntry {
        pmDoc: PagoMovilDocument;
        bankResult: BankVerificationResult;
      }
      const byOrder = new Map<string, VerificationEntry[]>();
      for (const [ref, entry] of batch) {
        const bankResult = bankResults.get(ref);
        if (!bankResult) continue;
        const list = byOrder.get(entry.orderId) ?? [];
        list.push({ pmDoc: entry.pmDoc, bankResult });
        byOrder.set(entry.orderId, list);
      }

      for (const [orderId, verifications] of byOrder) {
        const snapshot =
          batch.find(([, e]) => e.orderId === orderId)?.[1]?.orderSnapshot ??
          {};
        const allVerified = verifications.every(
          (v) => v.bankResult.found && v.bankResult.amountMatches,
        );

        if (allVerified && this.autoCompleteEnabled) {
          await this.completePaidOrder(
            orderId,
            snapshot as unknown as OrderDocument,
            verifications,
          );
        } else {
          if (allVerified) {
            console.log(
              `[PagoMovil] orden ${orderId}: TODOS los pagos verificados por el bot — auto-cobro desactivado (PAGO_MOVIL_AUTO_COMPLETE), queda para aprobación del cajero`,
            );
          }
          const freshOrder = (await this.orderModel
            .findOne({ _id: orderId })
            .lean()
            .exec()) as OrderDocument | null;
          if (freshOrder) {
            this.posGateway.notifyOrderUpdated({
              ...freshOrder,
              id: freshOrder._id,
            });
          }
        }
      }
    } catch (err) {
      console.error(
        '[PagoMovil] flushQueue batch error:',
        (err as Error)?.message,
      );
    } finally {
      this.isProcessing = false;
      // Si llegaron nuevas refs mientras procesábamos, programar otro flush
      if (this.queue.size > 0) {
        this.scheduleFlush();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers internos
  // ─────────────────────────────────────────────────────────────────────────

  private async reserveOrFind(
    orderId: string,
    ref: string,
    pp: PendingPayment,
    bcvRate?: number,
  ): Promise<PagoMovilDocument> {
    // $setOnInsert garantiza atomicidad: si la ref ya existe (otro mesonero
    // o re-submit), devuelve el documento existente sin modificarlo.
    const doc = await this.pagoMovilModel
      .findOneAndUpdate(
        { referenceNumber: ref },
        {
          $setOnInsert: {
            orderId,
            referenceNumber: ref,
            phoneNumber: pp.pagoMovilPhone || '',
            cedulaPagador: pp.pagoMovilCedula,
            bancoOrigen: pp.pagoMovilBanco,
            expectedAmountBS: pp.amountBs,
            // ESTA era la puerta que quedo abierta: el saneo del 30/07/2026
            // se puso solo en create() y este camino siguio copiando el
            // `amount` del cliente tal cual. Por eso los pagos en Bs pararon
            // el 30/07 pero los pagoMoviles malos siguieron hasta el 11/08.
            expectedAmountUSD: resolveUsdAmount({
              amountUsd: pp.amount,
              amountBs: pp.amountBs,
              bcvRate: bcvRate ?? pp.bcvRate,
            }),
            bcvRate: bcvRate ?? pp.bcvRate,
            status: 'pending',
          },
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();
    return doc as unknown as PagoMovilDocument;
  }

  private async completePaidOrder(
    orderId: string,
    _orderSnapshot: OrderDocument,
    verifications: VerificationEntry[],
  ): Promise<void> {
    for (const { pmDoc, bankResult } of verifications) {
      const alreadyPaid = await this.paymentModel
        .findOne({ orderId, transactionId: pmDoc.referenceNumber })
        .lean()
        .exec();
      if (alreadyPaid) continue;

      // El `??` de antes copiaba expectedAmountUSD sin mirarlo: si ese campo
      // traia bolivares (405 documentos historicos), el bolivar entraba
      // intacto a payments.amount. Ahora se deriva de los Bs siempre que se
      // pueda, sin importar lo que diga el campo USD.
      const amountUSD = resolveUsdAmount({
        amountUsd: pmDoc.expectedAmountUSD,
        amountBs: pmDoc.expectedAmountBS,
        bcvRate: pmDoc.bcvRate,
      });

      await this.paymentModel.create({
        orderId,
        amount: amountUSD,
        method: 'PAGO_MOVIL',
        transactionId: bankResult.referenceNumber ?? pmDoc.referenceNumber,
        status: 'verified',
        bcvRate: pmDoc.bcvRate,
        expectedAmountBS: pmDoc.expectedAmountBS,
        userId: 'system',
        createdAt: new Date(),
      });
    }

    const updatedOrder = await this.orderModel
      .findOneAndUpdate(
        { _id: orderId, status: { $ne: 'PAID' } },
        { status: 'PAID', paymentStatus: 'paid', updatedAt: new Date() },
        { new: true },
      )
      .lean()
      .exec();

    const orderToUse = (updatedOrder ??
      (await this.orderModel
        .findOne({ _id: orderId })
        .lean()
        .exec())) as unknown as OrderDocument | null;
    if (!orderToUse) return;

    await this.autoCreateInvoice(orderToUse);
    await this.releaseTable(orderToUse);
    this.posGateway.notifyOrderUpdated({ ...orderToUse, id: orderToUse._id });
  }

  /**
   * Libera la mesa al pagarse la orden por Pago Móvil. Solo si la mesa sigue
   * apuntando a esta orden (no pisa traspasos). Evita mesas "pegadas" en rojo.
   */
  private async releaseTable(order: {
    _id: unknown;
    tableId?: string | null;
  }): Promise<void> {
    try {
      if (!order?.tableId) return;
      const released = await this.tableModel
        .findOneAndUpdate(
          { _id: order.tableId, orderId: String(order._id) },
          {
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
            orderId: null,
          },
          { new: true },
        )
        .lean();
      if (released) {
        this.posGateway.notifyTableUpdated({ ...released, id: released._id });
      }
    } catch (err) {
      console.error('[PagoMovil] releaseTable error:', (err as Error)?.message);
    }
  }

  private async autoCreateInvoice(order: OrderDocument): Promise<void> {
    try {
      const existing = await this.invoiceModel
        .findOne(facturaDeLaOrden(String(order._id)))
        .lean()
        .exec();
      if (existing) return;

      const ts = Date.now().toString().slice(-8);
      const last4 = String(order._id).slice(-4).toUpperCase();
      const tipAmount = order.tipAmount || 0;
      const total = (order.total || 0) + tipAmount;
      const paidAt = new Date();

      interface InvoicePayload {
        invoiceNumber: string;
        orderId: string;
        customerId: string;
        customerName: string;
        subtotal: number;
        serviceCharge: number;
        tax: number;
        total: number;
        totalAmount: number;
        paymentType: string;
        currency: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        paidAt: Date;
        bcvRate?: number;
        items: Array<{
          productId: string;
          name: string;
          description: string;
          quantity: number;
          unitPrice: number;
          total: number;
          notes?: string;
        }>;
        tip?: number;
      }
      interface OrderItemForInvoice {
        productId: string;
        name: string;
        notes?: string;
        quantity: number;
        unitPrice: number;
        [key: string]: unknown;
      }
      const inv: InvoicePayload = {
        invoiceNumber: `FAC-${ts}-${last4}`,
        orderId: String(order._id),
        customerId:
          (order as unknown as { customerId?: string }).customerId || '',
        customerName: 'Cliente no especificado',
        subtotal: (order as unknown as { subtotal?: number }).subtotal || 0,
        serviceCharge:
          (order as unknown as { serviceCharge?: number }).serviceCharge || 0,
        tax: (order as unknown as { tax?: number }).tax || 0,
        total,
        totalAmount: total,
        paymentType: 'pagoMovil',
        currency: 'USD',
        status: 'paid',
        createdAt: paidAt,
        updatedAt: paidAt,
        paidAt,
        bcvRate: (order as unknown as { bcvRate?: number }).bcvRate,
        items: (
          (order as unknown as { items?: OrderItemForInvoice[] }).items || []
        ).map((it: OrderItemForInvoice) => ({
          productId: it.productId,
          name: it.name,
          description: it.notes || it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.quantity * (it.unitPrice as number),
          ...(it.notes ? { notes: it.notes } : {}),
        })),
      };
      if (tipAmount > 0) inv.tip = tipAmount;

      // Una orden, una factura. El control que habia aca (consultar y
      // despues insertar) no frena dos peticiones simultaneas.
      await createInvoiceOnce(
        this.invoiceModel,
        inv as unknown as Record<string, unknown>,
      );
    } catch (err) {
      console.error(
        `[PagoMovil] autoCreateInvoice failed for ${order?._id}:`,
        (err as Error)?.message,
      );
    }
  }
}
