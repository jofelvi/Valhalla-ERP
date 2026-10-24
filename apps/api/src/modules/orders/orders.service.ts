import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  OnApplicationBootstrap,
  Logger,
  HttpException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Table, TableDocument } from '../tables/schemas/table.schema';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { UpdateOrderDto, UpdateOrderStatusDto } from './dto/update-order.dto';
import {
  TableStatusEnum,
  OrderStatusEnum,
  UserRoleEnum,
  generarNumeroFactura,
} from '@odin6/types';
import { createInvoiceOnce, facturaDeLaOrden } from '../../common/invoice-once';
import { PosGateway } from '../websockets/gateways/pos.gateway';
import { fechaDeJornada, formatearNumeroOrden } from './numero-orden.util';
import { ConfigsService } from '../configs/configs.service';
import {
  camposDeTotales,
  configDeOrden,
  ConfigDeCalculo,
  diferenciasConCliente,
  TasasGuardadas,
} from './config-de-orden.util';
import { AuthService } from '../auth/auth.service';
import { PaymentsService } from '../payments/payments.service';
import { OcrService, VoucherOcrData } from '../ocr/ocr.service';
import { OrderItemEventsService } from './order-item-events.service';
import type { ActorRole } from './schemas/order-item-event.schema';
import { PagoMovilService } from '../pago-movil/pago-movil.service';
import {
  ConsumptionService,
  type OrderItemForInventory,
  type DeliveredConsumptionEntry,
} from '../inventory/consumption.service';
import { MovementsService } from '../inventory/movements.service';
import { KitchenNotifierService } from '../push/kitchen-notifier.service';
import { AccountsReceivableService } from '../accounts-receivable/accounts-receivable.service';
import { SociosExcluidosService } from '../socios-excluidos/socios-excluidos.service';
import {
  validarFusion,
  construirFusion,
  type OrdenFusionable,
} from './merge-orders.util';
import {
  CreateCreditRequestDto,
  ApproveCreditRequestDto,
  RejectCreditRequestDto,
} from './dto/credit-request.dto';
import {
  CreateTransferRequestDto,
  RejectTransferRequestDto,
  CancelTransferRequestDto,
} from './dto/transfer-request.dto';
import {
  signFichaToken,
  verifyFichaToken,
  generateFichaNonce,
} from './ficha-token.util';
import {
  signLinkToken,
  verifyLinkToken,
  generateLinkNonce,
} from './link-token.util';
import {
  validateProductRequest,
  CustomerRequestEntry,
} from './customer-request.util';
import {
  getPackConfig,
  normalizarRegistroPacks,
  packsParaProducto,
  RegistroPacks,
  REGISTRO_PACKS_VACIO,
} from './pack-registry';
import { moduloActivo } from '../../common/modulos/modulo-activo';
import {
  opcionesDeConversion,
  aplicarConversion,
  type OpcionConversion,
  type ItemOrden,
} from './pack-conversion.util';
import { projectionForOrderView } from './order-views.util';
import { buildOrdersQuery } from './build-orders-query.util';
import { paginarOrdenes } from './paginar-ordenes.util';
import {
  pipelineDeCargaPorMesonero,
  completarConCeros,
  type CargaDeMesonero,
} from './carga-por-mesonero.util';
import {
  inicioDeJornada,
  sumarJornadas,
} from '../analytics/panel/panel-rango.util';
import { deliveryDeltas, inheritItemState } from './item-state.util';
import { toActorRole } from './to-actor-role.util';
import { roundMoney } from './round-money.util';
import { normalizeItemsMoney } from './normalize-items-money.util';
import { CAMPOS_DE_USUARIO_EN_POS, usuarioParaPos } from './pos-data-user.util';
import {
  classifyOrderPaymentStatus,
  buildPaymentStatusError,
} from './credit-approval.util';
import {
  computeSentRemovals,
  type SentRemoval,
} from './compute-sent-removals.util';
import { DiscountItemDto, RemoveItemDiscountDto } from './dto/item-actions.dto';
import {
  calcularMontoDescuento,
  computeOrderTotals,
  DescuentoInvalidoError,
} from './order-totals.util';

export type AuthUser = { id: string; role: string; name?: string } | undefined;

// Estaciones con control estricto (solo entregan escaneando la ficha). La ficha
// incluye ítems de estas 3 estaciones; cada pantalla filtra por la suya.
const CONTROLLED_STATIONS = ['BAR', 'KITCHEN', 'PIZZA'];

export interface FichaVariantView {
  variantProductId: string;
  variantName: string;
  qty: number;
  deliveredQty: number;
  pendingQty: number;
}

export interface FichaItemView {
  itemId: string;
  productId: string;
  productName: string;
  station: string;
  quantity: number;
  deliveredQty: number;
  pendingQty: number;
  composition?: FichaVariantView[];
}

export interface FichaView {
  orderId: string;
  orderNumber: string;
  tableName?: string | null;
  sector?: string | null;
  waiterName?: string | null;
  createdAt?: string | null;
  status: string;
  fichaToken: string;
  items: FichaItemView[];
}

export interface FichaDeliveryInput {
  itemId: string;
  delta: number;
  variantProductId?: string;
}

/** Campos del catalogo que necesita la validacion de packs. */
interface ProductLean {
  _id: string;
  name?: string;
  price?: number;
  presentationQuantity?: number;
}

/** Orden como la lee el recálculo: sus tasas guardadas y quién atiende. */
type OrdenParaTotales = TasasGuardadas & { waiterId?: string | null };

@Injectable()
export class OrdersService implements OnApplicationBootstrap {
  private readonly logger = new Logger('OrdersService');

  // Cola serializada de OCR. Procesamos UNA orden a la vez para no saturar
  // el VPS (tesseract usa todos los cores y con N concurrentes la load se
  // dispara y todos hacen timeout). Set para deduplicar si la misma orden
  // se reencola mientras espera.
  private ocrQueue: string[] = [];
  private ocrQueued = new Set<string>();
  private ocrWorkerRunning = false;

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Table.name) private tableModel: Model<TableDocument>,
    @InjectModel('User') private userModel: any,
    @InjectModel('Invoice') private invoiceModel: any,
    @InjectModel('Payment') private paymentModel: any,
    // Catalogo: necesario para saber que productos se venden por pack y a que
    // precio, y asi validar los totales sin confiar en el cliente.
    @InjectModel('Product') private productModel: Model<ProductLean>,
    private readonly posGateway: PosGateway,
    private readonly authService: AuthService,
    private readonly paymentsService: PaymentsService,
    private readonly ocrService: OcrService,
    private readonly itemEvents: OrderItemEventsService,
    private readonly pagoMovilService: PagoMovilService,
    private readonly consumptionService: ConsumptionService,
    private readonly accountsReceivableService: AccountsReceivableService,
    private readonly movements: MovementsService,
    private readonly kitchenNotifier: KitchenNotifierService,
    private readonly sociosExcluidos: SociosExcluidosService,
    private readonly configs: ConfigsService,
  ) {}

  /**
   * Recovery al arranque del proceso: el OCR corre en setImmediate (en
   * memoria), por lo que cualquier reinicio de PM2 mata las tareas en cola
   * silenciosamente y la UI queda mostrando "OCR procesando..." para
   * siempre. Aca buscamos todas las ordenes con pendingPayments que tengan
   * proofUrls pero su OCR este incompleto (o ausente) y las re-encolamos.
   * Es seguro re-correr porque processOcrForOrder ya skipea entries que
   * tienen ocr.imagesProcessed === proofs.length.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const orders = await this.orderModel
        .find(
          {
            isDeleted: { $ne: true },
            pendingPayments: {
              $elemMatch: {
                proofUrls: { $exists: true, $ne: [] },
              },
            },
          },
          { _id: 1, pendingPayments: 1 },
        )
        .lean()
        .exec();

      const pending: string[] = [];
      for (const o of orders) {
        const pps: any[] = (o.pendingPayments as any[]) || [];
        const needsOcr = pps.some((pp) => {
          const proofs = pp?.proofUrls || [];
          if (proofs.length === 0) return false;
          if (!pp?.ocr) return true;
          return pp.ocr.imagesProcessed !== proofs.length;
        });
        if (needsOcr) pending.push(String(o._id));
      }

      if (pending.length === 0) return;
      // eslint-disable-next-line no-console
      console.log(
        `[OCR-bootstrap] encolando ${pending.length} ordenes con OCR pendiente (procesamiento serial)`,
      );
      for (const orderId of pending) {
        this.kickOffOcrInBackground(orderId);
      }
    } catch (err) {
      // No fallar el arranque por esto — solo loguear.
      // eslint-disable-next-line no-console
      console.error('[OCR-bootstrap] fallo recovery:', err);
    }
  }

  /**
   * Encola una orden para procesamiento OCR. Si el worker no esta corriendo,
   * lo arranca. Garantiza que solo se procese UNA orden a la vez para no
   * saturar el VPS (un solo tesseract usa varios cores; N concurrentes
   * disparan la load average y todos timeout).
   *
   * Mantiene el nombre antiguo `kickOffOcrInBackground` para no romper los
   * llamadores en create()/update(). Es fire-and-forget desde su POV.
   */
  private kickOffOcrInBackground(orderId: string): void {
    if (this.ocrQueued.has(orderId)) return; // ya en cola, evitar duplicados
    this.ocrQueued.add(orderId);
    this.ocrQueue.push(orderId);
    this.startOcrWorker();
  }

  private startOcrWorker(): void {
    if (this.ocrWorkerRunning) return;
    this.ocrWorkerRunning = true;
    setImmediate(() => {
      void this.runOcrWorkerLoop();
    });
  }

  private async runOcrWorkerLoop(): Promise<void> {
    try {
      while (this.ocrQueue.length > 0) {
        const orderId = this.ocrQueue.shift();
        if (!orderId) continue;
        try {
          await this.processOcrForOrder(orderId);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[OCR] orden ${orderId} fallo:`, err);
        } finally {
          this.ocrQueued.delete(orderId);
        }
      }
    } finally {
      this.ocrWorkerRunning = false;
    }
  }

  private async processOcrForOrder(orderId: string): Promise<void> {
    const order = await this.orderModel.findOne({ _id: orderId }).lean().exec();
    if (!order || !order.pendingPayments?.length) return;

    let anyChange = false;
    for (let i = 0; i < order.pendingPayments.length; i++) {
      const pp: any = order.pendingPayments[i];
      const proofs: string[] = pp.proofUrls || [];
      // Skip si ya tiene OCR procesado para todas sus imagenes
      if (pp.ocr && pp.ocr.imagesProcessed === proofs.length) continue;
      if (proofs.length === 0) continue;

      const ocrPerImage: Array<VoucherOcrData & { url: string }> = [];
      for (const url of proofs) {
        const localPath = this.ocrService.resolveLocalPath(url);
        if (!localPath) continue;
        const data = await this.ocrService.extractVoucherData(localPath);
        ocrPerImage.push({ ...data, url });
      }

      // Agregamos refs y montos extraidos de TODAS las imagenes
      const allRefsLong = new Set<string>();
      const allRefsShort = new Set<string>();
      const allAmountsBs: number[] = [];
      const allCodes = new Set<string>();
      for (const o of ocrPerImage) {
        o.refs.forEach((r) => allRefsLong.add(r));
        o.shortRefs.forEach((r) => allRefsShort.add(r));
        o.amountsBs.forEach((a) => allAmountsBs.push(a));
        o.codesAprob.forEach((c) => allCodes.add(c));
      }

      // Comparar con lo que el mesonero ingreso (ref puede venir concatenada)
      const inputRefs = (pp.reference || '')
        .split(/[\/,;|+\-\s\n\r]+/)
        .map((s: string) => s.replace(/[^0-9]/g, '').trim())
        .filter((s: string) => s.length >= 4);

      const warnings: string[] = [];

      // Comparacion long ↔ input. Una ref larga "cubre" un input si:
      //   - el input es sufijo de la long (mesonero tipeo los ultimos N digitos)
      //   - O el input ES la long completa
      // Esto evita falsos positivos del tipo: input "518780" + long "061076518780"
      // — antes el short "8780" generaba un warning extra aunque la ref real
      // ya cubria el input completo.
      const longCovers = (long: string, input: string): boolean => {
        if (!long || !input) return false;
        return long.endsWith(input) || input === long;
      };

      const matchedLongs = new Set<string>();
      const unmatchedInputs: string[] = [];
      for (const input of inputRefs) {
        const hit = Array.from(allRefsLong).find((l) => longCovers(l, input));
        if (hit) matchedLongs.add(hit);
        else if (!allRefsShort.has(input)) unmatchedInputs.push(input);
        // Si el input solo aparece como short (mesonero tipeo 4 digitos
        // identicos a los ultimos 4 de una long), tambien lo damos por bueno.
        else {
          // Marcar la long de la cual deriva el short
          const hitShort = Array.from(allRefsLong).find(
            (l) => l.slice(-4) === input,
          );
          if (hitShort) matchedLongs.add(hitShort);
        }
      }

      // Refs ingresadas que NO aparecen en ninguna foto (real positive)
      if (unmatchedInputs.length > 0 && allRefsLong.size > 0) {
        warnings.push(
          `Refs ingresadas que NO aparecen en la(s) foto(s): ${unmatchedInputs.join(', ')}`,
        );
      }
      // Refs en la foto que NO matchean con ningun input. Reportamos las
      // refs LARGAS no matcheadas (no los shorts derivados de ellas).
      const unmatchedLongs = Array.from(allRefsLong).filter(
        (l) => !matchedLongs.has(l),
      );
      if (unmatchedLongs.length > 0 && inputRefs.length > 0) {
        warnings.push(
          `La(s) foto(s) tienen refs que el mesonero NO ingreso: ${unmatchedLongs.join(', ')}`,
        );
      }

      // Detectar reuso: cada ref larga extraida — ¿ya esta en otra orden?
      // Solo refs de 8+ digitos (las refs cortas de 4 digitos generan
      // demasiados falsos positivos contra pagos viejos). Adicionalmente
      // filtramos por confianza: solo cuenta como fraud_suspect si la
      // otra orden esta cerca en tiempo (<24h) o tiene monto similar
      // (+/- 5%). Si no, queda como warning informativo "revisar manual".
      const rawDups: any[] = [];
      for (const refLong of allRefsLong) {
        if (refLong.length < 8) continue;
        const conflict = await this.paymentsService.checkReferenceUsed(
          refLong,
          orderId,
        );
        if (conflict?.conflicts?.length) {
          for (const c of conflict.conflicts) rawDups.push(c);
        }
      }

      const SAME_DAY_MS = 24 * 60 * 60 * 1000;
      const AMOUNT_TOLERANCE = 0.05;
      const orderTime = new Date(
        (order as any).createdAt || (order as any).updatedAt || Date.now(),
      ).getTime();
      const ppAmount = Number((pp as any).amount || 0);
      const highConfidenceDups = rawDups.filter((d: any) => {
        const dTime = d.createdAt ? new Date(d.createdAt).getTime() : null;
        const sameDay =
          dTime != null && Math.abs(dTime - orderTime) < SAME_DAY_MS;
        const amountClose =
          ppAmount > 0 &&
          Number(d.amount) > 0 &&
          Math.abs(Number(d.amount) - ppAmount) / ppAmount < AMOUNT_TOLERANCE;
        return sameDay || amountClose;
      });

      if (highConfidenceDups.length > 0) {
        const where = highConfidenceDups
          .map(
            (c: any) =>
              `${c.part} en orden #${String(c.orderId).slice(-8).toUpperCase()}`,
          )
          .join('; ');
        warnings.push(`POSIBLE REUSO DE VOUCHER: ${where}`);
      } else if (rawDups.length > 0) {
        const where = rawDups
          .map(
            (c: any) =>
              `${c.part} en orden #${String(c.orderId).slice(-8).toUpperCase()}`,
          )
          .join('; ');
        warnings.push(
          `Ref aparece en otra orden (lejana en tiempo/monto, revisar manual): ${where}`,
        );
      }

      const duplicateInOtherOrders = highConfidenceDups;
      const status =
        highConfidenceDups.length > 0
          ? 'fraud_suspect'
          : warnings.length > 0
            ? 'mismatch'
            : 'ok';

      const ocrPayload = {
        processedAt: new Date(),
        status,
        imagesProcessed: ocrPerImage.length,
        extractedRefs: Array.from(allRefsLong),
        extractedShortRefs: Array.from(allRefsShort),
        extractedAmountsBs: allAmountsBs,
        extractedCodes: Array.from(allCodes),
        inputRefs,
        warnings,
        duplicateInOtherOrders,
        perImage: ocrPerImage.map((o) => ({
          url: o.url,
          refs: o.refs,
          amountsBs: o.amountsBs,
          codes: o.codesAprob,
          type: o.type,
          status: o.status,
          durationMs: o.durationMs,
          // Persistimos el texto crudo (truncado a 1500 chars en parser) para
          // poder auditar mismatches sin tener que re-correr tesseract.
          raw: o.raw,
        })),
      };

      await this.orderModel
        .updateOne(
          { _id: orderId, [`pendingPayments.${i}._id`]: pp._id },
          { $set: { [`pendingPayments.${i}.ocr`]: ocrPayload } },
        )
        .exec();
      anyChange = true;
    }

    if (anyChange) {
      // Refrescar la orden y emitir WS para que el cajero vea el flag
      const fresh = await this.orderModel
        .findOne({ _id: orderId })
        .lean()
        .exec();
      if (fresh) {
        this.posGateway.notifyOrderUpdated({ ...fresh, id: fresh._id });
      }
    }
  }

  /**
   * Si en el body viene `pendingPayments[]`, valida que ninguna referencia
   * (ni cada parte si viene concatenada con / , ;) este ya usada en otra
   * orden. Bloquea fraudes tipo "voucher reusado de otra mesonera".
   *
   * Ejecutar SIEMPRE que la orden vaya a recibir un cobro pendiente,
   * tanto desde APK como desde web. Si encuentra conflictos lanza 400 con
   * detalle para que el cliente muestre alerta clara.
   */
  private async assertPendingRefsAreUnique(
    pendingPayments: any[] | undefined,
    excludeOrderId?: string,
  ): Promise<void> {
    if (!pendingPayments || pendingPayments.length === 0) return;
    const allConflicts: any[] = [];
    for (const pp of pendingPayments) {
      const ref = (pp?.reference || '').trim();
      if (!ref) continue;
      // Pasar el metodo para que la validacion sea por sistema de pago:
      // PAGO_MOVIL y CARD/TRANSFER usan numeraciones independientes, no deben cruzarse.
      const result = await this.paymentsService.checkReferenceUsed(
        ref,
        excludeOrderId,
        pp?.method,
      );
      if (result?.conflicts?.length) {
        for (const c of result.conflicts) allConflicts.push(c);
      }
    }
    if (allConflicts.length === 0) return;
    const lines = allConflicts.map((c) => {
      const oid = String(c.orderId || '')
        .slice(-8)
        .toUpperCase();
      const where =
        c.source === 'pendingPayments'
          ? 'pendiente de verificacion'
          : c.source === 'pagoMoviles'
            ? 'pago movil'
            : 'pago aprobado';
      const amt = c.amount ? ` $${Number(c.amount).toFixed(2)}` : '';
      return `Ref ${c.part}: ya usada en orden #${oid} (${where}${amt})`;
    });
    throw new BadRequestException({
      code: 'DUPLICATE_REFERENCE',
      message:
        'Una o mas referencias ya fueron usadas en otra orden. Verifica que no estes repitiendo un voucher.',
      conflicts: allConflicts,
      details: lines,
    });
  }

  /**
   * Si la orden quedo PAID y aun no tiene factura, crea una automaticamente
   * derivando paymentType de los Payment ya registrados. Idempotente: si
   * existe factura para este orderId no hace nada. No bloquea el flujo —
   * cualquier error solo se loguea.
   *
   * Esto cubre el race condition del frontend (router.push aborta el await
   * createInvoice) que causaba ~8% de ordenes pagadas sin factura.
   */
  /**
   * Red de seguridad: si la orden quedó PAGADA (status PAID o paymentStatus
   * 'paid') y aún tiene mesa asignada, libera la mesa (los 3 campos). Cubre
   * TODAS las rutas de pago (web POS, app mesoneros, verificación de pagos),
   * evitando que la mesa quede "pegada" en rojo sin pedido activo.
   * Solo libera si la mesa sigue apuntando a ESTA orden (no pisa traspasos).
   */
  private async releaseTableIfPaid(order: {
    _id: unknown;
    tableId?: string | null;
    status?: string;
    paymentStatus?: string;
  }): Promise<void> {
    try {
      if (!order || !order._id || !order.tableId) return;
      const isPaid =
        order.paymentStatus === 'paid' || order.status === OrderStatusEnum.PAID;
      if (!isPaid) return;

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
      console.error(
        '[Orders] releaseTableIfPaid error:',
        (err as Error)?.message,
      );
    }
  }

  /**
   * Red de seguridad de inventario: si la orden quedó pagada, descuenta el
   * consumo por recetas UNA sola vez (claim atómico con inventoryProcessed).
   * Nunca bloquea el flujo de pago — errores solo se loguean.
   */
  private async processInventoryIfPaid(order: {
    _id: unknown;
    status?: string;
    paymentStatus?: string;
  }): Promise<void> {
    try {
      const isPaid =
        order?.paymentStatus === 'paid' ||
        order?.status === OrderStatusEnum.PAID;
      if (!order?._id || !isPaid) return;

      const claim = await this.orderModel.updateOne(
        { _id: String(order._id), inventoryProcessed: { $ne: true } },
        { $set: { inventoryProcessed: true } },
      );
      if (claim.modifiedCount !== 1) return; // ya procesada

      const fresh = await this.orderModel
        .findOne({ _id: String(order._id) })
        .lean();
      if (!fresh) return;
      const sinTobos = (
        (fresh.items ?? []) as Array<{
          _id?: unknown;
          productId?: string;
          quantity?: number;
          station?: string | null;
          cancelledAt?: Date | null;
          composition?: unknown[] | null;
          inventoryConsumedQty?: number | null;
          customizations?: { removedIngredients?: string[] } | null;
        }>
      )
        // Los tobos mixtos (con composición) ya movieron su inventario POR
        // VARIANTE al despachar (deliverByFicha). Excluirlos aquí evita el
        // doble descuento contra la receta fija del producto tobo.
        .filter((it) => !(it.composition && it.composition.length));

      // El pago es el RESPALDO del descuento en vivo: solo consume lo que la
      // entrega con QR no consumió aún (quantity − inventoryConsumedQty).
      // Con el descuento en vivo apagado el contador es 0 y esto se comporta
      // exactamente como siempre (consume todo al pagar).
      const items: OrderItemForInventory[] = sinTobos
        .map((it) => ({
          itemId: String(it._id ?? ''),
          productId: String(it.productId ?? ''),
          quantity: Math.max(
            0,
            Number(it.quantity ?? 0) - Number(it.inventoryConsumedQty ?? 0),
          ),
          station: it.station ?? null,
          cancelledAt: it.cancelledAt ?? null,
          customizations: it.customizations ?? null,
        }))
        .filter((it) => it.quantity > 0);
      if (items.length > 0) {
        await this.consumptionService.processOrderPaid({
          id: String(fresh._id),
          items,
        });
      }

      // Sellar contadores: tras el pago, todo lo de la orden queda consumido.
      // Una entrega escaneada DESPUÉS de pagar (flujo "Enviar y Cobrar") verá
      // restante 0 y no duplicará.
      for (const it of sinTobos) {
        if (it.cancelledAt) continue;
        await this.updateItemFieldByIndex(
          String(fresh._id),
          String(it._id),
          'inventoryConsumedQty',
          { set: Number(it.quantity ?? 0) },
        );
      }
    } catch (err) {
      console.error(
        '[Orders] processInventoryIfPaid error:',
        (err as Error)?.message,
      );
    }
  }

  private async ensureInvoiceForPaidOrder(order: any): Promise<void> {
    try {
      if (!order || !order._id) return;
      if (order.status !== OrderStatusEnum.PAID) return;

      const existing = await this.invoiceModel
        .findOne(facturaDeLaOrden(String(order._id)))
        .lean()
        .exec();
      if (existing) return;

      const payments = await this.paymentModel
        .find({ orderId: String(order._id) })
        .lean()
        .exec();
      // Prioridad: CARD > TRANSFER > PAGO_MOVIL > CASH
      const methods = payments.map((p: any) => p.method);
      let paymentType = 'cash';
      if (methods.includes('CARD')) paymentType = 'card';
      else if (methods.includes('TRANSFER')) paymentType = 'transfer';
      else if (methods.includes('PAGO_MOVIL')) paymentType = 'paymobil';

      // Moneda, etiquetas de impuesto y servicio: las de la orden (con que se calculó).
      const { tarifas } = configDeOrden(order);
      const vocabulario = await this.configs.obtener('vocabulario');

      const tipAmount = order.tipAmount || 0;
      const total = roundMoney((order.total || 0) + tipAmount);
      const last4 = String(order._id).slice(-4).toUpperCase();
      const ts = Date.now().toString().slice(-8);
      const invoiceNumber = generarNumeroFactura(String(order._id), Date.now());
      const paidAt = order.paidAt || order.updatedAt || new Date();
      const bcvRate = payments[0]?.bcvRate;

      const items = (order.items || []).map((it: any) => ({
        productId: it.productId,
        name: it.name,
        description: it.notes || it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
        notes: it.notes || undefined,
      }));

      const inv: any = {
        invoiceNumber,
        orderId: String(order._id),
        customerId: order.customerId || '',
        customerName: 'Cliente no especificado',
        subtotal: order.subtotal || 0,
        serviceCharge: order.serviceCharge || 0,
        tax: order.tax || 0,
        total,
        totalAmount: total,
        paymentType,
        currency: tarifas.baseCurrency,
        taxLabel: tarifas.tax.label,
        serviceChargeLabel: vocabulario.service,
        status: 'paid',
        createdAt: paidAt,
        updatedAt: paidAt,
        paidAt,
        items,
      };
      if (tipAmount > 0) inv.tip = tipAmount;
      if (bcvRate) inv.bcvRate = bcvRate;

      // Una orden, una factura (ver common/invoice-once.ts): este camino
      // facturaba en paralelo al POST del API y al auto-cobro de Pago Movil.
      await createInvoiceOnce(this.invoiceModel, inv);
    } catch (err) {
      // No bloquear el update de la orden
      // eslint-disable-next-line no-console
      console.error(
        `[OrdersService] auto-crear factura fallo para orden ${order?._id}:`,
        err,
      );
    }
  }

  /**
   * APKs < 1-may-2026 normalizaban OrderItem con `productName` pero sin `name`.
   * Al re-enviar esos items en un PATCH (agregar items a orden), el `name`
   * llega vacio o ausente. Este helper resuelve el nombre correcto:
   *   1. Usa `name` si no es vacio.
   *   2. Cae a `productName`.
   *   3. Si ambos vacios, busca el nombre en la coleccion `products`.
   * Se aplica tanto en create como en update para cualquier array de items.
   */
  private async resolveItemNames<
    T extends { name?: string; productName?: string; productId?: string },
  >(items: T[] | undefined): Promise<T[]> {
    if (!items) return [];

    // Detectar items sin nombre para hacer un solo query
    const needsLookup = items.filter(
      (it) => !it.name && !it.productName && it.productId,
    );
    const nameMap = new Map<string, string>();
    if (needsLookup.length > 0) {
      const productIds = needsLookup.map((it) => it.productId!);
      const products: any[] = await (this.orderModel as any).db
        .collection('products')
        .find({ _id: { $in: productIds } }, { projection: { name: 1 } })
        .toArray();
      for (const p of products) {
        if (p._id && p.name) nameMap.set(String(p._id), String(p.name));
      }
    }

    return items.map((item) => ({
      ...item,
      name:
        item.name ||
        item.productName ||
        (item.productId ? nameMap.get(item.productId) : undefined) ||
        '',
    }));
  }

  /**
   * Evita que un mesonero modifique ordenes de otro mesonero. Cajero,
   * admin y manager pasan libres porque por diseno pueden tocar cualquier
   * orden (cobro, correcciones, asignaciones). Si la llamada viene sin
   * `user` (p. ej. webhook o script interno), no se valida ownership.
   */
  private async assertWaiterOwnership(
    orderId: string,
    user: AuthUser,
  ): Promise<void> {
    if (!user) return;
    const role = String(user.role || '').toLowerCase();
    if (role !== 'waiter') return;

    const order = await this.orderModel
      .findOne({ _id: orderId }, { waiterId: 1, userId: 1 })
      .lean()
      .exec();
    if (!order)
      throw new NotFoundException(`Order with ID ${orderId} not found`);

    const isOwner =
      order.waiterId === user.id ||
      (order as unknown as { userId?: string }).userId === user.id;
    if (!isOwner) {
      throw new ForbiddenException(
        'Esta orden pertenece a otro mesonero. No puedes modificarla.',
      );
    }
  }

  /**
   * Nombre del mesonero que se congela en la orden, resuelto por el SERVIDOR
   * a partir del waiterId.
   *
   * La orden guarda dos campos: waiterId (de quien es) y waiterName (copia del
   * nombre para que los reportes no resuelvan el usuario en cada fila). Tres
   * caminos los dejaban diciendo cosas distintas, y la raiz es una sola: el
   * JWT NO lleva el nombre (jwt.strategy.ts devuelve id, email y role), asi
   * que todo `user.name || 'Usuario'` escribia el literal. Medido el 17/09:
   * 82 de 82 waiterShares y 45 de 45 fromWaiterName decian "Usuario", y 241
   * ordenes apuntaban a una persona diciendo el nombre de otra. Las comisiones
   * no se vieron afectadas (se calculan por waiterId), pero todo reporte que
   * agrupa por nombre -- cobros incompletos, top mesoneros del panel -- se lo
   * acreditaba al mesonero equivocado.
   *
   * El nombre se congela a proposito: si el empleado se va o se renombra, la
   * orden vieja debe seguir diciendo quien atendio. Lo que cambia es que ahora
   * se congela el correcto.
   *
   * Devuelve null si el waiterId no tiene usuario detras, para que quien llama
   * decida si conserva lo que ya tenia en vez de borrarlo.
   */
  private async nombreDelMesonero(waiterId: string): Promise<string | null> {
    const mesonero: { name?: string } | null = await this.userModel
      .findOne({ _id: waiterId })
      .select('name')
      .lean()
      .exec();
    if (!mesonero?.name) {
      this.logger.warn(
        `waiterId ${waiterId} sin usuario que lo respalde: se conserva el nombre que hubiera`,
      );
      return null;
    }
    return mesonero.name;
  }

  async create(createOrderDto: CreateOrderDto) {
    // Idempotencia: si el cliente reintenta la creacion (mala red, re-tap),
    // el mismo clientRequestId devuelve la orden ya creada en vez de duplicar.
    // Caso real 19/07: 3 ordenes identicas simultaneas por fallas de internet.
    if (createOrderDto.clientRequestId) {
      const existing = await this.orderModel
        .findOne({ clientRequestId: createOrderDto.clientRequestId })
        .lean()
        .exec();
      if (existing) {
        this.logger.warn(
          `create dedupe: clientRequestId=${createOrderDto.clientRequestId} ya existe como orden ${String(existing._id)}`,
        );
        return { ...existing, id: String(existing._id) };
      }
    }
    // Bloquear refs duplicadas si vienen pendingPayments al crear
    await this.assertPendingRefsAreUnique(
      (createOrderDto as any).pendingPayments,
    );
    // ── El nombre del mesonero lo estampa el SERVIDOR ──
    // 2.292 ordenes historicas quedaron con waiterId y sin waiterName porque
    // dependia de que el cliente lo mandara. Sin el, todo reporte por mesonero
    // las muestra como "(sin mesonero)" aunque SI tengan dueño: al auditar las
    // propinas, 191 de 287 parecian huerfanas y ninguna lo estaba.
    //
    // Se congela el nombre del momento de la orden a proposito: si el empleado
    // se va o se renombra, la orden vieja debe seguir diciendo quien atendio.
    //
    // Ya no se respeta el waiterName que manda el cliente: la web mandaba el
    // nombre de quien tenia la sesion abierta (el admin) mientras el waiterId
    // era el mesonero elegido en el selector, y la orden quedaba a nombre de
    // quien la tecleo. El id manda; el nombre se deriva de el.
    if (createOrderDto.waiterId) {
      const nombre = await this.nombreDelMesonero(createOrderDto.waiterId);
      if (nombre) {
        (createOrderDto as { waiterName?: string }).waiterName = nombre;
      }
    }

    // Si viene tableId, reservamos la mesa ATOMICAMENTE antes de crear la
    // orden. Aceptamos dos escenarios:
    //   a) mesa totalmente libre (flujo sin claim previo)
    //   b) mesa ya reservada por el mismo usuario que esta creando la
    //      orden (flujo con claim previo). El "mismo usuario" puede ser
    //      el userId (quien manda el request, ej cajero) O el waiterId
    //      (mesonero asignado). Esto cubre el caso del cajero que
    //      reserva mesa y luego asigna un mesonero distinto.
    const possibleClaimers = [
      createOrderDto.userId,
      createOrderDto.waiterId,
    ].filter((v): v is string => !!v);

    if (createOrderDto.tableId) {
      const claimed = await this.tableModel
        .findOneAndUpdate(
          {
            _id: createOrderDto.tableId,
            orderId: null,
            $or: [
              { isAvailable: true },
              possibleClaimers.length > 0
                ? {
                    isAvailable: false,
                    claimedBy: { $in: possibleClaimers },
                  }
                : { _id: '__never__' },
            ],
          },
          {
            status: TableStatusEnum.OCCUPIED,
            isAvailable: false,
            orderId: 'PENDING_ORDER_CREATION',
            claimedBy: null,
            claimedByName: null,
            claimedAt: null,
          },
          { new: true },
        )
        .lean();

      if (!claimed) {
        const existing = await this.orderModel
          .findOne({
            tableId: createOrderDto.tableId,
            status: {
              $in: [
                OrderStatusEnum.PENDING,
                OrderStatusEnum.IN_PROGRESS,
                OrderStatusEnum.READY,
              ],
            },
            isDeleted: { $ne: true },
          })
          .lean()
          .exec();
        if (existing) {
          const shortId = String(existing._id).slice(-8).toUpperCase();
          throw new BadRequestException(
            `La mesa ya tiene una orden activa (#${shortId}, estado ${existing.status}). ` +
              `Cobra, cancela o traspasa esa orden antes de crear una nueva en la misma mesa.`,
          );
        }
        const current = await this.tableModel
          .findOne({ _id: createOrderDto.tableId })
          .lean();
        if (
          current?.claimedBy &&
          !possibleClaimers.includes(current.claimedBy)
        ) {
          throw new BadRequestException(
            `La mesa la esta atendiendo ${current.claimedByName ?? 'otro mesonero'}.`,
          );
        }
        throw new BadRequestException(
          'La mesa no esta disponible. Refresca e intenta con otra.',
        );
      }
    }

    // Con la mesa ya reservada, creamos la orden. Si la creacion falla,
    // hacemos rollback de la mesa para no dejarla bloqueada.
    let order;
    try {
      // Numero diario para cocina (`290826-0001`). Se asigna SIEMPRE aqui: si
      // se deja al cliente, solo lo llevan las ordenes del POS web — de 25
      // ordenes de un dia, 4 lo tenian, y las demas se identificaban con los
      // ultimos 8 caracteres del id, que no dicen nada.
      const orderNumber =
        createOrderDto.orderNumber ?? (await this.generateOrderNumber());

      // Una orden NUEVA toma la configuración vigente y la guarda entera: a partir de
      // aquí su total ya no depende de cómo cambien las tarifas.
      const config = await this.configVigente();
      // El servidor manda: calcula el servicio, el impuesto y la comisión. Lo que mande
      // el cliente solo se registra si difiere (clientes viejos calculan por su cuenta).
      const totalesCreate = computeOrderTotals(
        (createOrderDto.items ?? []) as unknown as Array<
          Record<string, unknown>
        >,
        Boolean(createOrderDto.waiterId),
        config.tarifas,
        config.nomina,
      );
      const comisionBaseCreate = await this.ajustarComisionBasePorSocio(
        (createOrderDto as { customerId?: string | null }).customerId,
        totalesCreate.comisionBase,
      );

      for (const diff of diferenciasConCliente(createOrderDto, totalesCreate)) {
        this.logger.warn(
          `[orders] el cliente calculo distinto (${diff}); se guarda el del servidor` +
            ` (cliente=${createOrderDto.waiterId ? 'mesonero' : (createOrderDto.userId ?? '?')})`,
        );
      }

      order = await this.orderModel.create({
        ...createOrderDto,
        orderNumber,
        items: await this.resolveItemNames(createOrderDto.items),
        ...camposDeTotales(totalesCreate, config),
        total: roundMoney(totalesCreate.total),
        comisionBase: comisionBaseCreate,
        createdAt: new Date(),
      });
    } catch (err) {
      if (createOrderDto.tableId) {
        await this.tableModel
          .findOneAndUpdate(
            {
              _id: createOrderDto.tableId,
              orderId: 'PENDING_ORDER_CREATION',
            },
            {
              status: TableStatusEnum.ISAVAILABLE,
              isAvailable: true,
              orderId: null,
            },
          )
          .lean();
      }
      throw err;
    }

    // Grabar el orderId real en la mesa (reemplaza el placeholder)
    if (createOrderDto.tableId) {
      const updatedTable = await this.tableModel
        .findOneAndUpdate(
          { _id: createOrderDto.tableId },
          { orderId: order._id.toString() },
          { new: true },
        )
        .lean();
      if (updatedTable) {
        this.posGateway.notifyTableUpdated({
          ...updatedTable,
          id: updatedTable._id,
        });
      }
    }

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };

    // Auditoria — al crear la orden, cada item es un ITEM_ADDED. Si la orden
    // tiene waiterId lo usamos como actor; si no, caemos al userId. El rol se
    // infiere como waiter cuando hay waiterId, sino system (en Fase 2 con el
    // refactor de endpoints a items dedicados, esto se reemplaza por el JWT).
    const actorId = createOrderDto.waiterId || createOrderDto.userId;
    const actorRole: ActorRole = createOrderDto.waiterId ? 'waiter' : 'system';
    const items: any[] = (obj.items as any[]) ?? [];
    if (actorId && items.length > 0) {
      void this.itemEvents.recordMany(
        items.map((it) => ({
          orderId: String(obj._id),
          itemId: String(it._id),
          productId: it.productId,
          productName: it.name,
          eventType: 'ITEM_ADDED' as const,
          qty: it.quantity ?? 1,
          station: it.station,
          actorId,
          actorRole,
        })),
      );
    }

    this.posGateway.notifyOrderCreated(result);

    // OCR async si vienen comprobantes desde el inicio (raro, pero soportado)
    if ((createOrderDto as any).pendingPayments?.length) {
      this.kickOffOcrInBackground(String(obj._id));
    }
    return result;
  }

  async findAll(filters?: {
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
    /** Cuantas ordenes como maximo. Ver LIMITE_DURO_DE_ORDENES. */
    limit?: number;
    /** Pagina (1 en adelante). Solo tiene sentido junto con `limit`. */
    page?: number;
  }) {
    const query = buildOrdersQuery(filters);

    // Una vista con nombre recorta los campos que viajan. Sin vista, la orden
    // sale entera, que es lo que espera todo el resto del sistema.
    const projection = projectionForOrderView(filters?.view);
    const { limit, skip } = paginarOrdenes(filters?.limit, filters?.page);

    // `.limit()` y `.skip()` van SIEMPRE en la cadena, no condicionados: si se
    // reasigna el cursor a un paso intermedio, los genericos de Mongoose dejan
    // de encajar (select() y lean() devuelven Query de otro tipo).
    const cursor = this.orderModel.find(query);
    const orders = await (projection ? cursor.select(projection) : cursor)
      .lean()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    // Si la respuesta llego JUSTO al limite, es muy probable que haya quedado
    // algo afuera. Truncar en silencio es como se rompen los reportes: el que
    // pidio un mes ve 500 de 1.220 filas, no falla nada, y se descubre al
    // cuadrar mal semanas despues. Esto no arregla la consulta —no puede—,
    // pero deja rastro para encontrar al consumidor que tiene que mandar
    // `limit`. Sin este aviso, el tope que protege de un problema crea otro
    // peor, porque el segundo no se ve.
    if (orders.length === limit) {
      this.logger.warn(
        `[ordenes] respuesta truncada en ${limit}. Filtros: ${JSON.stringify(
          filters ?? {},
        )}. Si este consumidor necesita mas, tiene que mandar 'limit'.`,
      );
    }

    return orders.map((order) => ({ ...order, id: order._id }));
  }

  /**
   * Ordenes por mesonero en la jornada, para el reparto round-robin de mesas.
   *
   * Reemplaza el `GET /api/orders` sin filtros que hacia el telefono: 4.766
   * ordenes y 1,57 MB para obtener media docena de numeros. Ver
   * `carga-por-mesonero.util.ts` para el porque y para el bug de la medianoche.
   *
   * `waiterIds` son los mesoneros activos: los que no tomaron ninguna orden
   * vuelven en 0 en vez de faltar, que es lo que el reparto necesita.
   */
  async cargaPorMesonero(
    waiterIds: string[],
    instante: Date = new Date(),
  ): Promise<CargaDeMesonero[]> {
    const desde = inicioDeJornada(
      instante,
      await this.configs.obtener('operacion'),
    );
    const hasta = sumarJornadas(desde, 1);
    const filas = await this.orderModel
      .aggregate<CargaDeMesonero>(pipelineDeCargaPorMesonero(desde, hasta))
      .exec();
    return completarConCeros(filas, waiterIds);
  }

  async findById(id: string) {
    const order = await this.orderModel.findOne({ _id: id }).lean().exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return { ...order, id: order._id };
  }

  // Marca la comisión como pagada para varias órdenes de una sola vez (nómina).
  // Va por updateMany para no depender del DTO de update (que descarta el campo
  // por whitelist) y para no hacer N PATCH por separado.
  async markCommissionPaid(orderIds: string[], waiterId?: string) {
    if (!orderIds?.length) return { matched: 0, modified: 0 };
    const now = new Date();

    // Órdenes compartidas (waiterShares): marcar SOLO el share del mesonero
    // que se está liquidando; el global comisionPagada solo cuando TODOS los
    // shares quedaron pagados. Sin waiterId (legacy) u órdenes sin shares:
    // comportamiento global de siempre.
    let modified = 0;
    if (waiterId) {
      const shared = await this.orderModel
        .find({
          _id: { $in: orderIds },
          'waiterShares.0': { $exists: true },
        })
        .exec();
      for (const order of shared) {
        const shares = order.waiterShares as unknown as Array<
          Record<string, unknown>
        >;
        const own = shares.find((s) => s.waiterId === waiterId);
        if (!own || own.comisionPagada === true) continue;
        own.comisionPagada = true;
        own.comisionPagadaAt = now;
        const allPaid = shares.every((s) => s.comisionPagada === true);
        if (allPaid) {
          order.comisionPagada = true;
          order.comisionPagadaAt = now;
        }
        order.markModified('waiterShares');
        await order.save();
        modified++;
      }
      const sharedIds = new Set(shared.map((o) => String(o._id)));
      orderIds = orderIds.filter((id) => !sharedIds.has(id));
    }

    if (orderIds.length) {
      const res = await this.orderModel.updateMany(
        { _id: { $in: orderIds } },
        { comisionPagada: true, comisionPagadaAt: now },
      );
      modified += (res as any).modifiedCount ?? 0;
    }
    return { matched: modified, modified };
  }

  async update(id: string, updateOrderDto: UpdateOrderDto, user?: AuthUser) {
    await this.assertWaiterOwnership(id, user);
    // Bloquear fraudes: si vienen pendingPayments, ninguna referencia
    // (ni partes concatenadas) puede estar ya usada en otra orden.
    await this.assertPendingRefsAreUnique(
      (updateOrderDto as any).pendingPayments,
      id,
    );
    // Items previos para auditar eliminaciones/reducciones de este PATCH
    // (+ serviceCharge actual para renormalizar totales server-side)
    let previousItems: Array<Record<string, unknown>> | null = null;
    let currentOrden: OrdenParaTotales | null = null;
    let currentCustomerId: string | null = null;
    let editAuth: { id: string | null; name: string | null } | null = null;
    if (updateOrderDto.items) {
      const currentForItems = await this.orderModel
        .findOne(
          { _id: id },
          {
            items: 1,
            serviceCharge: 1,
            cancelledItems: 1,
            customerId: 1,
            waiterId: 1,
            tasaServicio: 1,
            modoServicio: 1,
            tasaIva: 1,
            ivaIncluido: 1,
            configAplicada: 1,
          },
        )
        .lean()
        .exec();
      previousItems =
        (currentForItems?.items as Array<Record<string, unknown>>) ?? [];
      currentOrden = currentForItems as unknown as OrdenParaTotales | null;
      currentCustomerId =
        (currentForItems as { customerId?: string | null } | null)
          ?.customerId ?? null;

      // ── CANDADO ANTI-FRAUDE ──
      // Eliminar o reducir unidades YA COMANDADAS (sentQty > 0) exige PIN de
      // admin/manager + motivo (caso tobos jul-2026). Correcciones de items aun
      // no enviados a cocina/barra siguen libres. Cada baja autorizada queda
      // ademas como soft-delete visible (cancelledItems) + evento ITEM_CANCELLED.
      const lockedRemovals = this.computeSentRemovals(
        previousItems,
        updateOrderDto.items as unknown as Array<Record<string, unknown>>,
        await this.registroDePacks(),
      );
      if (lockedRemovals.length > 0) {
        const pin = (updateOrderDto.editPin ?? '').trim();
        const reason = (updateOrderDto.editReason ?? '').trim();
        if (!pin || !reason) {
          // 428 Precondition Required — el cliente debe pedir PIN + motivo
          throw new HttpException(
            {
              code: 'EDIT_PIN_REQUIRED',
              message:
                'Eliminar o reducir productos ya comandados requiere PIN de admin/manager y un motivo.',
              lockedItems: lockedRemovals.map((r) => ({
                name: r.name,
                qty: r.qty,
              })),
            },
            428,
          );
        }
        const pinCheck = await this.authService.verifyAdminPin(pin);
        if (!pinCheck.valid) {
          throw new HttpException(
            { code: 'EDIT_PIN_INVALID', message: 'PIN invalido' },
            428,
          );
        }
        editAuth = {
          id: pinCheck.adminId ?? null,
          name: pinCheck.adminName ?? null,
        };
        const now = new Date();
        const previousCancelled =
          ((currentForItems as any)?.cancelledItems as Array<
            Record<string, unknown>
          >) ?? [];
        (updateOrderDto as any).cancelledItems = [
          ...previousCancelled,
          ...lockedRemovals.map((r) => ({
            productId: r.productId,
            name: r.name,
            qty: r.qty,
            unitPrice: r.unitPrice ?? 0,
            total: r.qty * (r.unitPrice ?? 0),
            station: r.station ?? null,
            reason,
            authorizedById: editAuth?.id ?? null,
            authorizedByName: editAuth?.name ?? null,
            actorId: user?.id ?? null,
            cancelledAt: now,
          })),
        ];
      }
      // Nunca persistir el PIN en la orden
      delete (updateOrderDto as any).editPin;
    }
    const lockReason = (updateOrderDto.editReason ?? '').trim() || null;
    delete (updateOrderDto as any).editReason;
    // Si hay traspaso (tableId cambia), reservamos la mesa destino
    // ATOMICAMENTE y solo si queda la operacion libramos la mesa origen.
    let previousTableId: string | null = null;
    if (updateOrderDto.tableId) {
      const current = await this.orderModel
        .findOne({ _id: id }, { tableId: 1 })
        .lean()
        .exec();
      const isTransfer =
        !!current && current.tableId !== updateOrderDto.tableId;

      if (isTransfer) {
        previousTableId = current?.tableId ?? null;
        const claimed = await this.tableModel
          .findOneAndUpdate(
            {
              _id: updateOrderDto.tableId,
              isAvailable: true,
              status: { $ne: TableStatusEnum.OCCUPIED },
            },
            {
              status: TableStatusEnum.OCCUPIED,
              isAvailable: false,
              orderId: id,
            },
            { new: true },
          )
          .lean();

        if (!claimed) {
          const conflicting = await this.orderModel
            .findOne({
              _id: { $ne: id },
              tableId: updateOrderDto.tableId,
              status: {
                $in: [
                  OrderStatusEnum.PENDING,
                  OrderStatusEnum.IN_PROGRESS,
                  OrderStatusEnum.READY,
                ],
              },
              isDeleted: { $ne: true },
            })
            .lean()
            .exec();
          if (conflicting) {
            const shortId = String(conflicting._id).slice(-8).toUpperCase();
            throw new BadRequestException(
              `La mesa destino ya tiene una orden activa (#${shortId}, estado ${conflicting.status}). ` +
                `No se puede traspasar a una mesa ocupada.`,
            );
          }
          throw new BadRequestException(
            'La mesa destino acaba de ser ocupada por otro usuario.',
          );
        }
        this.posGateway.notifyTableUpdated({ ...claimed, id: claimed._id });
      }
    }

    const patchPayload: any = { ...updateOrderDto, updatedAt: new Date() };
    if (patchPayload.items?.length) {
      patchPayload.items = await this.resolveItemNames(patchPayload.items);

      // ── Preservación de estado por item (bug 18/07/2026) ──
      // Clientes que reescriben items omitiendo campos de estado (sentQty,
      // deliveredQty, cortesías, cancelaciones, quantityLog) los borraban:
      // la web veía todo "pendiente por imprimir". Si el patch no trae el
      // campo, se hereda del item previo (match por productId, consumiendo
      // duplicados en orden).
      if (previousItems?.length) {
        // Hereda el estado por item (incluido inventoryConsumedQty) cuando el
        // cliente reescribe el array completo. Extraído a un helper puro/estático
        // (ver ITEM_STATE_FIELDS / inheritItemState) para poder testearlo.
        patchPayload.items = inheritItemState(
          patchPayload.items as Array<Record<string, unknown>>,
          previousItems as Array<Record<string, unknown>>,
        );
      }

      // ── sentQty por defecto = quantity (reimpresión fantasma, 09/08/2026) ──
      // Un item NUEVO (que no existía en la orden) llega sin sentQty: el bloque
      // de arriba solo hereda estado de items PREVIOS, así que un producto nuevo
      // queda con sentQty undefined. La web POS lo lee como "no enviado"
      // (quantity > (sentQty ?? 0)) y reimprime en cocina lo que ya se despachó.
      // Como su comanda ya se encola al agregarlo, nace enviado → sentQty =
      // quantity. Se aplica SOLO si falta, sin pisar un sentQty ya existente.
      // Guard server-side: cubre a todos los clientes (incluidos APKs viejos).
      patchPayload.items = (
        patchPayload.items as Array<Record<string, unknown>>
      ).map((item) => {
        if (item.sentQty === undefined || item.sentQty === null) {
          const qty = typeof item.quantity === 'number' ? item.quantity : 0;
          return { ...item, sentQty: qty };
        }
        return item;
      });

      // ── Normalización de dinero SERVER-SIDE (bug 18/07/2026) ──
      // Un cliente mergeó cantidades sin recalcular el total del item
      // (11 tequeños cobrados al precio de 1). El servidor es la única
      // fuente de verdad: total del item SIEMPRE = unitPrice × quantity.
      patchPayload.items = normalizeItemsMoney(patchPayload.items);
      // Los packs (tobos, cajas) se venden enteros y su precio NO es
      // unitPrice x unidades. Va despues de normalizeItemsMoney para pisar
      // ese calculo en esas lineas.
      patchPayload.items = await this.normalizePackLines(patchPayload.items);

      // ── Un solo modelo de dinero ──
      // La orden recalcula con SUS tarifas (las que guardó al nacer), no con las
      // vigentes. Quien atiende es el waiterId que quedará tras el PATCH.
      const config = configDeOrden(currentOrden);
      const waiterFinal =
        'waiterId' in patchPayload
          ? patchPayload.waiterId
          : currentOrden?.waiterId;
      const totales = computeOrderTotals(
        patchPayload.items as Array<Record<string, unknown>>,
        Boolean(waiterFinal),
        config.tarifas,
        config.nomina,
      );
      for (const diff of diferenciasConCliente(updateOrderDto, totales)) {
        this.logger.warn(
          `[orders] PATCH ${id}: el cliente calculo distinto (${diff}); se guarda el del servidor`,
        );
      }
      Object.assign(patchPayload, camposDeTotales(totales, config));
      // Base de comision del mesonero: excluye cortesias y el consumo de socios
      // (dueños). serviceCharge (lo que paga el cliente) queda intacto.
      patchPayload.comisionBase = await this.ajustarComisionBasePorSocio(
        (patchPayload.customerId as string | null | undefined) ??
          currentCustomerId,
        totales.comisionBase,
      );
    }
    // UpdateOrderDto extiende PartialType(CreateOrderDto), asi que un PATCH
    // puede reasignar el mesonero. Si trae waiterId, el nombre lo vuelve a
    // derivar el servidor en vez de creerle al cliente.
    if (typeof patchPayload.waiterId === 'string' && patchPayload.waiterId) {
      const nombre = await this.nombreDelMesonero(patchPayload.waiterId);
      if (nombre) {
        patchPayload.waiterName = nombre;
      }
    }

    const order = await this.orderModel
      .findOneAndUpdate({ _id: id }, patchPayload, { new: true })
      .lean()
      .exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Auditoria: productos eliminados o reducidos en este PATCH quedan como
    // ITEM_CANCELLED (append-only). No bloquea el update.
    if (previousItems && updateOrderDto.items) {
      this.recordItemRemovals(
        id,
        previousItems,
        (order.items as unknown as Array<Record<string, unknown>>) ?? [],
        user,
        { reason: lockReason, auth: editAuth },
      );
    }

    // ── Descuento en vivo de lo que se entregó EN ESTE PATCH ──
    // El POS web marca la entrega reescribiendo los items por aquí, no por
    // deliverItem/deliverStation/ficha, así que su stock no se movía hasta el
    // pago. Se descuenta el DELTA de esta petición (no el acumulado) para no
    // consumir de golpe el histórico de una orden vieja que se edite.
    // Va ANTES de processInventoryIfPaid: ese relee la orden y solo consume el
    // restante (quantity − inventoryConsumedQty), así que el orden evita el
    // doble descuento. consumeInventoryOnDelivery es idempotente y no lanza.
    if (previousItems && updateOrderDto.items) {
      const moves = deliveryDeltas(
        previousItems as Array<Record<string, unknown>>,
        (order.items as unknown as Array<Record<string, unknown>>) ?? [],
      );
      if (moves.length) {
        await this.consumeInventoryOnDelivery(id, moves, user as AuthUser);
      }
    }

    // Auto-crear factura si la orden quedo PAID (idempotente)
    await this.ensureInvoiceForPaidOrder(order);
    // Liberar la mesa si la orden quedó pagada (red de seguridad)
    await this.releaseTableIfPaid(order);
    // Descuento de inventario por recetas (idempotente, fire-and-forget)
    void this.processInventoryIfPaid(order);

    // Si llegaron pendingPayments con fotos, disparar OCR en background
    // (no bloquea respuesta al mesonero — el resultado se persiste cuando
    //  termina y se notifica via WS al cajero).
    if ((updateOrderDto as any).pendingPayments?.length) {
      this.kickOffOcrInBackground(String(order._id));
    }

    // Si llegaron pendingPayments con PAGO_MOVIL, reservar la referencia
    // atomicamente y lanzar verificacion bancaria en background.
    const hasPagoMovil = ((updateOrderDto as any).pendingPayments || []).some(
      (pp: any) => pp.method === 'PAGO_MOVIL' && pp.reference,
    );
    if (hasPagoMovil) {
      this.pagoMovilService.reserveAndAutoVerify(order).catch((err) => {
        console.error(
          '[Orders] pagoMovil autoVerify error:',
          (err as Error)?.message,
        );
      });
    }

    // Si fue traspaso, liberar la mesa origen (solo si esta orden era su
    // dueño actual — evita pisar cambios de otra orden).
    if (previousTableId) {
      const released = await this.tableModel
        .findOneAndUpdate(
          { _id: previousTableId, orderId: id },
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
    }

    const result = { ...order, id: order._id };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  // Timeline de auditoria de una orden (para "Historial de cambios" en el POS)
  async getItemEvents(orderId: string) {
    return this.itemEvents.findByOrder(orderId);
  }

  // Entregas de un actor (barman/cocinero) en un rango — resumen diario
  async getDeliveriesByActor(actorId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.itemEvents.findDeliveredByActor(
      actorId,
      fromDate && !isNaN(fromDate.getTime()) ? fromDate : undefined,
      toDate && !isNaN(toDate.getTime()) ? toDate : undefined,
    );
  }

  // Historico de despachos de una ESTACION en un rango, enriquecido con "a
  // quien" (mesonero + mesa/zona de la orden) y quien lo despacho (actor).
  async getStationDispatchLog(station: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const events = await this.itemEvents.findDeliveredByStation(
      station,
      fromDate && !isNaN(fromDate.getTime()) ? fromDate : undefined,
      toDate && !isNaN(toDate.getTime()) ? toDate : undefined,
    );
    if (!events.length) return [];

    // Traer mesonero/mesa de las ordenes involucradas en una sola consulta.
    const orderIds = [...new Set(events.map((e) => String(e.orderId)))];
    const orders = await this.orderModel
      .find(
        { _id: { $in: orderIds } },
        { waiterName: 1, tableName: 1, sector: 1, orderNumber: 1 },
      )
      .lean()
      .exec();
    const byId = new Map(orders.map((o) => [String(o._id), o]));

    return events.map((e) => {
      const o = byId.get(String(e.orderId));
      return {
        occurredAt: e.occurredAt,
        productName: e.productName ?? '',
        qty: e.qty,
        station: e.station ?? station.toUpperCase(),
        actorName: e.actorName ?? '',
        orderId: String(e.orderId),
        orderNumber:
          o?.orderNumber ?? String(e.orderId).slice(-8).toUpperCase(),
        waiterName: o?.waiterName ?? null,
        tableName: o?.tableName ?? o?.sector ?? null,
      };
    });
  }

  // El candado de unidades ya comandadas vive en compute-sent-removals.util.ts
  // (funcion pura, con su spec). Aca solo se delega para no tocar los
  // llamadores internos.
  private computeSentRemovals(
    oldItems: Array<Record<string, unknown>>,
    newItems: Array<Record<string, unknown>>,
    registro: RegistroPacks,
  ): SentRemoval[] {
    return computeSentRemovals(oldItems, newItems, registro);
  }

  private recordItemRemovals(
    orderId: string,
    oldItems: Array<Record<string, unknown>>,
    newItems: Array<Record<string, unknown>>,
    user: AuthUser,
    authorized?: {
      reason: string | null;
      auth: { id: string | null; name: string | null } | null;
    },
  ): void {
    const qtyAfter = new Map<string, number>();
    for (const item of newItems) {
      const pid = String(item.productId ?? '');
      if (!pid) continue;
      qtyAfter.set(
        pid,
        (qtyAfter.get(pid) ?? 0) + (Number(item.quantity) || 0),
      );
    }

    const qtyBefore = new Map<
      string,
      { qty: number; sample: Record<string, unknown> }
    >();
    for (const item of oldItems) {
      const pid = String(item.productId ?? '');
      if (!pid) continue;
      const prev = qtyBefore.get(pid);
      qtyBefore.set(pid, {
        qty: (prev?.qty ?? 0) + (Number(item.quantity) || 0),
        sample: prev?.sample ?? item,
      });
    }

    const events: Parameters<typeof this.itemEvents.recordMany>[0] = [];
    for (const [productId, { qty: before, sample }] of qtyBefore) {
      const after = qtyAfter.get(productId) ?? 0;
      if (after >= before) continue;
      const baseReason =
        after === 0
          ? `Producto eliminado en edicion de orden (${before} -> 0)`
          : `Cantidad reducida en edicion de orden (${before} -> ${after})`;
      events.push({
        orderId,
        itemId: String(sample._id ?? productId),
        productId,
        productName: String(sample.productName ?? sample.name ?? ''),
        eventType: 'ITEM_CANCELLED',
        qty: before - after,
        station: sample.station ? String(sample.station) : undefined,
        reason: authorized?.reason
          ? `${baseReason} — Motivo: ${authorized.reason}`
          : baseReason,
        actorId: user?.id ?? 'anon',
        actorName: user?.name,
        actorRole: toActorRole(user?.role),
        pinValidated: !!authorized?.auth,
        pinValidatedByUserId: authorized?.auth?.id ?? undefined,
        pinValidatedByUserName: authorized?.auth?.name ?? undefined,
      });
    }

    if (events.length > 0) {
      void this.itemEvents.recordMany(events);
    }
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateOrderStatusDto,
    user?: AuthUser,
  ) {
    await this.assertWaiterOwnership(id, user);
    const order = await this.orderModel
      .findOneAndUpdate(
        { _id: id },
        { status: updateStatusDto.status, updatedAt: new Date() },
        { new: true },
      )
      .lean()
      .exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    // Auto-crear factura si quedo PAID
    await this.ensureInvoiceForPaidOrder(order);
    // Liberar la mesa si la orden quedó pagada (red de seguridad)
    await this.releaseTableIfPaid(order);
    // Descuento de inventario por recetas (idempotente, fire-and-forget)
    void this.processInventoryIfPaid(order);
    const result = { ...order, id: order._id };
    this.posGateway.notifyOrderUpdated(result);
    // Aviso push al cliente vinculado si el pedido paso a preparacion / listo.
    this.kitchenNotifier.notifyCustomerStatus({
      orderId: String(order._id),
      customerId: (order as { customerId?: string | null }).customerId ?? null,
      status: updateStatusDto.status as OrderStatusEnum,
      tableName: (order as { tableName?: string | null }).tableName ?? null,
      sector: (order as { sector?: string | null }).sector ?? null,
    });
    return result;
  }

  async addItem(id: string, addItemDto: OrderItemDto, user?: AuthUser) {
    await this.assertWaiterOwnership(id, user);
    const order = await this.orderModel.findOne({ _id: id }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Normalizar dinero del item entrante (total = unitPrice × quantity)
    const [normalizedItem] = normalizeItemsMoney([
      addItemDto as unknown as Record<string, unknown>,
    ]);
    order.items.push({
      ...normalizedItem,
      addedAt: new Date(),
    } as any);

    // Recalcular con el modelo canónico (respeta cortesías y cancelados —
    // el recálculo anterior sumaba items cancelados y no restaba noCharge)
    await this.recomputeOrderTotals(order);

    await order.save();

    // Auditoria — registrar ITEM_ADDED. El _id del subdoc lo asigna mongoose
    // tras el save, asi que leemos el ultimo item del array.
    const addedItem = order.items[order.items.length - 1] as any;
    if (addedItem && user) {
      void this.itemEvents.record({
        orderId: id,
        itemId: String(addedItem._id),
        productId: addedItem.productId,
        productName: addedItem.name,
        eventType: 'ITEM_ADDED',
        qty: addedItem.quantity ?? 1,
        station: addedItem.station,
        actorId: user.id,
        actorName: user.name,
        actorRole: toActorRole(user.role),
      });
    }

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  async removeItem(id: string, itemIndex: number, user?: AuthUser) {
    await this.assertWaiterOwnership(id, user);
    const order = await this.orderModel.findOne({ _id: id }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (itemIndex < 0 || itemIndex >= order.items.length) {
      throw new BadRequestException('Invalid item index');
    }

    // Capturar el item ANTES del splice para poder loggear el evento despues
    // del save con sus datos originales (productId, name, qty, deliveredQty).
    const removedItem = order.items[itemIndex] as any;

    order.items.splice(itemIndex, 1);

    // Un solo modelo de dinero: este bloque sumaba TODOS los items (incluidos
    // los cancelados) y no restaba ni cortesias ni descuentos, asi que borrar
    // una linea reintroducia lo condonado. recomputeOrderTotals usa
    // computeOrderTotals, que es el modelo canonico y probado.
    if (order.serviceCharge === undefined) {
      order.serviceCharge = 0;
    }
    await this.recomputeOrderTotals(order);

    await order.save();

    // Auditoria — el endpoint actual hace eliminacion fisica (splice). En
    // Fase 2 vamos a tener un endpoint /cancel que hace borrado logico con
    // PIN si deliveredQty > 0. Por ahora, solo loggeamos el evento para no
    // romper el flujo existente.
    if (removedItem && user) {
      void this.itemEvents.record({
        orderId: id,
        itemId: String(removedItem._id),
        productId: removedItem.productId,
        productName: removedItem.name,
        eventType: 'ITEM_CANCELLED',
        qty: removedItem.quantity ?? 1,
        previousDeliveredQty: removedItem.deliveredQty ?? 0,
        station: removedItem.station,
        reason: 'removeItem endpoint (legacy, sin razon explicita)',
        actorId: user.id,
        actorName: user.name,
        actorRole: toActorRole(user.role),
      });
    }

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Conversion a pack (tobo / media caja / caja)
  //
  //  Regla del dueño (20/09/2026): CONVERTIR ES UNA OPCION, NO UNA
  //  OBLIGACION. El GET ofrece y no escribe nada; aplicar es una llamada
  //  aparte con el pack elegido y cuantos. El servidor es el unico que pone
  //  el precio, y lo saca del catalogo.
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Precio de catalogo de los packs a los que PODRIAN convertirse estos items.
   *
   * Una sola consulta. Si un pack no tiene precio (o esta en 0) no entra al
   * mapa y el util no lo ofrece: mejor no ofrecer que ofrecer a $0.
   */
  private async preciosDePacksCandidatos(
    items: Array<Record<string, unknown>>,
  ): Promise<Record<string, number>> {
    const registro = await this.registroDePacks();
    const candidatos = new Set<string>();
    for (const it of items ?? []) {
      for (const packId of packsParaProducto(
        registro,
        String(it.productId ?? ''),
      )) {
        candidatos.add(packId);
      }
    }
    if (candidatos.size === 0) return {};

    const productos = await this.productModel
      .find({ _id: { $in: Array.from(candidatos) } }, { price: 1 })
      .lean()
      .exec();

    const precios: Record<string, number> = {};
    for (const p of productos) {
      precios[String(p._id)] = Number(p.price ?? 0);
    }
    return precios;
  }

  /**
   * Que conversiones tiene disponibles esta orden. **No modifica nada.**
   *
   * Un GET que convirtiera seria exactamente la obligacion que el dueño
   * rechazo. Por eso lee con `lean()` y no hay una sola escritura aca.
   */
  async getOpcionesDeConversion(
    id: string,
  ): Promise<{ opciones: OpcionConversion[] }> {
    const order = await this.orderModel
      .findOne({ _id: id }, { items: 1 })
      .lean()
      .exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const items = (order.items ?? []) as unknown as ItemOrden[];
    const precios = await this.preciosDePacksCandidatos(
      items as Array<Record<string, unknown>>,
    );

    const registro = await this.registroDePacks();
    return { opciones: opcionesDeConversion(items, precios, registro) };
  }

  /**
   * Aplica UNA conversion que la persona eligio.
   *
   * Las opciones se recalculan aca desde la base: lo que el cliente crea que
   * hay no decide nada, y el precio sale del catalogo aunque el cliente mande
   * otro. Items, totales y nota de sistema se guardan en un solo `save()`,
   * para que no pueda quedar una orden convertida sin su rastro.
   */
  async convertirPack(
    id: string,
    eleccion: {
      sourceProductId: string;
      targetPackId: string;
      packsToConvert: number;
    },
    user?: AuthUser,
  ) {
    await this.assertWaiterOwnership(id, user);

    const order = await this.orderModel.findOne({ _id: id }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const items = order.items as unknown as ItemOrden[];
    const precios = await this.preciosDePacksCandidatos(
      items as Array<Record<string, unknown>>,
    );

    const registro = await this.registroDePacks();
    const disponible = opcionesDeConversion(items, precios, registro).find(
      (o) =>
        o.sourceProductId === eleccion.sourceProductId &&
        o.targetPackId === eleccion.targetPackId,
    );

    if (!disponible) {
      throw new BadRequestException(
        'Esa conversion no esta disponible para esta orden. ' +
          'Puede que las unidades ya no esten entregadas o que el pack no tenga precio.',
      );
    }

    if (eleccion.packsToConvert > disponible.numPacksPossible) {
      throw new BadRequestException(
        `Solo se pueden armar ${disponible.numPacksPossible} ${disponible.packName} ` +
          `con ${disponible.currentDeliveredQty} unidades entregadas`,
      );
    }

    let resultado;
    try {
      resultado = aplicarConversion(
        items,
        eleccion,
        // El precio del catalogo, NUNCA el que mande el cliente.
        disponible.packPrice,
        registro,
      );
    } catch (error: unknown) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo convertir',
      );
    }

    order.items = resultado.items as unknown as typeof order.items;

    const notas = order as unknown as { additionalNotes?: unknown[] };
    notas.additionalNotes = [
      ...(notas.additionalNotes ?? []),
      {
        text: resultado.nota,
        createdAt: new Date(),
        authorId: user?.id,
        authorName: user?.name,
        system: true,
      },
    ];

    await this.recomputeOrderTotals(order);
    await order.save();

    this.logger.log(
      `[packs] orden ${id}: ${resultado.nota} — precio de catalogo $${disponible.packPrice}`,
    );

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  FASE 2 — Acciones atomicas sobre items (deliver / cancel / no-charge)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Recalcula subtotal/serviceCharge/total/noChargeAmount sobre la orden
   * MUTANDO los campos en memoria. NO hace save() — el caller decide cuando.
   *
   * Modelo de calculo (decision del negocio):
   *   subtotal       = Σ items NO cancelados (incluye los noCharge!)
   *   serviceCharge  = subtotal × 0.10  (base de comision al mesonero —
   *                    NO baja con cortesias para que el mesonero no pierda
   *                    plata por decisiones administrativas)
   *   noChargeAmount = Σ items con noCharge:true × precio
   *   total (cliente)= subtotal + serviceCharge − noChargeAmount
   */
  /**
   * Candado de packs (bug 30/07/2026).
   *
   * Un tobo de $11 trae 12 cervezas: en la orden se guarda como 12 unidades a
   * $11/12 para que la barra entregue de a una. El APK, al AGREGAR un segundo
   * tobo a una orden existente, sumaba 1 unidad en vez de 12 -> la linea
   * quedaba en 13 y se cobraban $11.92 por dos tobos de $22.
   *
   * normalizeItemsMoney no lo detecta porque su regla es
   * `total = unitPrice x quantity`, y 13 x 0.9167 "cuadra" perfecto.
   *
   * Solo se aplica a los productos de PACK_REGISTRY. NO se usa el campo
   * `presentationQuantity` del catalogo: lo tienen 439 productos, casi todos
   * platos normales ("Tequeños x8 UND" se vende como UN plato de $5.50), y
   * tratarlos como pack les cambiaria la cantidad de 1 a 8.
   *
   * Se corrige en vez de rechazar para que un APK viejo no deje al mesonero
   * sin poder cobrar en pleno servicio.
   */
  /**
   * Registro de packs (`configs/packs`). Con el módulo `packsAndBuckets` apagado devuelve el
   * vacío: ningún camino de packs/tobos se ejecuta.
   */
  private async registroDePacks(): Promise<RegistroPacks> {
    if (!(await moduloActivo(this.configs, 'packsAndBuckets'))) {
      return REGISTRO_PACKS_VACIO;
    }
    return this.configs.obtenerCrudo('packs', (doc) =>
      normalizarRegistroPacks(doc?.valor),
    );
  }

  private async normalizePackLines(
    items: unknown,
  ): Promise<Array<Record<string, unknown>>> {
    const list = (items as Array<Record<string, unknown>>) ?? [];
    if (list.length === 0) return list;

    const registro = await this.registroDePacks();
    const packIds = list
      .map((it) => String(it.productId ?? ''))
      .filter((id) => getPackConfig(registro, id) !== undefined);
    if (packIds.length === 0) return list;

    const products = await this.productModel
      .find(
        { _id: { $in: Array.from(new Set(packIds)) } },
        { price: 1, name: 1 },
      )
      .lean()
      .exec();
    const priceById = new Map(
      products.map((p) => [String(p._id), Number(p.price ?? 0)]),
    );

    return list.map((it) => {
      const id = String(it.productId ?? '');
      const pack = getPackConfig(registro, id);
      const price = priceById.get(id) ?? 0;
      if (!pack || price <= 0) return it;

      const qty = Number(it.quantity) || 0;
      if (qty <= 0) return it;

      const wholePacks = Math.ceil(qty / pack.totalUnits);
      const fixedQty = wholePacks * pack.totalUnits;
      const total = +(price * wholePacks).toFixed(2);

      if (fixedQty !== qty) {
        this.logger.warn(
          `[packs] ${pack.label}: llegaron ${qty} unidades, que no es multiplo de ` +
            `${pack.totalUnits}. Corregido a ${fixedQty} (${wholePacks} pack/s) y $${total}. ` +
            `Cliente desactualizado enviando packs sin expandir.`,
        );
      }

      return {
        ...it,
        quantity: fixedQty,
        sentQty:
          Number(it.sentQty) > 0
            ? Math.max(Number(it.sentQty), fixedQty)
            : fixedQty,
        unitPrice: +(price / pack.totalUnits).toFixed(2),
        total,
        totalPrice: total,
        presentationQty: pack.totalUnits,
      };
    });
  }

  /**
   * comisionBase final del mesonero. Parte de la base que ya excluye las
   * cortesias (computeOrderTotals) y la pone en 0 si el cliente es un socio
   * excluido (dueño): su consumo no genera comision (decision del dueño
   * 13/09/2026). La PROPINA se conserva aparte (tipAmount) y NO pasa por aca.
   */
  private async ajustarComisionBasePorSocio(
    customerId: string | null | undefined,
    comisionBase: number,
  ): Promise<number> {
    if (!(comisionBase > 0)) return comisionBase;
    return (await this.sociosExcluidos.esExcluido(customerId))
      ? 0
      : comisionBase;
  }

  /** Configuración vigente de tarifas y nómina: solo para órdenes que nacen. */
  private async configVigente(): Promise<ConfigDeCalculo> {
    const [tarifas, nomina] = await Promise.all([
      this.configs.obtener('tarifas'),
      this.configs.obtener('nomina'),
    ]);
    return { tarifas, nomina };
  }

  private async recomputeOrderTotals(order: OrderDocument): Promise<void> {
    // Recalcula con las tarifas que la orden guardó al nacer (ver configDeOrden).
    const config = configDeOrden(order as unknown as OrdenParaTotales);
    const t = computeOrderTotals(
      order.items as unknown as Array<Record<string, unknown>>,
      Boolean(order.waiterId),
      config.tarifas,
      config.nomina,
    );
    Object.assign(order, camposDeTotales(t, config));
    // Base de comision del mesonero: sin cortesias ni consumo de socios. La propina
    // va aparte (tipAmount) y no entra aquí.
    order.comisionBase = await this.ajustarComisionBasePorSocio(
      order.customerId,
      t.comisionBase,
    );
  }

  /**
   * Marca delta unidades de un item como entregadas. Idempotente en el
   * sentido de que un cliente puede retry sin duplicar (cada llamada
   * incrementa exactamente delta — el cliente debe ser cuidadoso, pero el
   * backend valida que no exceda quantity).
   *
   * Atomico: usa $inc con arrayFilters. No hay race condition con otros
   * deliver concurrentes para el mismo item.
   */
  async deliverItem(
    orderId: string,
    itemId: string,
    delta: number,
    user: AuthUser,
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }
    const inc = Math.max(1, Math.floor(delta || 1));

    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    const item = (order.items as any[]).find((it) => String(it._id) === itemId);
    if (!item) {
      throw new NotFoundException(`Item ${itemId} no encontrado en la orden`);
    }
    if (item.cancelledAt) {
      throw new BadRequestException('Item ya cancelado, no se puede entregar');
    }
    const currentDelivered = item.deliveredQty ?? 0;
    if (currentDelivered + inc > item.quantity) {
      throw new BadRequestException(
        `No se pueden entregar ${currentDelivered + inc} unidades, la orden solo tiene ${item.quantity}`,
      );
    }

    // OJO: esto usaba arrayFilters con el itemId string y contra los _id
    // ObjectId de las ordenes reales NO escribia nada (modifiedCount 0 sin
    // error). El incremento por indice si aplica.
    await this.updateItemFieldByIndex(orderId, itemId, 'deliveredQty', {
      inc,
    });

    // Evento de auditoria
    void this.itemEvents.record({
      orderId,
      itemId,
      productId: item.productId,
      productName: item.name,
      eventType: 'ITEM_DELIVERED',
      qty: inc,
      previousDeliveredQty: currentDelivered,
      newDeliveredQty: currentDelivered + inc,
      station: item.station,
      actorId: user.id,
      actorName: user.name,
      actorRole: toActorRole(user.role),
    });

    // Inventario en vivo: lo entregado descuenta al momento.
    await this.consumeInventoryOnDelivery(
      orderId,
      [{ item: item as Record<string, unknown>, delta: inc }],
      user,
    );

    // Releer + emitir WS
    const fresh = await this.orderModel.findOne({ _id: orderId }).lean().exec();
    if (fresh) {
      const result = { ...fresh, id: String(fresh._id) };
      this.posGateway.notifyOrderUpdated(result);
      // Aviso al mesonero (agrupado 20s por orden). No bloquea la entrega.
      this.notifyDelivered(
        result as Record<string, unknown>,
        [{ name: String(item.name ?? 'Producto'), qty: inc }],
        user.id,
      );
      return result;
    }
    return null;
  }

  /**
   * Empuja el aviso "tu comida esta lista" al mesonero. Aislado en su propio
   * metodo con try/catch porque va dentro del flujo de entrega: si el push
   * falla, la comida ya salio y la operacion no puede verse afectada.
   */
  private notifyDelivered(
    order: Record<string, unknown>,
    items: Array<{ name: string; qty: number }>,
    actorId: string,
  ): void {
    try {
      this.kitchenNotifier.itemsDelivered(
        {
          orderId: String(order.id ?? order._id),
          orderNumber: (order.orderNumber as string) ?? null,
          tableName: (order.tableName as string) ?? null,
          sector: (order.sector as string) ?? null,
          customerAlias: (order.customerAlias as string) ?? null,
          customerName: (order.customerName as string) ?? null,
          waiterId: (order.waiterId as string) ?? null,
          waiterShares: order.waiterShares,
        },
        items,
        actorId,
      );
    } catch (err) {
      this.logger.warn(
        `Aviso de cocina no enviado: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Bulk: marca todos los items con cierta station como totalmente entregados.
   * Util para el boton "Listo todo de cocina" / "Listo todo de barra".
   * Solo afecta items NO cancelados con deliveredQty < quantity.
   */
  async deliverStation(orderId: string, station: string, user: AuthUser) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }
    const stationUpper = String(station).toUpperCase();
    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const events: Parameters<typeof this.itemEvents.recordMany>[0] = [];
    const itemInvMoves: Array<{
      item: Record<string, unknown>;
      delta: number;
    }> = [];
    let modified = 0;
    for (const it of order.items as any[]) {
      if (it.cancelledAt) continue;
      if (String(it.station ?? '').toUpperCase() !== stationUpper) continue;
      const delivered = it.deliveredQty ?? 0;
      const pending = (it.quantity ?? 0) - delivered;
      if (pending <= 0) continue;
      it.deliveredQty = it.quantity;
      modified++;
      itemInvMoves.push({
        item: it as Record<string, unknown>,
        delta: pending,
      });
      events.push({
        orderId,
        itemId: String(it._id),
        productId: it.productId,
        productName: it.name,
        eventType: 'ITEM_DELIVERED',
        qty: pending,
        previousDeliveredQty: delivered,
        newDeliveredQty: it.quantity,
        station: it.station,
        actorId: user.id,
        actorName: user.name,
        actorRole: toActorRole(user.role),
      });
    }

    if (modified === 0) {
      return {
        message: 'No hay items pendientes de esta estacion',
        modified: 0,
      };
    }

    await order.save();
    void this.itemEvents.recordMany(events);

    // Inventario en vivo: todo lo que la estacion marco "listo" descuenta ya.
    await this.consumeInventoryOnDelivery(orderId, itemInvMoves, user);

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    this.notifyDelivered(
      result as Record<string, unknown>,
      itemInvMoves.map((m) => ({
        name: String((m.item as { name?: string }).name ?? 'Producto'),
        qty: m.delta,
      })),
      user.id,
    );
    return { ...result, modified };
  }

  // ───────── Fichas de barra (Plan 1: nivel de item) ─────────

  private getFichaSecret(): string {
    return process.env.FICHA_SECRET || 'dev-ficha-secret-change-me';
  }

  // ───────── Vinculo cliente↔orden por QR (Mesa Conectada) ─────────

  private getLinkSecret(): string {
    return (
      process.env.LINK_SECRET ||
      process.env.FICHA_SECRET ||
      'dev-link-secret-change-me'
    );
  }

  /** Token del QR "Conectar cliente". Genera y persiste linkNonce si falta. */
  async getOrCreateLinkToken(orderId: string): Promise<{ token: string }> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.isDeleted) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    let nonce = order.linkNonce;
    if (!nonce) {
      nonce = generateLinkNonce();
      order.linkNonce = nonce;
      await order.save();
    }
    return { token: signLinkToken(orderId, nonce, this.getLinkSecret()) };
  }

  /** Rota el nonce: invalida el QR ya mostrado/capturado. */
  async rotateLinkToken(orderId: string): Promise<{ token: string }> {
    const nonce = generateLinkNonce();
    const order = await this.orderModel
      .findByIdAndUpdate(orderId, { linkNonce: nonce }, { new: true })
      .exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    return { token: signLinkToken(orderId, nonce, this.getLinkSecret()) };
  }

  /**
   * Vincula al cliente autenticado con la orden del mesonero. El server es la
   * autoridad del customerId (nunca se toma del cuerpo). Rechaza QR vencido u
   * orden ya pagada/cancelada.
   */
  async linkCustomer(
    token: string,
    customerId: string,
    customerName?: string,
  ): Promise<OrderDocument> {
    const parsed = verifyLinkToken(token, this.getLinkSecret());
    if (!parsed) throw new BadRequestException('QR invalido');

    const order = await this.orderModel.findById(parsed.orderId).exec();
    if (!order || order.isDeleted) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (order.linkNonce !== parsed.nonce) {
      throw new BadRequestException('QR vencido, pide uno nuevo al mesonero');
    }
    const status = String(order.status).toUpperCase();
    if (
      status === OrderStatusEnum.PAID ||
      status === OrderStatusEnum.CANCELLED
    ) {
      throw new BadRequestException('La cuenta ya no acepta vinculo');
    }

    order.customerId = customerId;
    if (customerName) order.customerName = customerName;
    // Vincular un socio (dueño) debe dejar su comisionBase en 0 antes del
    // cobro: su consumo no genera comision. recomputeOrderTotals lo resuelve.
    await this.recomputeOrderTotals(order);
    await order.save();

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    this.kitchenNotifier.notifyWaiterCustomerJoined({
      orderId: String(order._id),
      waiterId: order.waiterId ?? null,
      customerName: customerName ?? order.customerName ?? 'Un cliente',
      tableName: (obj as { tableName?: string | null }).tableName ?? null,
      sector: order.sector ?? null,
    });
    return order;
  }

  private newRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private assertLinkedCustomer(order: OrderDocument, customerId: string): void {
    if (order.customerId !== customerId) {
      throw new ForbiddenException('No estas vinculado a esta mesa');
    }
    const status = String(order.status).toUpperCase();
    if (
      status === OrderStatusEnum.PAID ||
      status === OrderStatusEnum.CANCELLED
    ) {
      throw new BadRequestException('La cuenta ya esta cerrada');
    }
  }

  /**
   * El cliente vinculado crea una solicitud: producto (a aceptar), llamar al
   * mesonero, o pedir algo (texto). El precio se releera del server al aceptar;
   * aqui solo se valida disponibilidad y cantidad.
   */
  async createCustomerRequest(
    orderId: string,
    customerId: string,
    dto: {
      type: 'PRODUCT' | 'CALL_WAITER' | 'MISC';
      productId?: string;
      quantity?: number;
      note?: string;
    },
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.isDeleted)
      throw new NotFoundException('Orden no encontrada');
    this.assertLinkedCustomer(order, customerId);

    const req: CustomerRequestEntry = {
      id: this.newRequestId(),
      type: dto.type,
      status: 'PENDING',
      createdByCustomerId: customerId,
      createdAt: new Date(),
    };

    if (dto.type === 'PRODUCT') {
      const product = await this.productModel
        .findById(dto.productId, {
          name: 1,
          price: 1,
          station: 1,
          isForSale: 1,
        })
        .lean()
        .exec();
      const check = validateProductRequest(
        { quantity: dto.quantity ?? 0 },
        product as { isForSale?: boolean } | null,
      );
      if (!check.ok) throw new BadRequestException(check.reason);
      req.productId = String(dto.productId);
      req.productName = (product as { name?: string }).name;
      req.quantity = Math.floor(dto.quantity ?? 0);
    } else if (dto.type === 'MISC') {
      req.note = dto.note?.trim() || 'Solicitud';
    }

    (order.customerRequests as CustomerRequestEntry[]).push(req);
    order.markModified('customerRequests');
    await order.save();

    const result = { ...order.toObject(), id: String(order._id) };
    this.posGateway.notifyOrderUpdated(result);
    this.kitchenNotifier.notifyWaiterRequest(
      {
        orderId: String(order._id),
        waiterId: order.waiterId ?? null,
        customerName: order.customerName ?? 'Un cliente',
        tableName: (result as { tableName?: string | null }).tableName ?? null,
        sector: order.sector ?? null,
      },
      req,
    );
    return order;
  }

  /** El staff resuelve una solicitud: aceptar (agrega el item), rechazar, reconocer. */
  async resolveCustomerRequest(
    orderId: string,
    reqId: string,
    userId: string,
    action: 'ACCEPT' | 'REJECT' | 'ACK',
    rejectReason?: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.isDeleted)
      throw new NotFoundException('Orden no encontrada');
    const req = (order.customerRequests as CustomerRequestEntry[]).find(
      (r) => r.id === reqId,
    );
    if (!req) throw new NotFoundException('Solicitud no encontrada');
    if (req.status !== 'PENDING') {
      throw new BadRequestException('La solicitud ya fue resuelta');
    }

    if (action === 'ACCEPT' && req.type === 'PRODUCT') {
      const product = await this.productModel
        .findById(req.productId, { name: 1, price: 1, station: 1 })
        .lean()
        .exec();
      if (!product) throw new BadRequestException('Producto no disponible');
      const [item] = normalizeItemsMoney([
        {
          productId: req.productId,
          name: (product as { name?: string }).name,
          productName: (product as { name?: string }).name,
          quantity: req.quantity,
          unitPrice: Number((product as { price?: number }).price ?? 0),
          station: (product as { station?: string }).station,
        } as unknown as Record<string, unknown>,
      ]);
      (order.items as unknown as Array<Record<string, unknown>>).push({
        ...item,
        addedAt: new Date(),
      });
      await this.recomputeOrderTotals(order);
      req.status = 'ACCEPTED';
    } else if (action === 'REJECT') {
      req.status = 'REJECTED';
      req.rejectReason = rejectReason;
    } else {
      req.status = req.type === 'PRODUCT' ? 'ACCEPTED' : 'ACK';
    }
    req.resolvedByUserId = userId;
    req.resolvedAt = new Date();
    order.markModified('customerRequests');
    await order.save();

    const result = { ...order.toObject(), id: String(order._id) };
    this.posGateway.notifyOrderUpdated(result);
    this.kitchenNotifier.notifyCustomerRequestResolved(
      { orderId: String(order._id), customerId: order.customerId ?? null },
      req,
    );
    return order;
  }

  /** El cliente pide la cuenta: avisa al mesonero/caja. Sin manejo de dinero. */
  async requestBill(
    orderId: string,
    customerId: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.isDeleted)
      throw new NotFoundException('Orden no encontrada');
    this.assertLinkedCustomer(order, customerId);
    order.billRequested = true;
    order.billRequestedAt = new Date();
    await order.save();

    const result = { ...order.toObject(), id: String(order._id) };
    this.posGateway.notifyOrderUpdated(result);
    this.kitchenNotifier.notifyWaiterBillRequested({
      orderId: String(order._id),
      waiterId: order.waiterId ?? null,
      customerName: order.customerName ?? 'Un cliente',
      tableName: (result as { tableName?: string | null }).tableName ?? null,
      sector: order.sector ?? null,
    });
    return order;
  }

  // Genera y persiste el nonce si aun no existe (backfill perezoso de ordenes
  // viejas). Devuelve el nonce vigente.
  private async ensureFichaNonce(order: OrderDocument): Promise<string> {
    if (order.fichaNonce && order.fichaNonce.trim()) return order.fichaNonce;
    const nonce = generateFichaNonce();
    order.fichaNonce = nonce;
    await order.save();
    return nonce;
  }

  // Arma la vista de ficha: solo items de BARRA, no cancelados, con pendiente > 0.
  private buildFichaView(order: OrderDocument, token: string): FichaView {
    const items: FichaItemView[] = [];
    for (const it of order.items as unknown as Array<{
      _id: unknown;
      productId: string;
      name?: string;
      station?: string;
      quantity: number;
      deliveredQty?: number;
      cancelledAt?: Date | null;
      composition?: Array<{
        variantProductId: string;
        variantName: string;
        qty: number;
        deliveredQty?: number;
      }>;
    }>) {
      if (it.cancelledAt) continue;
      const stationUpper = String(it.station ?? '').toUpperCase();
      if (!CONTROLLED_STATIONS.includes(stationUpper)) continue;
      const delivered = it.deliveredQty ?? 0;
      const pending = (it.quantity ?? 0) - delivered;
      if (pending <= 0) continue;
      const composition =
        it.composition && it.composition.length
          ? it.composition.map((c) => ({
              variantProductId: c.variantProductId,
              variantName: c.variantName,
              qty: c.qty,
              deliveredQty: c.deliveredQty ?? 0,
              pendingQty: (c.qty ?? 0) - (c.deliveredQty ?? 0),
            }))
          : undefined;
      items.push({
        itemId: String(it._id),
        productId: it.productId,
        productName: it.name ?? 'Producto',
        station: stationUpper,
        quantity: it.quantity ?? 0,
        deliveredQty: delivered,
        pendingQty: pending,
        composition,
      });
    }
    const createdAt = (order as unknown as { createdAt?: Date }).createdAt;
    return {
      orderId: String(order._id),
      orderNumber:
        order.orderNumber ?? String(order._id).slice(-8).toUpperCase(),
      tableName: order.tableName ?? null,
      sector: order.sector ?? null,
      waiterName: order.waiterName ?? null,
      createdAt: createdAt ? new Date(createdAt).toISOString() : null,
      status: order.status,
      fichaToken: token,
      items,
    };
  }

  // Carga la orden desde un token verificado. Lanza NotFound si la firma no
  // valida, la orden no existe/esta anulada, o el nonce fue revocado.
  private async loadOrderFromToken(token: string): Promise<OrderDocument> {
    const parsed = verifyFichaToken(token, this.getFichaSecret());
    if (!parsed) {
      throw new NotFoundException('Ficha no válida o anulada');
    }
    const order = await this.orderModel.findOne({ _id: parsed.orderId }).exec();
    if (
      !order ||
      order.isDeleted ||
      order.status === OrderStatusEnum.CANCELLED
    ) {
      throw new NotFoundException('Ficha no válida o anulada');
    }
    if (String(order.fichaNonce ?? '') !== parsed.nonce) {
      throw new NotFoundException('Ficha no válida o anulada');
    }
    return order;
  }

  async getFichaByToken(token: string): Promise<FichaView> {
    const order = await this.loadOrderFromToken(token);
    return this.buildFichaView(order, token);
  }

  /**
   * Resuelve una orden reciente por el sufijo que los clientes imprimen como
   * "orderNumber" (los últimos 8 chars del _id en mayúsculas). Los jobs de
   * comanda de las APKs viejas y del POS web NO traen orderId — este sufijo
   * es el único puente para poder reponer la ficha desde el servidor.
   *
   * El match se hace en JS sobre las órdenes de las últimas 48h: una regex de
   * sufijo sobre _id no puede usar índice y escanearía la colección entera.
   */
  async findRecentOrderIdBySuffix(suffix: string): Promise<string | null> {
    const clean = String(suffix ?? '')
      .trim()
      .toLowerCase();
    if (!/^[a-f0-9]{6,24}$/.test(clean)) return null;
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const candidates = await this.orderModel
      .find({ createdAt: { $gte: since } }, { _id: 1 })
      .sort({ createdAt: -1 })
      .limit(3000)
      .lean();
    const hit = candidates.find((c) =>
      String(c._id).toLowerCase().endsWith(clean),
    );
    return hit ? String(hit._id) : null;
  }

  async getFichaByOrderId(orderId: string): Promise<FichaView> {
    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order || order.isDeleted) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    const nonce = await this.ensureFichaNonce(order);
    const token = signFichaToken(
      String(order._id),
      nonce,
      this.getFichaSecret(),
    );
    return this.buildFichaView(order, token);
  }

  // Mueve stock de una variante en el almacén BARRA (deltaQty: − sale / + entra)
  // + registra el movimiento. Un fallo aquí NO tira la entrega (el saldo del
  // item es la fuente de verdad; el stock es derivado y se puede reconciliar).
  private async moveBarVariantStock(
    variantProductId: string,
    deltaQty: number,
    type: 'CONSUMO_VENTA' | 'ANULACION',
    orderId: string,
    user: AuthUser,
  ): Promise<void> {
    // Fichas de barra: con el módulo `barTokens` apagado no hay stock de barra que mover.
    if (!(await moduloActivo(this.configs, 'barTokens'))) return;
    try {
      // El almacén de barra es el default activo del área BARRA (no un ID fijo del código).
      const warehouseId = await this.movements.warehouseIdDeArea('BARRA');
      if (!warehouseId) {
        this.logger.warn(
          `[Ficha] no hay almacén por defecto de BARRA: no se mueve stock de ${variantProductId}`,
        );
        return;
      }
      await this.movements.emit({
        type,
        warehouseId,
        productId: variantProductId,
        qty: deltaQty,
        baseUnit: 'UND',
        unitCost: 0,
        refType: 'order',
        refId: orderId,
        userId: user?.id ?? 'system',
      });
    } catch (err) {
      this.logger.error(
        `[Ficha] fallo mover stock BARRA ${variantProductId} (${deltaQty}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ───────── Inventario en vivo (descuento al entregar) ─────────

  // Activable por .env para poder apagarlo al instante si algo sale mal.
  private inventoryOnDeliveryEnabled(): boolean {
    return process.env.INVENTORY_ON_DELIVERY === '1';
  }

  /**
   * Actualiza un campo numerico de UN item por su INDICE en el array.
   *
   * POR QUE NO arrayFilters: `{ 'i._id': <string> }` contra items cuyo _id es
   * ObjectId (todas las ordenes reales) da modifiedCount 0 SIN error — el
   * filtro no castea y la escritura se pierde en silencio (verificado
   * 02/08/2026 con el driver). El indice no depende del tipo del _id, y los
   * items nunca se reordenan (los cancelados permanecen en el array).
   */
  private async updateItemFieldByIndex(
    orderId: string,
    itemId: string,
    field: 'inventoryConsumedQty' | 'deliveredQty',
    op: { inc: number } | { set: number },
  ): Promise<boolean> {
    const fresh = await this.orderModel
      .findOne({ _id: orderId }, { items: 1 })
      .lean();
    if (!fresh) return false;
    const idx = ((fresh.items ?? []) as Array<{ _id?: unknown }>).findIndex(
      (it) => String(it._id) === String(itemId),
    );
    if (idx < 0) {
      this.logger.error(
        `[Items] item ${itemId} no encontrado en la orden ${orderId} al escribir ${field}`,
      );
      return false;
    }
    const path = `items.${idx}.${field}`;
    const res = await this.orderModel.updateOne(
      { _id: orderId },
      'inc' in op ? { $inc: { [path]: op.inc } } : { $set: { [path]: op.set } },
    );
    if (res.modifiedCount !== 1) {
      this.logger.error(
        `[Items] escritura de ${field} NO aplico (orden ${orderId}, item ${itemId})`,
      );
    }
    return res.modifiedCount === 1;
  }

  /**
   * Reserva ATÓMICAMENTE lo que se va a consumir de un item, y devuelve cuánto
   * se pudo reservar de verdad.
   *
   * Sin esto el descuento era leer-y-escribir: dos peticiones simultáneas (el
   * doble clic del mesonero, o el POS y el teléfono a la vez) leían ambas
   * `inventoryConsumedQty = 0` y descontaban las dos. Verificado el 04/09: una
   * orden de 3 cervezas descontó 6.
   *
   * MongoDB aquí es standalone, sin transacciones, así que la única garantía
   * es un update condicionado: solo incrementa si el contador sigue en el valor
   * que se leyó. Si otro ganó la carrera, se relee y se recalcula — el segundo
   * verá que ya no queda nada por consumir y reservará 0.
   */
  private async reservarConsumo(
    orderId: string,
    itemId: string,
    deseado: number,
  ): Promise<number> {
    for (let intento = 0; intento < 3; intento += 1) {
      const fresh = await this.orderModel
        .findOne({ _id: orderId }, { items: 1 })
        .lean();
      if (!fresh) return 0;
      const items = (fresh.items ?? []) as Array<Record<string, unknown>>;
      const idx = items.findIndex((it) => String(it._id) === String(itemId));
      if (idx < 0) return 0;

      const item = items[idx];
      const quantity = Number(item.quantity ?? 0);
      const consumido = Number(item.inventoryConsumedQty ?? 0);
      const restante = Math.max(0, quantity - consumido);
      const aReservar =
        deseado > 0
          ? Math.min(deseado, restante)
          : -Math.min(-deseado, consumido);
      if (aReservar === 0) return 0;

      const campo = `items.${idx}.inventoryConsumedQty`;
      // `$in: [consumido, null]` cubre el caso de que el campo no exista aún:
      // en Mongo, null también casa con "ausente".
      const filtro: Record<string, unknown> = {
        _id: orderId,
        [`items.${idx}._id`]: item._id,
        [campo]: consumido === 0 ? { $in: [0, null] } : consumido,
      };
      const res = await this.orderModel.updateOne(filtro, {
        $inc: { [campo]: aReservar },
      });
      if (res.modifiedCount === 1) return aReservar;
      // Otro se adelantó: se vuelve a leer y se recalcula.
    }
    this.logger.warn(
      `[Inventario] no se pudo reservar el consumo del item ${itemId} tras 3 intentos`,
    );
    return 0;
  }

  /**
   * Descuenta (delta positivo) o repone (delta negativo) el inventario de lo
   * que una estación acaba de entregar/devolver, en el momento del escaneo.
   * Objetivo del dueño: que el stock refleje lo que SALE físicamente y se
   * sepa en vivo si hay o no producto.
   *
   * Idempotente por item vía inventoryConsumedQty: nunca consume más allá de
   * item.quantity ni repone por debajo de 0, sin importar el orden
   * pago/entrega (el flujo "Enviar y Cobrar" paga antes de entregar).
   * Los tobos (composition) quedan fuera: ya mueven stock por variante.
   * Nunca lanza: un fallo de inventario no puede tumbar una entrega.
   */
  private async consumeInventoryOnDelivery(
    orderId: string,
    moves: Array<{ item: Record<string, unknown>; delta: number }>,
    user: AuthUser,
  ): Promise<void> {
    if (!this.inventoryOnDeliveryEnabled()) return;
    try {
      const entregas: DeliveredConsumptionEntry[] = [];
      const devoluciones: DeliveredConsumptionEntry[] = [];

      for (const m of moves) {
        const it = m.item;
        const comp = it.composition as unknown[] | undefined;
        if (comp && comp.length) continue; // tobos: stock por variante
        if (it.cancelledAt) continue;
        const itemId = String(it._id);

        // Se RESERVA antes de emitir nada. El orden importa: si primero se
        // emitieran los movimientos y luego se subiera el contador, dos
        // peticiones a la vez descontarían las dos (pasó: 6 cervezas de una
        // orden de 3).
        const reservado = await this.reservarConsumo(orderId, itemId, m.delta);
        if (reservado === 0) continue;

        const destino = reservado > 0 ? entregas : devoluciones;
        destino.push({
          itemId,
          productId: String(it.productId),
          station: (it.station as string) ?? null,
          qty: Math.abs(reservado),
          customizations:
            (it.customizations as
              | { removedIngredients?: string[] }
              | undefined) ?? null,
        });
        // Reflejar en memoria por si llegan varios moves del mismo item.
        it.inventoryConsumedQty =
          Number(it.inventoryConsumedQty ?? 0) + reservado;
      }
      if (entregas.length === 0 && devoluciones.length === 0) return;

      const userId = user?.id ?? 'sistema';
      if (entregas.length > 0) {
        await this.consumptionService.processItemsDelivered(
          orderId,
          entregas,
          userId,
          -1,
          'entrega en vivo (ficha/estacion)',
        );
      }
      if (devoluciones.length > 0) {
        await this.consumptionService.processItemsDelivered(
          orderId,
          devoluciones,
          userId,
          1,
          'devolucion de entrega',
        );
      }
    } catch (err) {
      this.logger.error(
        `[InventarioVivo] fallo consumo orden ${orderId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async deliverByFicha(
    token: string,
    deliveries: FichaDeliveryInput[],
    user: AuthUser,
    station?: string,
    opId?: string,
  ): Promise<FichaView> {
    if (!user) throw new UnauthorizedException('Se requiere autenticacion');
    if (!deliveries?.length) {
      throw new BadRequestException('No hay entregas en la tanda');
    }
    // El admin/gerente entrega de CUALQUIER estacion: es quien cubre cuando
    // falta gente y quien resuelve los enredos. El candado de estacion existe
    // para el personal de barra/cocina/pizza, no para el.
    // Se decide con el rol del token y NO con lo que mande la pantalla: un
    // cliente puede omitir `station`, el rol no se puede falsificar.
    const roleLc = String(user.role || '').toLowerCase();
    const mandaEnTodasLasAreas = roleLc === 'admin' || roleLc === 'manager';
    const stationUpper =
      station && !mandaEnTodasLasAreas ? String(station).toUpperCase() : null;
    const order = await this.loadOrderFromToken(token);

    // Idempotencia: si viene opId y ya está aplicado, devolver la ficha sin cambios.
    if (opId && order.fichaDeliveryOps?.includes(opId)) {
      return this.buildFichaView(order, token);
    }

    const itemsById = new Map<string, Record<string, unknown>>();
    for (const it of order.items as unknown as Array<Record<string, unknown>>) {
      itemsById.set(String(it._id), it);
    }

    type CompEntry = {
      variantProductId: string;
      variantName: string;
      qty: number;
      deliveredQty?: number;
      returnedQty?: number;
    };

    // Fase 1: validar TODO antes de aplicar nada.
    for (const d of deliveries) {
      const it = itemsById.get(d.itemId);
      if (!it) {
        throw new BadRequestException(`Item ${d.itemId} no está en la orden`);
      }
      if (it.cancelledAt) {
        throw new BadRequestException('Item cancelado, no se puede entregar');
      }
      const itStation = String(it.station ?? '').toUpperCase();
      if (!CONTROLLED_STATIONS.includes(itStation)) {
        throw new BadRequestException(
          'Este ítem no se entrega por ficha (estación no controlada)',
        );
      }
      // Blindaje anti-robo: cada estación solo entrega LO SUYO. Si la pantalla
      // manda su estación, se rechaza cualquier ítem de otra.
      if (stationUpper && itStation !== stationUpper) {
        throw new BadRequestException(
          `"${it.name as string}" es de ${itStation}; en ${stationUpper} solo puedes entregar lo de tu estación`,
        );
      }
      const comp = it.composition as CompEntry[] | undefined;
      if (comp && comp.length) {
        if (!d.variantProductId) {
          throw new BadRequestException(
            `El ítem "${it.name as string}" es un tobo mixto: falta la variante`,
          );
        }
        const entry = comp.find(
          (c) => c.variantProductId === d.variantProductId,
        );
        if (!entry) {
          throw new BadRequestException('Variante no encontrada en el tobo');
        }
        const entryDelivered = entry.deliveredQty ?? 0;
        if (entryDelivered + d.delta > entry.qty) {
          throw new BadRequestException(
            `No se pueden entregar ${d.delta} de ${entry.variantName}: pendiente ${entry.qty - entryDelivered}`,
          );
        }
      } else {
        const delivered = (it.deliveredQty as number) ?? 0;
        if (delivered + d.delta > (it.quantity as number)) {
          throw new BadRequestException(
            `No se pueden entregar ${d.delta} de "${it.name as string}": pendiente ${(it.quantity as number) - delivered}`,
          );
        }
      }
    }

    // Fase 2: aplicar en memoria + eventos + un solo save.
    const stockMoves: Array<{ variantProductId: string; delta: number }> = [];
    const itemInvMoves: Array<{
      item: Record<string, unknown>;
      delta: number;
    }> = [];
    // Lo despachado en esta tanda, para avisarle al mesonero al final. En los
    // tobos mixtos se nombra la variante ("Pilsen") y no el tobo, que es lo
    // que el mesonero tiene que ir a buscar a la barra.
    const avisoItems: Array<{ name: string; qty: number }> = [];
    for (const d of deliveries) {
      const it = itemsById.get(d.itemId)!;
      const comp = it.composition as CompEntry[] | undefined;
      if (comp && comp.length) {
        const entry = comp.find(
          (c) => c.variantProductId === d.variantProductId,
        )!;
        const prevEntry = entry.deliveredQty ?? 0;
        entry.deliveredQty = prevEntry + d.delta;
        it.deliveredQty = comp.reduce((s, c) => s + (c.deliveredQty ?? 0), 0);
        stockMoves.push({
          variantProductId: d.variantProductId!,
          delta: d.delta,
        });
        avisoItems.push({ name: entry.variantName, qty: d.delta });
        void this.itemEvents.record({
          orderId: String(order._id),
          itemId: d.itemId,
          productId: entry.variantProductId,
          productName: entry.variantName,
          eventType: 'ITEM_DELIVERED',
          qty: d.delta,
          previousDeliveredQty: prevEntry,
          newDeliveredQty: prevEntry + d.delta,
          station: it.station as string,
          actorId: user.id,
          actorName: user.name,
          actorRole: toActorRole(user.role),
        });
      } else {
        const previous = (it.deliveredQty as number) ?? 0;
        it.deliveredQty = previous + d.delta;
        itemInvMoves.push({ item: it, delta: d.delta });
        avisoItems.push({ name: String(it.name ?? 'Producto'), qty: d.delta });
        void this.itemEvents.record({
          orderId: String(order._id),
          itemId: d.itemId,
          productId: String(it.productId),
          productName: it.name as string,
          eventType: 'ITEM_DELIVERED',
          qty: d.delta,
          previousDeliveredQty: previous,
          newDeliveredQty: previous + d.delta,
          station: it.station as string,
          actorId: user.id,
          actorName: user.name,
          actorRole: toActorRole(user.role),
        });
      }
    }
    order.markModified('items');
    // Idempotencia: registrar opId después de aplicar, en el mismo save.
    if (opId) {
      if (!order.fichaDeliveryOps) {
        order.fichaDeliveryOps = [];
      }
      order.fichaDeliveryOps.push(opId);
    }
    await order.save();

    // Mover inventario BARRA por variante (después de persistir la entrega).
    for (const m of stockMoves) {
      await this.moveBarVariantStock(
        m.variantProductId,
        -m.delta,
        'CONSUMO_VENTA',
        String(order._id),
        user,
      );
    }

    // Inventario en vivo: lo entregado sin variante descuenta aqui (recetas
    // e insumos directos), no al pagar.
    await this.consumeInventoryOnDelivery(
      String(order._id),
      itemInvMoves,
      user,
    );

    const fresh = { ...order.toObject(), id: String(order._id) };
    this.posGateway.notifyOrderUpdated(fresh);
    // Aviso al mesonero. Va aqui y no solo en deliverItem porque ESTA es la
    // ruta que se usa: entre el 04 y el 07/08 hubo 704 entregas por ficha y
    // CERO por deliverItem, asi que el push nunca llego a nadie.
    this.notifyDelivered(fresh as Record<string, unknown>, avisoItems, user.id);
    return this.buildFichaView(order, token);
  }

  async returnByFicha(
    token: string,
    returns: FichaDeliveryInput[],
    user: AuthUser,
    station?: string,
    opId?: string,
  ): Promise<FichaView> {
    if (!user) throw new UnauthorizedException('Se requiere autenticacion');
    // Anti-robo: devolver a pendiente se presta para trampa (entregar, guardar,
    // devolver para que parezca no entregado). Solo admin/gerente pueden.
    const roleLc = String(user.role || '').toLowerCase();
    if (roleLc !== 'admin' && roleLc !== 'manager') {
      throw new ForbiddenException(
        'Solo un administrador o gerente puede registrar devoluciones',
      );
    }
    if (!returns?.length) {
      throw new BadRequestException('No hay devoluciones en la tanda');
    }
    const stationUpper = station ? String(station).toUpperCase() : null;
    const order = await this.loadOrderFromToken(token);

    // Idempotencia: si viene opId y ya esta aplicado, devolver la ficha sin cambios.
    if (opId && order.fichaReturnOps?.includes(opId)) {
      return this.buildFichaView(order, token);
    }

    const itemsById = new Map<string, Record<string, unknown>>();
    for (const it of order.items as unknown as Array<Record<string, unknown>>) {
      itemsById.set(String(it._id), it);
    }

    type CompEntry = {
      variantProductId: string;
      variantName: string;
      qty: number;
      deliveredQty?: number;
      returnedQty?: number;
    };

    for (const r of returns) {
      const it = itemsById.get(r.itemId);
      if (!it)
        throw new BadRequestException(`Item ${r.itemId} no está en la orden`);
      // Blindaje anti-robo: cada estación solo devuelve LO SUYO.
      if (
        stationUpper &&
        String(it.station ?? '').toUpperCase() !== stationUpper
      ) {
        throw new BadRequestException(
          `"${it.name as string}" no es de ${stationUpper}: solo puedes devolver lo de tu estación`,
        );
      }
      const comp = it.composition as CompEntry[] | undefined;
      if (comp && comp.length) {
        if (!r.variantProductId) {
          throw new BadRequestException(
            `El ítem "${it.name as string}" es un tobo mixto: falta la variante`,
          );
        }
        const entry = comp.find(
          (c) => c.variantProductId === r.variantProductId,
        );
        if (!entry) {
          throw new BadRequestException('Variante no encontrada en el tobo');
        }
        const entryDelivered = entry.deliveredQty ?? 0;
        if (r.delta > entryDelivered) {
          throw new BadRequestException(
            `No se pueden devolver ${r.delta} de ${entry.variantName}: entregado ${entryDelivered}`,
          );
        }
      } else {
        const delivered = (it.deliveredQty as number) ?? 0;
        if (r.delta > delivered) {
          throw new BadRequestException(
            `No se pueden devolver ${r.delta} de "${it.name as string}": entregado ${delivered}`,
          );
        }
      }
    }

    const stockMoves: Array<{ variantProductId: string; delta: number }> = [];
    const itemInvMoves: Array<{
      item: Record<string, unknown>;
      delta: number;
    }> = [];
    for (const r of returns) {
      const it = itemsById.get(r.itemId)!;
      const comp = it.composition as CompEntry[] | undefined;
      if (comp && comp.length) {
        const entry = comp.find(
          (c) => c.variantProductId === r.variantProductId,
        )!;
        const prevEntry = entry.deliveredQty ?? 0;
        entry.deliveredQty = prevEntry - r.delta;
        entry.returnedQty = (entry.returnedQty ?? 0) + r.delta;
        it.deliveredQty = comp.reduce((s, c) => s + (c.deliveredQty ?? 0), 0);
        stockMoves.push({
          variantProductId: r.variantProductId!,
          delta: r.delta,
        });
        void this.itemEvents.record({
          orderId: String(order._id),
          itemId: r.itemId,
          productId: entry.variantProductId,
          productName: entry.variantName,
          eventType: 'ITEM_RETURNED',
          qty: r.delta,
          previousDeliveredQty: prevEntry,
          newDeliveredQty: prevEntry - r.delta,
          station: it.station as string,
          actorId: user.id,
          actorName: user.name,
          actorRole: toActorRole(user.role),
        });
      } else {
        const previous = (it.deliveredQty as number) ?? 0;
        it.deliveredQty = previous - r.delta;
        itemInvMoves.push({ item: it, delta: -r.delta });
        void this.itemEvents.record({
          orderId: String(order._id),
          itemId: r.itemId,
          productId: String(it.productId),
          productName: it.name as string,
          eventType: 'ITEM_RETURNED',
          qty: r.delta,
          previousDeliveredQty: previous,
          newDeliveredQty: previous - r.delta,
          station: it.station as string,
          actorId: user.id,
          actorName: user.name,
          actorRole: toActorRole(user.role),
        });
      }
    }
    order.markModified('items');
    // Idempotencia: registrar opId despues de aplicar, en el mismo save.
    if (opId) {
      if (!order.fichaReturnOps) {
        order.fichaReturnOps = [];
      }
      order.fichaReturnOps.push(opId);
    }
    await order.save();

    // Inventario en vivo: reponer el consumo de lo devuelto (sin variante).
    await this.consumeInventoryOnDelivery(
      String(order._id),
      itemInvMoves,
      user,
    );

    for (const m of stockMoves) {
      await this.moveBarVariantStock(
        m.variantProductId,
        m.delta,
        'ANULACION',
        String(order._id),
        user,
      );
    }

    const fresh = { ...order.toObject(), id: String(order._id) };
    this.posGateway.notifyOrderUpdated(fresh);
    return this.buildFichaView(order, token);
  }

  async regenerateFicha(
    orderId: string,
    adminPin: string,
    user: AuthUser,
  ): Promise<{ fichaToken: string }> {
    if (!user) throw new UnauthorizedException('Se requiere autenticacion');
    if (!adminPin || !adminPin.trim()) {
      throw new UnauthorizedException('PIN admin obligatorio');
    }
    const pinCheck = await this.authService.verifyAdminPin(adminPin);
    if (!pinCheck.valid) {
      throw new UnauthorizedException('PIN admin invalido');
    }
    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order || order.isDeleted) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    const nonce = generateFichaNonce();
    order.fichaNonce = nonce;
    await order.save();
    const token = signFichaToken(
      String(order._id),
      nonce,
      this.getFichaSecret(),
    );
    return { fichaToken: token };
  }

  /**
   * Borrado logico de un item — solo permitido si NO se ha entregado nada.
   * Si deliveredQty > 0, el caller debe usar /no-charge en su lugar.
   * Sin PIN. Item permanece en items[] pero se ignora en totales.
   */
  async cancelItem(
    orderId: string,
    itemId: string,
    reason: string,
    user: AuthUser,
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('reason es obligatorio');
    }

    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.paymentStatus === 'paid') {
      throw new BadRequestException(
        'No se pueden cancelar items en una orden ya pagada',
      );
    }

    const item = (order.items as any[]).find((it) => String(it._id) === itemId);
    if (!item) {
      throw new NotFoundException(`Item ${itemId} no encontrado en la orden`);
    }
    if (item.cancelledAt) {
      throw new BadRequestException('Item ya estaba cancelado');
    }
    if ((item.deliveredQty ?? 0) > 0) {
      throw new BadRequestException(
        'Item ya entregado parcialmente — usa /no-charge para aplicar cortesia con PIN',
      );
    }

    // Borrado logico
    item.cancelledAt = new Date();
    item.cancelledBy = user.id;
    item.cancelReason = reason.trim();

    await this.recomputeOrderTotals(order);
    await order.save();

    void this.itemEvents.record({
      orderId,
      itemId,
      productId: item.productId,
      productName: item.name,
      eventType: 'ITEM_CANCELLED',
      qty: item.quantity ?? 1,
      previousDeliveredQty: 0,
      station: item.station,
      reason: reason.trim(),
      actorId: user.id,
      actorName: user.name,
      actorRole: toActorRole(user.role),
    });

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /**
   * Aplica cortesia (no-charge) a un item. Item permanece en factura para
   * inventario y trackeo, pero su precio NO se cobra al cliente. Requiere
   * PIN admin obligatorio (validado contra users con role admin/manager).
   */
  async noChargeItem(
    orderId: string,
    itemId: string,
    reason: string,
    adminPin: string,
    user: AuthUser,
    responsible?: 'COCINA' | 'BARRA' | 'MESONERO' | 'CASA',
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('reason es obligatorio');
    }
    if (!adminPin || !adminPin.trim()) {
      throw new UnauthorizedException(
        'PIN admin obligatorio para aplicar cortesia',
      );
    }

    // Validar PIN contra users con rol admin/manager
    const pinCheck = await this.authService.verifyAdminPin(adminPin);
    if (!pinCheck.valid) {
      throw new UnauthorizedException('PIN admin invalido');
    }

    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.paymentStatus === 'paid') {
      throw new BadRequestException(
        'No se pueden aplicar cortesias a una orden ya pagada',
      );
    }

    const item = (order.items as any[]).find((it) => String(it._id) === itemId);
    if (!item) {
      throw new NotFoundException(`Item ${itemId} no encontrado en la orden`);
    }
    if (item.cancelledAt) {
      throw new BadRequestException(
        'Item cancelado — no se puede aplicar cortesia',
      );
    }
    if (item.noCharge === true) {
      throw new BadRequestException('Item ya marcado como cortesia');
    }

    // Marcar como cortesia (preservando snapshot del estado al momento)
    item.noCharge = true;
    item.noChargeAt = new Date();
    item.noChargeBy = user.id;
    item.noChargeReason = reason.trim();
    item.noChargePinValidatedByUserId = pinCheck.adminId ?? null;
    item.noChargeDeliveredQtyAtTime = item.deliveredQty ?? 0;
    // De quien fue el error. No mueve un centavo (el servicio se sigue
    // cobrando pleno): es para poder medir despues si las cortesias salen de
    // cocina, de barra o de la sala.
    if (responsible) item.noChargeResponsible = responsible;

    await this.recomputeOrderTotals(order);
    await order.save();

    void this.itemEvents.record({
      orderId,
      itemId,
      productId: item.productId,
      productName: item.name,
      eventType: 'ITEM_NO_CHARGE',
      qty: item.quantity ?? 1,
      previousDeliveredQty: item.deliveredQty ?? 0,
      newDeliveredQty: item.deliveredQty ?? 0,
      station: item.station,
      reason: reason.trim(),
      actorId: user.id,
      actorName: user.name,
      actorRole: toActorRole(user.role),
      pinValidated: true,
      pinValidatedByUserId: pinCheck.adminId ?? undefined,
      pinValidatedByUserName: pinCheck.adminName ?? undefined,
    });

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  // ───────── Descuento parcial por producto (PIN admin) ─────────

  /** Tope por defecto si no hay `configs/descuento_maximo` en Mongo. */
  private static readonly DESCUENTO_MAX_PCT = 50;

  /**
   * Tope maximo de descuento, en % de la linea. Vive en Mongo
   * (`configs/descuento_maximo`) para poder moverlo sin redeploy; si no esta
   * o falla la lectura se usa el default, que es el lado seguro (descontar de
   * menos nunca regala plata).
   */
  private async resolverTopeDescuento(): Promise<number> {
    return this.configs.obtenerCrudo('descuento_maximo', (doc) => {
      const valor = doc?.maxPct;
      return typeof valor === 'number' && valor > 0 && valor <= 100
        ? valor
        : OrdersService.DESCUENTO_MAX_PCT;
    });
  }

  /**
   * Localiza el item y valida que la orden admita tocar su dinero. Comun a
   * aplicar y a revertir un descuento.
   */
  private async cargarItemParaDescuento(
    orderId: string,
    itemId: string,
    reason: string,
    adminPin: string,
    user: AuthUser,
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('reason es obligatorio');
    }
    if (!adminPin || !adminPin.trim()) {
      throw new UnauthorizedException(
        'PIN admin obligatorio para aplicar un descuento',
      );
    }

    const pinCheck = await this.authService.verifyAdminPin(adminPin);
    if (!pinCheck.valid) {
      throw new UnauthorizedException('PIN admin invalido');
    }

    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    if (order.paymentStatus === 'paid') {
      throw new BadRequestException(
        'La orden ya esta pagada — no se puede cambiar su precio',
      );
    }

    const item = (
      order.items as unknown as Array<Record<string, unknown>>
    ).find((it) => String(it._id) === itemId);
    if (!item) {
      throw new NotFoundException(`Item ${itemId} no encontrado en la orden`);
    }
    if (item.cancelledAt) {
      throw new BadRequestException('Item cancelado — no admite descuento');
    }

    // Se devuelve `user` ya validado: sin esto TS no propaga el estrechamiento
    // del guard de arriba y cada caller tendria que repetir el chequeo.
    return { order, item, pinCheck, actor: user };
  }

  /**
   * Aplica un descuento a UNA linea de la orden. A diferencia de la cortesia,
   * el descuento baja la base del 10% de servicio: es una rebaja sobre lo que
   * el cliente paga, no una invitacion de la casa.
   */
  async discountItem(
    orderId: string,
    itemId: string,
    dto: DiscountItemDto,
    user: AuthUser,
  ) {
    const { order, item, pinCheck, actor } = await this.cargarItemParaDescuento(
      orderId,
      itemId,
      dto?.reason ?? '',
      dto?.adminPin ?? '',
      user,
    );

    if (item.noCharge === true) {
      throw new BadRequestException(
        'El item ya es cortesia — descontarlo seria rebajarlo dos veces',
      );
    }

    const tope = await this.resolverTopeDescuento();
    let monto: number;
    try {
      monto = calcularMontoDescuento(
        Number(item.total) || 0,
        dto.type,
        Number(dto.value),
        tope,
      );
    } catch (error) {
      if (error instanceof DescuentoInvalidoError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    item.discountType = dto.type;
    item.discountValue = Number(dto.value);
    item.discountAmount = monto;
    item.discountReason = dto.reason.trim();
    item.discountAt = new Date();
    item.discountBy = actor.id;
    item.discountPinValidatedByUserId = pinCheck.adminId ?? null;

    await this.recomputeOrderTotals(order);
    order.markModified('items');
    await order.save();

    void this.itemEvents.record({
      orderId,
      itemId,
      productId: String(item.productId ?? ''),
      productName: String(item.name ?? ''),
      eventType: 'ITEM_DISCOUNT',
      qty: Number(item.quantity) || 1,
      previousDeliveredQty: Number(item.deliveredQty) || 0,
      newDeliveredQty: Number(item.deliveredQty) || 0,
      station: item.station as string | undefined,
      reason: dto.reason.trim(),
      amount: monto,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: toActorRole(actor.role),
      pinValidated: true,
      pinValidatedByUserId: pinCheck.adminId ?? undefined,
      pinValidatedByUserName: pinCheck.adminName ?? undefined,
    });

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /** Quita un descuento mal aplicado. Exige PIN y motivo, y deja rastro. */
  async removeItemDiscount(
    orderId: string,
    itemId: string,
    dto: RemoveItemDiscountDto,
    user: AuthUser,
  ) {
    const { order, item, pinCheck, actor } = await this.cargarItemParaDescuento(
      orderId,
      itemId,
      dto?.reason ?? '',
      dto?.adminPin ?? '',
      user,
    );

    if (!(Number(item.discountAmount) > 0)) {
      throw new BadRequestException('El item no tiene descuento que quitar');
    }

    const previo = Number(item.discountAmount);
    item.discountAmount = 0;
    item.discountType = undefined;
    item.discountValue = undefined;
    item.discountReason = undefined;
    item.discountAt = undefined;
    item.discountBy = undefined;
    item.discountPinValidatedByUserId = undefined;

    await this.recomputeOrderTotals(order);
    order.markModified('items');
    await order.save();

    void this.itemEvents.record({
      orderId,
      itemId,
      productId: String(item.productId ?? ''),
      productName: String(item.name ?? ''),
      eventType: 'ITEM_DISCOUNT_REMOVED',
      qty: Number(item.quantity) || 1,
      previousDeliveredQty: Number(item.deliveredQty) || 0,
      newDeliveredQty: Number(item.deliveredQty) || 0,
      station: item.station as string | undefined,
      reason: dto.reason.trim(),
      amount: previo,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: toActorRole(actor.role),
      pinValidated: true,
      pinValidatedByUserId: pinCheck.adminId ?? undefined,
      pinValidatedByUserName: pinCheck.adminName ?? undefined,
    });

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /**
   * CORTESÍA TOTAL: toda la orden gratis con PIN admin + motivo. El cliente
   * paga $0 (se condona también el 10% de servicio), pero el CAMPO
   * serviceCharge se conserva — es la base de comisión del mesonero, que
   * por decisión del negocio NO pierde plata por cortesías. Cierra la
   * orden (paid), libera la mesa y descuenta inventario (la comida se
   * preparó igual).
   */
  async fullCourtesy(
    orderId: string,
    reason: string,
    adminPin: string,
    user: AuthUser,
    responsible?: 'COCINA' | 'BARRA' | 'MESONERO' | 'CASA',
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('El motivo es obligatorio');
    }
    if (!adminPin || !adminPin.trim()) {
      throw new UnauthorizedException(
        'PIN admin obligatorio para la cortesía total',
      );
    }
    const pinCheck = await this.authService.verifyAdminPin(adminPin);
    if (!pinCheck.valid) {
      throw new UnauthorizedException('PIN admin invalido');
    }

    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    if ((order.paymentStatus ?? '').toLowerCase() === 'paid') {
      throw new BadRequestException(
        'La orden ya está pagada — no aplica cortesía total',
      );
    }
    if (order.status === OrderStatusEnum.CANCELLED) {
      throw new BadRequestException('La orden está cancelada');
    }

    const now = new Date();
    const items = order.items as unknown as Array<Record<string, unknown>>;
    const liveItems = items.filter((it) => !it.cancelledAt);
    if (liveItems.length === 0) {
      throw new BadRequestException('La orden no tiene items activos');
    }

    for (const item of liveItems) {
      if (item.noCharge === true) continue;
      item.noCharge = true;
      item.noChargeAt = now;
      item.noChargeBy = user.id;
      item.noChargeReason = `CORTESÍA TOTAL: ${reason.trim()}`;
      item.noChargePinValidatedByUserId = pinCheck.adminId ?? null;
      item.noChargeDeliveredQtyAtTime = item.deliveredQty ?? 0;
      if (responsible) item.noChargeResponsible = responsible;
    }

    await this.recomputeOrderTotals(order);
    // Cortesía TOTAL: también se condona el servicio → cliente paga $0.
    // noChargeAmount refleja TODO lo condonado (subtotal + servicio) y el
    // campo serviceCharge se mantiene como base de comisión del mesonero.
    (order as any).noChargeAmount = +(
      order.subtotal + (order.serviceCharge ?? 0)
    ).toFixed(2);
    order.total = 0;
    order.paymentStatus = 'paid';
    order.status = OrderStatusEnum.PAID;
    order.notes = order.notes
      ? `${order.notes} | CORTESÍA TOTAL: ${reason.trim()} (autorizó ${pinCheck.adminName ?? 'admin'})`
      : `CORTESÍA TOTAL: ${reason.trim()} (autorizó ${pinCheck.adminName ?? 'admin'})`;

    await order.save();

    // Auditoría por item (mismo evento que la cortesía individual)
    for (const item of liveItems) {
      void this.itemEvents.record({
        orderId,
        itemId: String(item._id),
        productId: item.productId as string,
        productName: item.name as string,
        eventType: 'ITEM_NO_CHARGE',
        qty: (item.quantity as number) ?? 1,
        previousDeliveredQty: (item.deliveredQty as number) ?? 0,
        newDeliveredQty: (item.deliveredQty as number) ?? 0,
        station: item.station as string | undefined,
        reason: `CORTESÍA TOTAL: ${reason.trim()}`,
        actorId: user.id,
        actorName: user.name,
        actorRole: toActorRole(user.role),
        pinValidated: true,
        pinValidatedByUserId: pinCheck.adminId ?? undefined,
        pinValidatedByUserName: pinCheck.adminName ?? undefined,
      });
    }

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };

    // Cierre completo: mesa, factura ($0) e inventario (sí se consumió)
    await this.releaseTableIfPaid(result as any);
    await this.ensureInvoiceForPaidOrder(result);
    void this.processInventoryIfPaid(result as any);

    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /**
   * Borra una orden y DEVUELVE al almacen lo que ya se habia entregado.
   *
   * Antes solo hacia `deleteOne`: el producto entregado se quedaba descontado y
   * el movimiento quedaba huerfano, apuntando a una orden que ya no existe.
   * Medido en produccion el 03/09: 47 movimientos asi, y en la copia local 40
   * mas de agosto. No hay orden, no hay cobro, no hay factura — solo faltan
   * botellas, y en el conteo eso parece robo del personal.
   */
  /**
   * Devuelve al almacen todo lo que una orden llego a consumir.
   *
   * Se apoya en el mismo camino que descuenta (`consumeInventoryOnDelivery`
   * con delta negativo), que ya es idempotente y no repone mas de lo que se
   * consumio: asi la reposicion usa exactamente la misma aritmetica, mermas
   * incluidas, que el descuento.
   */
  private async devolverInventarioDeOrden(
    order: { _id: unknown; items?: unknown },
    user?: AuthUser,
  ): Promise<void> {
    const items = (order.items ?? []) as Array<Record<string, unknown>>;
    const moves = items
      .map((it) => ({
        item: it,
        delta: -Number(it.inventoryConsumedQty ?? 0),
      }))
      .filter((m) => m.delta < 0);
    if (moves.length === 0) return;

    await this.consumeInventoryOnDelivery(
      String(order._id),
      moves,
      user as AuthUser,
    );
    this.logger.warn(
      `[Inventario] orden ${String(order._id)} borrada: se devolvieron ${moves.length} item(s) al almacen`,
    );
  }

  async remove(id: string, user?: AuthUser) {
    await this.assertWaiterOwnership(id, user);
    const order = await this.orderModel.findOne({ _id: id }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Reponer ANTES de borrar: despues ya no se sabria que llevaba la orden.
    await this.devolverInventarioDeOrden(order, user);

    // If tableId exists, free the table
    if (order.tableId) {
      const updatedTable = await this.tableModel
        .findOneAndUpdate(
          { _id: order.tableId },
          {
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
            orderId: null,
          },
          { new: true },
        )
        .lean();
      if (updatedTable) {
        this.posGateway.notifyTableUpdated({
          ...updatedTable,
          id: updatedTable._id,
        });
      }
    }

    await this.orderModel.deleteOne({ _id: id });
    this.posGateway.notifyOrderDeleted(id);
    return { message: 'Order deleted successfully' };
  }

  /**
   * Descarta el pedido que acaba de crear quien lo toma y se arrepiente en la
   * pantalla de cobro (atras sin cobrar). Con la comanda al cobrar, ese pedido no
   * imprimio nada: dejarlo "pendiente" en la lista de ordenes solo estorba.
   *
   * Solo vale mientras la orden sea PURAMENTE un borrador: sin cobro registrado,
   * sin pagos, sin nada impreso ni entregado y sin inventario movido. En cuanto
   * pasa cualquiera de esas cosas, borrarla seria esconder una venta: se rechaza
   * con 409 y la orden se queda como esta. El borrado y la liberacion de la
   * mesa son los de `remove`.
   */
  async descartarSinCobrar(id: string, user?: AuthUser) {
    await this.assertWaiterOwnership(id, user);
    const order = await this.orderModel.findOne({ _id: id }).lean().exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    const estadoDePago = String(order.paymentStatus ?? '').toLowerCase();
    const items = (order.items ?? []) as Array<Record<string, unknown>>;
    const algoSalio = items.some(
      (it) =>
        Number(it.printedQty ?? 0) > 0 ||
        Number(it.deliveredQty ?? 0) > 0 ||
        Number(it.inventoryConsumedQty ?? 0) > 0,
    );
    const pagos = await this.paymentModel.countDocuments({ orderId: id });
    const pagosPendientes = Array.isArray(
      (order as { pendingPayments?: unknown }).pendingPayments,
    )
      ? ((order as { pendingPayments?: unknown[] }).pendingPayments ?? [])
          .length
      : 0;

    if (
      (estadoDePago !== '' && estadoDePago !== 'pending') ||
      pagos > 0 ||
      pagosPendientes > 0 ||
      algoSalio ||
      order.inventoryProcessed
    ) {
      throw new ConflictException(
        'La orden ya tiene cobro o productos despachados: no se puede descartar.',
      );
    }
    return this.remove(id, user);
  }

  async findPendingVerification() {
    const orders = await this.orderModel
      .find({ paymentStatus: 'pending_verification' })
      .lean()
      .exec();
    return orders.map((o: any) => ({ ...o, id: o._id }));
  }

  async addAdditionalNote(
    id: string,
    text: string,
    authorId?: string,
    authorName?: string,
    user?: AuthUser,
    system?: boolean,
  ) {
    await this.assertWaiterOwnership(id, user);
    const trimmed = (text ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('La nota no puede estar vacia');
    }
    const note = {
      text: trimmed,
      createdAt: new Date(),
      authorId: authorId ?? undefined,
      authorName: authorName ?? undefined,
      system: system === true ? true : false,
    };
    const order = await this.orderModel
      .findOneAndUpdate(
        { _id: id },
        { $push: { additionalNotes: note }, $set: { updatedAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    const result = { ...order, id: order._id };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /**
   * Soft delete: cancela orden con PIN admin/manager.
   * status=CANCELLED, isDeleted=true, libera mesa.
   * Mantiene la data para auditoria.
   */
  async cancelWithPin(
    id: string,
    pin: string,
    reason?: string,
    requestUserId?: string,
    requestUserName?: string,
  ) {
    const trimmed = (pin ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('PIN requerido');
    }

    // Solo usuarios con role admin pueden resetear/cancelar ordenes con PIN.
    // Antes esto comparaba `pin` en texto plano con un findOne directo aqui
    // mismo (bypaseando el hash de AuthService). Ahora reusa
    // `verifyAdminPin`, que soporta bcrypt con compatibilidad hacia atras.
    const pinCheck = await this.authService.verifyAdminPin(trimmed);
    if (!pinCheck.valid || pinCheck.adminRole !== UserRoleEnum.ADMIN) {
      throw new BadRequestException('PIN invalido');
    }

    const order = await this.orderModel.findOne({ _id: id }).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Liberar mesa si esta asignada
    if (order.tableId) {
      const updatedTable = await this.tableModel
        .findOneAndUpdate(
          { _id: order.tableId },
          {
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
            orderId: null,
          },
          { new: true },
        )
        .lean();
      if (updatedTable) {
        this.posGateway.notifyTableUpdated({
          ...updatedTable,
          id: updatedTable._id,
        });
      }
    }

    const cancelled = await this.orderModel
      .findOneAndUpdate(
        { _id: id },
        {
          $set: {
            status: OrderStatusEnum.CANCELLED,
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy:
              requestUserName ?? requestUserId ?? pinCheck.adminName ?? 'Admin',
            deletedReason: reason ?? null,
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    // Reversa de inventario si la orden fue pagada (y por lo tanto consumida)
    if (cancelled?.inventoryProcessed) {
      void this.consumptionService
        .reverseOrder(String(cancelled._id), pinCheck.adminId ?? 'sistema')
        .catch((err: Error) =>
          console.error('[Orders] reversa inventario:', err.message),
        );
    }

    const result = { ...cancelled, id: cancelled?._id };
    this.posGateway.notifyOrderUpdated(result);
    return { success: true, order: result, validatedBy: pinCheck.adminName };
  }

  /**
   * Atomically generate a human-readable order number for a given date.
   * Uses a counter collection with findOneAndUpdate + upsert for race-safety.
   * Format: <LETTER><###>-<DD>-<MM>-<YYYY>
   */
  async generateOrderNumber(date: Date = new Date()): Promise<string> {
    // La clave del contador es la JORNADA (corte 6 AM hora de Venezuela), no
    // el dia natural: un pedido de las 2 AM sigue el correlativo de la noche
    // anterior, igual que lo cuenta la caja.
    const jornada = fechaDeJornada(
      date,
      await this.configs.obtener('operacion'),
    );

    const db = this.orderModel.db;
    const countersCol = db.collection('orderCounters');

    const result = await countersCol.findOneAndUpdate(
      { _id: `jornada-${jornada}` } as any,
      {
        $inc: { count: 1 },
        $set: { lastUpdated: new Date(), jornada },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return formatearNumeroOrden(jornada, result?.count ?? 1);
  }

  private correlativoToPrefix(count: number): string {
    if (count < 1) return 'A001';

    if (count <= 2600) {
      const letterIdx = Math.floor((count - 1) / 100);
      const num = ((count - 1) % 100) + 1;
      const letter = String.fromCharCode(65 + letterIdx);
      return `${letter}${String(num).padStart(3, '0')}`;
    }

    const eff = count - 2600;
    const blockIdx = Math.floor((eff - 1) / 100);
    const num = ((eff - 1) % 100) + 1;
    const l1 = Math.floor(blockIdx / 26);
    const l2 = blockIdx % 26;
    if (l1 >= 26) {
      return `Z${count.toString(16).toUpperCase().padStart(3, '0')}`;
    }
    const letters = String.fromCharCode(65 + l1) + String.fromCharCode(65 + l2);
    return `${letters}${String(num).padStart(3, '0')}`;
  }

  async getPosData() {
    const activeStatuses = [
      OrderStatusEnum.PENDING,
      OrderStatusEnum.IN_PROGRESS,
      OrderStatusEnum.READY,
    ];

    const activeOrders = await this.orderModel
      .find({ status: { $in: activeStatuses }, isDeleted: { $ne: true } })
      .lean()
      .sort({ createdAt: -1 })
      .exec();

    const tables = await this.tableModel.find({}).lean().exec();

    const users: Parameters<typeof usuarioParaPos>[0][] = await this.userModel
      .find({})
      .select(CAMPOS_DE_USUARIO_EN_POS)
      .lean()
      .exec();

    return {
      activeOrders: activeOrders.map((order) => ({ ...order, id: order._id })),
      tables: tables.map((table: any) => ({
        ...table,
        id: table._id,
      })),
      users: users.map(usuarioParaPos),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Solicitudes de Crédito (mesonero solicita dejar pendiente)
  // ═══════════════════════════════════════════════════════════════════════

  async requestCredit(
    id: string,
    createCreditRequestDto: CreateCreditRequestDto,
    user: AuthUser,
  ): Promise<any> {
    if (!user?.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const order = await this.orderModel.findOne({ _id: id }).exec();
    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    // Solo el mesonero dueño puede solicitar
    if (order.waiterId !== user.id) {
      throw new ForbiddenException(
        'Solo el mesonero de la orden puede solicitar crédito',
      );
    }

    // Exige cliente real (no es el mesonero ni el usuario del sistema)
    if (
      !order.customerId ||
      order.customerId === order.waiterId ||
      order.customerId === order.userId
    ) {
      throw new BadRequestException(
        'La orden debe tener un cliente asociado para solicitar crédito',
      );
    }

    // Orden no pagada
    const paymentStatus = (order.paymentStatus ?? '').toLowerCase();
    if (paymentStatus === 'paid') {
      throw new BadRequestException('La orden ya está pagada');
    }

    // Estado debe estar activo
    if (
      order.status === OrderStatusEnum.CANCELLED ||
      order.status === OrderStatusEnum.CREDIT
    ) {
      throw new BadRequestException(
        `No se puede solicitar crédito para una orden en estado ${order.status}`,
      );
    }

    // No puede haber solicitud previa en estado REQUESTED
    if (order.creditRequest?.status === 'REQUESTED') {
      throw new BadRequestException(
        'Ya existe una solicitud de crédito pendiente para esta orden',
      );
    }

    // Escribir creditRequest subdoc
    const now = new Date();
    order.creditRequest = {
      status: 'REQUESTED',
      requestedBy: user.id,
      requestedByName: user.name || 'Mesonero',
      requestedAt: now,
      note: createCreditRequestDto.note,
    };

    await order.save();

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  async cancelCreditRequest(id: string, user: AuthUser): Promise<any> {
    if (!user?.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const order = await this.orderModel.findOne({ _id: id }).exec();
    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    // Solo quien solicitó puede cancelar
    if (order.creditRequest?.requestedBy !== user.id) {
      throw new ForbiddenException(
        'Solo quien realizó la solicitud puede cancelarla',
      );
    }

    // Solo desde estado REQUESTED
    if (order.creditRequest?.status !== 'REQUESTED') {
      throw new BadRequestException(
        'La solicitud de crédito debe estar en estado REQUESTED para cancelarla',
      );
    }

    // Actualizar creditRequest a CANCELLED
    order.creditRequest.status = 'CANCELLED';
    order.creditRequest.resolvedBy = user.id;
    order.creditRequest.resolvedByName = user.name || 'Mesonero';
    order.creditRequest.resolvedAt = new Date();
    // @Prop({type: Object}) es Mixed: sin esto Mongoose no persiste la mutación
    order.markModified('creditRequest');

    await order.save();

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  async approveCreditRequest(
    id: string,
    approveCreditRequestDto: ApproveCreditRequestDto,
    user: AuthUser,
  ): Promise<any> {
    if (!user?.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const order = await this.orderModel.findOne({ _id: id }).exec();
    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    // Solo desde estado REQUESTED
    if (order.creditRequest?.status !== 'REQUESTED') {
      throw new BadRequestException(
        'La solicitud de crédito debe estar en estado REQUESTED para aprobarla',
      );
    }

    // Una orden ya cobrada (o a medio cobrar) no se fia: aprobar creaba una
    // cuenta por cobrar por el TOTAL y volvia la orden a 'pending', asi que el
    // cliente quedaba debiendo lo que ya pago. En PRE, el 26/09/2026, 12 de 25
    // solicitudes pendientes eran de ordenes ya pagadas. Va antes del PIN.
    const cobro = classifyOrderPaymentStatus({
      total: order.total,
      paidAmount: order.paidAmount,
      paymentStatus: order.paymentStatus,
    });
    if (cobro.status !== 'UNPAID') {
      throw new BadRequestException(buildPaymentStatusError(cobro));
    }

    // Validar PIN
    const pinValidation = await this.authService.verifyAdminPin(
      approveCreditRequestDto.pin,
    );
    if (!pinValidation.valid) {
      throw new UnauthorizedException('PIN inválido');
    }

    // (a) Crear accountReceivable
    const invoiceNumber = 'INV-' + id.slice(-8).toUpperCase();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // +30 days

    const arResult = await this.accountsReceivableService.create({
      customerId: order.customerId,
      customerName: order.customerName ?? order.customerAlias ?? 'Sin nombre',
      orderId: id,
      invoiceNumber,
      amount: Number(order.total || 0),
      paidAmount: 0,
      dueDate,
      status: 'pending',
      description: `Orden #${id.slice(-8).toUpperCase()}`,
    });

    // (b) Actualizar orden
    order.status = OrderStatusEnum.CREDIT;
    order.paymentStatus = 'pending';
    // Limpiar pagos pendientes (array vacío, no null - pendingPayments es PendingPayment[])
    order.pendingPayments = [];

    order.creditRequest.status = 'APPROVED';
    order.markModified('creditRequest');
    order.creditRequest.resolvedBy = pinValidation.adminId || user.id;
    order.creditRequest.resolvedByName =
      pinValidation.adminName || user.name || 'Admin';
    order.creditRequest.resolvedAt = new Date();

    // (c) Guardar orden - si falla, compensar marcando la AR como cancelled
    // Nota: MongoDB standalone (sin replica set) no soporta transacciones,
    // por lo que usamos compensación manual (softDelete la AR si order.save falla)
    try {
      await order.save();
    } catch (error) {
      // Compensación: intentar cancelar la AR si el guardado de la orden falla
      try {
        if (arResult.id) {
          // Marcar la AR como cancelled (soft delete)
          await this.accountsReceivableService.softDelete(arResult.id);
        }
      } catch (compensationError) {
        this.logger.error(
          `Fallo compensación al cancelar AR ${arResult.id}: ${compensationError}`,
          compensationError,
        );
      }
      // Re-lanzar el error original de guardado
      throw error;
    }

    // (d) Liberar mesa si existe (operación best-effort - logging pero no deshacer crédito)
    if (order.tableId) {
      try {
        await this.tableModel.findOneAndUpdate(
          { _id: order.tableId },
          {
            status: 'ISAVAILABLE',
            isAvailable: true,
            orderId: null,
          },
        );

        const table = await this.tableModel
          .findOne({ _id: order.tableId })
          .lean();
        if (table) {
          this.posGateway.notifyTableUpdated({ ...table, id: table._id });
        }
      } catch (tableError) {
        // Logging del error pero NO deshacer el crédito - se creó correctamente,
        // solo falla la notificación de liberación de mesa
        this.logger.warn(
          `Advertencia al liberar mesa ${order.tableId} para orden ${id}: ${tableError}`,
          tableError,
        );
      }
    }

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  async rejectCreditRequest(
    id: string,
    rejectCreditRequestDto: RejectCreditRequestDto,
    user: AuthUser,
  ): Promise<any> {
    if (!user?.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    // Validar rol: solo admin, manager o cashier pueden rechazar
    const userRole = String(user.role || '').toLowerCase();
    const allowedRoles = ['admin', 'manager', 'cashier'];
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        'Solo caja o administración puede rechazar solicitudes de crédito',
      );
    }

    const order = await this.orderModel.findOne({ _id: id }).exec();
    if (!order) {
      throw new NotFoundException(`Orden con ID ${id} no encontrada`);
    }

    // Solo desde estado REQUESTED
    if (order.creditRequest?.status !== 'REQUESTED') {
      throw new BadRequestException(
        'La solicitud de crédito debe estar en estado REQUESTED para rechazarla',
      );
    }

    // Actualizar creditRequest a REJECTED
    order.creditRequest.status = 'REJECTED';
    order.creditRequest.rejectionReason = rejectCreditRequestDto.reason;
    order.creditRequest.resolvedBy = user.id;
    order.creditRequest.resolvedByName = user.name || 'Usuario';
    order.creditRequest.resolvedAt = new Date();
    order.markModified('creditRequest');

    await order.save();

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Transferencia de Mesas
  // ─────────────────────────────────────────────────────────────

  /**
   * Crea una solicitud de transferencia de mesa.
   * - fromWaiterId viene del JWT (req.user.id)
   * - toWaiterId, fromPct, toPct vienen del body
   * - Validaciones: no auto-ceder, pcts suman 100, orden no pagada, sin transferRequest previo
   */
  async createTransferRequest(
    orderId: string,
    createTransferRequestDto: CreateTransferRequestDto,
    user: AuthUser,
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }

    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    const fromWaiterId = user.id;
    const toWaiterId = createTransferRequestDto.toWaiterId;
    const fromPct = createTransferRequestDto.fromPct;
    const toPct = createTransferRequestDto.toPct;

    // Validación: no cederse a sí mismo
    if (fromWaiterId === toWaiterId) {
      throw new BadRequestException('No puedes cederte la mesa a ti mismo');
    }

    // Validación: porcentajes deben sumar 100
    if (roundMoney(fromPct + toPct) !== 100) {
      throw new BadRequestException('Los porcentajes deben sumar 100');
    }

    // Validación: orden no pagada (case-insensitive)
    const paymentStatus = String(order.paymentStatus || '').toLowerCase();
    if (paymentStatus === 'paid') {
      throw new BadRequestException(
        'No se puede transferir una orden ya pagada',
      );
    }

    // Validación: sin CANCELLED o CREDIT status
    const status = String(order.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'CREDIT') {
      throw new BadRequestException(
        `No se puede transferir una orden en estado ${status}`,
      );
    }

    // Validación: sin transferRequest REQUESTED previa
    if (order.transferRequest?.status === 'REQUESTED') {
      throw new BadRequestException(
        'Ya existe una solicitud de transferencia pendiente',
      );
    }

    // Validación: sin waiterShares previos (v1: un traspaso por orden)
    if (order.waiterShares && order.waiterShares.length > 0) {
      throw new BadRequestException(
        'Esta orden ya fue transferida, no se puede transferir nuevamente',
      );
    }

    // Crear transferRequest
    const now = new Date();
    // Los nombres salen del userModel, no del JWT: el token no trae `name` y
    // los 45 traspasos del historico quedaron diciendo "Usuario".
    const [nombreOrigen, nombreDestino] = await Promise.all([
      this.nombreDelMesonero(fromWaiterId),
      this.nombreDelMesonero(toWaiterId),
    ]);
    order.transferRequest = {
      status: 'REQUESTED',
      fromWaiterId,
      fromWaiterName: nombreOrigen ?? user.name ?? 'Usuario',
      toWaiterId,
      toWaiterName: nombreDestino ?? undefined,
      fromPct,
      toPct,
      requestedAt: now,
    };

    await order.save();

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /**
   * Acepta una solicitud de transferencia.
   * - Solo el toWaiterId (req.user.id) puede aceptar
   * - Cambia estado a ACCEPTED
   * - Crea waiterShares[] con las dos comisiones
   * - Limpia transferRequest de la orden (o mantiene como historial?)
   */
  async acceptTransferRequest(orderId: string, user: AuthUser) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }

    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    if (
      !order.transferRequest ||
      order.transferRequest.status !== 'REQUESTED'
    ) {
      throw new BadRequestException(
        'No hay una solicitud de transferencia pendiente para aceptar',
      );
    }

    // Validación: solo toWaiterId puede aceptar
    if (user.id !== order.transferRequest.toWaiterId) {
      throw new ForbiddenException(
        'Solo el camarero designado puede aceptar esta transferencia',
      );
    }

    // Actualizar estado a ACCEPTED
    order.transferRequest.status = 'ACCEPTED';
    order.transferRequest.resolvedAt = new Date();
    order.markModified('transferRequest');

    // Nombres resueltos por el servidor. Las solicitudes viejas traen
    // "Usuario" congelado, asi que se vuelve a resolver aqui tambien.
    const [nombreOrigen, nombreDestino] = await Promise.all([
      this.nombreDelMesonero(order.transferRequest.fromWaiterId),
      this.nombreDelMesonero(order.transferRequest.toWaiterId),
    ]);

    // Crear waiterShares
    const shares = [
      {
        waiterId: order.transferRequest.fromWaiterId,
        waiterName:
          nombreOrigen ?? order.transferRequest.fromWaiterName ?? 'Usuario',
        pct: order.transferRequest.fromPct,
        comisionPagada: false,
      },
      {
        waiterId: order.transferRequest.toWaiterId,
        waiterName: nombreDestino ?? user.name ?? 'Usuario',
        pct: order.transferRequest.toPct,
        comisionPagada: false,
      },
    ];
    order.waiterShares = shares;

    // Cambiar waiterId a toWaiterId (la orden "pertenece" a quien la acepta ahora)
    order.waiterId = order.transferRequest.toWaiterId;
    // El nombre viaja CON el id. Sin esta linea la orden quedaba apuntando al
    // que la recibe y diciendo el nombre del que la inicio: 14 casos en un
    // solo fin de semana, uno de $222,37 acreditado al mesonero equivocado.
    if (nombreDestino) {
      order.waiterName = nombreDestino;
    }

    await order.save();

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /**
   * Rechaza una solicitud de transferencia.
   * - Solo el toWaiterId (req.user.id) puede rechazar
   * - Cambia estado a REJECTED
   * - Mantiene el record para auditoria pero NO crea waiterShares
   */
  async rejectTransferRequest(
    orderId: string,
    rejectTransferRequestDto: RejectTransferRequestDto,
    user: AuthUser,
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }

    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    if (
      !order.transferRequest ||
      order.transferRequest.status !== 'REQUESTED'
    ) {
      throw new BadRequestException(
        'No hay una solicitud de transferencia pendiente para rechazar',
      );
    }

    // Validación: solo toWaiterId puede rechazar
    if (user.id !== order.transferRequest.toWaiterId) {
      throw new ForbiddenException(
        'Solo el camarero designado puede rechazar esta transferencia',
      );
    }

    // Actualizar estado a REJECTED
    order.transferRequest.status = 'REJECTED';
    order.transferRequest.resolvedAt = new Date();
    order.transferRequest.reason = rejectTransferRequestDto.reason || undefined;
    order.markModified('transferRequest');

    await order.save();

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /**
   * Cancela una solicitud de transferencia.
   * - Solo el fromWaiterId (req.user.id) puede cancelar
   * - Cambia estado a CANCELLED
   * - Borra el transferRequest de la orden
   */
  async cancelTransferRequest(
    orderId: string,
    cancelTransferRequestDto: CancelTransferRequestDto,
    user: AuthUser,
  ) {
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticacion');
    }

    const order = await this.orderModel.findOne({ _id: orderId }).exec();
    if (!order) {
      throw new NotFoundException(`Orden con ID ${orderId} no encontrada`);
    }

    if (
      !order.transferRequest ||
      order.transferRequest.status !== 'REQUESTED'
    ) {
      throw new BadRequestException(
        'No hay una solicitud de transferencia pendiente para cancelar',
      );
    }

    // Validación: solo fromWaiterId puede cancelar
    if (user.id !== order.transferRequest.fromWaiterId) {
      throw new ForbiddenException(
        'Solo quien solicitó la transferencia puede cancelarla',
      );
    }

    // Actualizar estado a CANCELLED
    order.transferRequest.status = 'CANCELLED';
    order.transferRequest.resolvedAt = new Date();
    order.transferRequest.reason = cancelTransferRequestDto.reason || undefined;
    order.markModified('transferRequest');

    await order.save();

    const obj = order.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /**
   * Fusiona la orden  dentro de : los items del
   * origen pasan al destino y el origen queda cerrado apuntando al destino.
   *
   * Sirve cuando dos mesas se juntan, o cuando un grupo que empezo en una zona
   * se sienta en una mesa: hoy eso deja dos cuentas y el cliente recibe dos
   * recibos.
   *
   * Toda la validacion ocurre ANTES de escribir: una fusion a medias deja
   * consumo duplicado, que es peor que no fusionar. Ver
   * docs/superpowers/specs/2026-08-29-fusion-de-ordenes-design.md
   */
  async mergeOrders(
    destinoId: string,
    sourceOrderId: string,
    pin: string,
    actor?: { id?: string; name?: string },
  ) {
    if (!pin?.trim()) {
      throw new UnauthorizedException('PIN admin obligatorio');
    }
    const pinCheck = await this.authService.verifyAdminPin(pin);
    if (!pinCheck.valid) {
      throw new UnauthorizedException('PIN admin invalido');
    }

    const destino = await this.orderModel.findOne({ _id: destinoId }).exec();
    if (!destino) {
      throw new NotFoundException(`Orden destino ${destinoId} no encontrada`);
    }
    const origen = await this.orderModel.findOne({ _id: sourceOrderId }).exec();
    if (!origen) {
      throw new NotFoundException(
        `Orden origen ${sourceOrderId} no encontrada`,
      );
    }

    const motivo = validarFusion(
      destino as unknown as OrdenFusionable,
      origen as unknown as OrdenFusionable,
    );
    if (motivo) {
      throw new BadRequestException(motivo);
    }

    // La fusion calcula con las tarifas que guardo el destino: absorber una
    // orden no cambia las reglas de la cuenta. Se trabaja sobre objetos planos
    // para que los items se copien tal cual, sin campos internos de Mongoose.
    const destinoPlano = destino.toObject() as unknown as OrdenFusionable &
      TasasGuardadas;
    const fusion = construirFusion(
      destinoPlano,
      origen.toObject() as unknown as OrdenFusionable,
      configDeOrden(destinoPlano),
    );

    // Marcar el origen PRIMERO, condicionado a que siga sin fusionar. Mongo
    // aca es standalone (sin transacciones), asi que este findOneAndUpdate
    // atomico es el unico guardian real contra dos cajas fusionando a la vez.
    // Si algo falla despues, la orden queda apuntada pero sin mover: preferible
    // a duplicar el consumo.
    const origenMarcado = await this.orderModel
      .findOneAndUpdate(
        {
          _id: sourceOrderId,
          mergedIntoOrderId: { $exists: false },
          isDeleted: { $ne: true },
        },
        {
          $set: {
            mergedIntoOrderId: String(destino._id),
            mergedAt: new Date(),
            mergedBy: actor?.id ?? pinCheck.adminId ?? 'desconocido',
            isDeleted: true,
          },
        },
        { new: true },
      )
      .lean();

    if (!origenMarcado) {
      throw new BadRequestException(
        'La orden origen fue fusionada o anulada por otra caja. Recarga y vuelve a intentar.',
      );
    }

    destino.items = fusion.items as unknown as typeof destino.items;
    Object.assign(
      destino,
      camposDeTotales(fusion.totales, configDeOrden(destinoPlano)),
    );
    destino.tipAmount = fusion.tipAmount;
    if (fusion.waiterShares.length > 0) {
      destino.waiterShares = fusion.waiterShares as typeof destino.waiterShares;
    }
    if (fusion.customerId) destino.customerId = fusion.customerId;
    destino.comisionBase = await this.ajustarComisionBasePorSocio(
      destino.customerId,
      fusion.totales.comisionBase,
    );
    destino.mergedFromOrderIds = [
      ...(destino.mergedFromOrderIds ?? []),
      String(origen._id),
    ];
    // La ficha impresa del destino ya no describe la orden: se revoca. La del
    // origen muere con la orden.
    destino.fichaNonce = generateFichaNonce();
    destino.markModified('items');
    await destino.save();

    await this.liberarMesaDeOrigenFusionado(origen);

    const obj = destino.toObject();
    const result = { ...obj, id: String(obj._id) };
    this.posGateway.notifyOrderUpdated(result);
    return result;
  }

  /**
   * Libera la mesa del origen tras fusionar.
   *
   * Los TRES campos son obligatorios: la UI del POS marca la mesa como ocupada
   * tanto por `status` como por `isAvailable`, asi que actualizar solo uno la
   * deja roja sin pedido. Solo libera si la mesa sigue apuntando a ESA orden,
   * para no pisar un traspaso simultaneo.
   */
  private async liberarMesaDeOrigenFusionado(origen: {
    _id: unknown;
    tableId?: string | null;
  }): Promise<void> {
    if (!origen?.tableId) return;
    try {
      const liberada = await this.tableModel
        .findOneAndUpdate(
          { _id: origen.tableId, orderId: String(origen._id) },
          {
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
            orderId: null,
          },
          { new: true },
        )
        .lean();
      if (liberada) {
        this.posGateway.notifyTableUpdated({ ...liberada, id: liberada._id });
      }
    } catch (err) {
      console.error(
        '[Orders] liberarMesaDeOrigenFusionado error:',
        (err as Error)?.message,
      );
    }
  }
}
