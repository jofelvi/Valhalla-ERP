import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  OrderStatusEnum,
  PaymentStatusEnum,
  SERVICE_MODES,
} from '@odin6/types';
import type { ServiceMode, UltimaEntrega } from '@odin6/types';
import type { ConfigDeCalculo } from '../config-de-orden.util';

export type OrderDocument = HydratedDocument<Order>;

// Tobos mixtos: desglose por variante (Light/Pilsen/Azul) de un tobo/caja.
// Solo para inventario y entrega por variante — NO afecta el precio (el tobo
// se cobra completo). deliveredQty/returnedQty se mueven al despachar/devolver.
@Schema({ _id: false, timestamps: false })
class ToboCompositionEntry {
  @Prop({ required: true })
  variantProductId: string;

  @Prop({ required: true })
  variantName: string;

  @Prop({ required: true })
  qty: number;

  @Prop({ default: 0 })
  deliveredQty: number;

  @Prop({ default: 0 })
  returnedQty: number;
}

@Schema({ _id: true, timestamps: true })
class OrderItem {
  @Prop({ required: true })
  productId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  unitPrice: number;

  @Prop({ required: true })
  total: number;

  @Prop()
  notes?: string;

  @Prop({ type: Object, default: null })
  customizations?: {
    removedIngredients?: string[];
    addedExtras?: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
    }>;
    customizationPrice?: number;
  };

  @Prop()
  station?: string;

  @Prop()
  sentQty?: number;

  @Prop()
  printedQty?: number;

  @Prop()
  printedAt?: Date;

  @Prop()
  deliveredQty?: number;

  // Unidades que trae el pack (12 el tobo, 18 la media caja, 36 la caja).
  //
  // `normalizePackLines` lo calcula en CADA patch que traiga items desde el
  // 30/07/2026, pero este sub-schema es estricto y no lo declaraba: Mongoose lo
  // descartaba en silencio y nunca llegaba a la base. Medido el 20/09/2026
  // contra produccion: de 478 ordenes con una linea de tobo, UNA sola lo tiene
  // guardado, y esa entro por un toque manual del dia del arreglo.
  //
  // Se declara para que una linea de pack se reconozca mirando el documento,
  // sin volver a consultar el registro.
  @Prop()
  presentationQty?: number;

  // Unidades de este item cuyo consumo de inventario YA se emitió (al entregar
  // "en vivo" o en el respaldo al pagar). Idempotencia del descuento: la misma
  // unidad nunca se descuenta dos veces, sin importar el orden pago/entrega
  // (el flujo "Enviar y Cobrar" paga antes de entregar). No aplica a tobos
  // (composition): esos mueven stock por variante.
  @Prop({ default: 0 })
  inventoryConsumedQty?: number;

  // Tobos mixtos: desglose por variante. Si está presente, el inventario se
  // mueve por variante al despachar (no por receta al pagar).
  @Prop({ type: [ToboCompositionEntry], default: undefined })
  composition?: ToboCompositionEntry[];

  @Prop()
  addedAt?: Date;

  @Prop()
  addedBy?: string;

  // ───────── Borrado logico (item nunca entregado) ─────────
  // Solo aplica si deliveredQty == 0 al momento del cancel.
  // El item permanece en el array (auditoria) pero se ignora al recalcular
  // subtotal/total. Para entregados se usa noCharge en su lugar.
  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancelledBy?: string;

  @Prop()
  cancelReason?: string;

  // ───────── Cortesia (item entregado pero no cobrado) ─────────
  // El item sigue en factura para inventario y trackeo, pero su precio
  // no suma al subtotal cobrado. Requiere PIN admin obligatorio.
  @Prop({ default: false })
  noCharge?: boolean;

  @Prop()
  noChargeAt?: Date;

  @Prop()
  noChargeBy?: string;

  @Prop()
  noChargeReason?: string;

  @Prop()
  noChargePinValidatedByUserId?: string;

  // Snapshot de deliveredQty al momento de aplicar la cortesia, para auditoria
  // (saber si el cajero la aplico antes o despues de que cocina entregara)
  @Prop()
  noChargeDeliveredQtyAtTime?: number;

  // Quien causo el error que se esta invitando. NO cambia el dinero: el
  // servicio se sigue cobrando pleno y el mesonero no pierde comision. Se
  // registra para poder medir de donde salen las cortesias (una cortesia por
  // plato quemado no dice lo mismo que una por pedido mal cantado).
  @Prop({ enum: ['COCINA', 'BARRA', 'MESONERO', 'CASA'] })
  noChargeResponsible?: string;

  // ───────── Descuento parcial (rebaja comercial con PIN admin) ─────────
  // A diferencia de la cortesia, el descuento SI baja la base del 10% de
  // servicio: es una rebaja sobre lo que el cliente paga.
  @Prop({ enum: ['PCT', 'AMOUNT'] })
  discountType?: string;

  // Lo que tecleo el administrador: 25 = 25% si es PCT, o $25 si es AMOUNT.
  @Prop()
  discountValue?: number;

  // Monto resultante en USD. Se congela para que un cambio de precio del
  // producto no reescriba una rebaja ya autorizada.
  @Prop({ default: 0 })
  discountAmount?: number;

  @Prop()
  discountReason?: string;

  @Prop()
  discountAt?: Date;

  @Prop()
  discountBy?: string;

  @Prop()
  discountPinValidatedByUserId?: string;
}

@Schema({ _id: false, timestamps: false })
class AdditionalNote {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  authorId?: string;

  @Prop()
  authorName?: string;

  @Prop({ default: false })
  system?: boolean;
}

@Schema({ _id: true, timestamps: true })
class PendingPayment {
  @Prop({ required: true })
  method: string;

  @Prop({ required: true })
  amount: number;

  @Prop()
  amountBs?: number;

  @Prop()
  reference?: string;

  // Comprobantes + datos Pago Movil por entry (la APK los manda por pago)
  @Prop({ type: [String], default: [] })
  proofUrls?: string[];

  @Prop()
  pagoMovilPhone?: string;

  @Prop()
  pagoMovilCedula?: string;

  @Prop()
  pagoMovilBanco?: string;

  // Resultado del OCR sobre las imagenes del proof. Sin @Prop el strict mode
  // de Mongoose lo descarta silenciosamente y la UI queda en "OCR procesando…"
  // para siempre. Tipado como objeto generico porque el shape lo arma
  // processOcrForOrder y puede evolucionar.
  @Prop({ type: Object })
  ocr?: any;
}

@Schema({ _id: false, timestamps: false })
class CreditRequest {
  @Prop({
    required: true,
    enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
  })
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @Prop({ required: true })
  requestedBy: string;

  @Prop()
  requestedByName?: string;

  @Prop({ required: true })
  requestedAt: Date;

  @Prop()
  note?: string;

  @Prop()
  resolvedBy?: string;

  @Prop()
  resolvedByName?: string;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  rejectionReason?: string;
}

// Solicitud del CLIENTE en una orden vinculada: pedir un producto (el mesonero
// lo acepta y se agrega), llamar al mesonero, o pedir algo (texto libre).
@Schema({ _id: false, timestamps: false })
class CustomerRequest {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, enum: ['PRODUCT', 'CALL_WAITER', 'MISC'] })
  type: 'PRODUCT' | 'CALL_WAITER' | 'MISC';

  @Prop()
  productId?: string;

  @Prop()
  productName?: string;

  @Prop()
  quantity?: number;

  @Prop()
  note?: string;

  @Prop({ required: true, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'ACK'] })
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ACK';

  @Prop({ required: true })
  createdByCustomerId: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  resolvedByUserId?: string;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  rejectReason?: string;
}

// Subdoc para representar la comisión de un camarero en una orden transferida
@Schema({ _id: false, timestamps: false })
class WaiterShare {
  @Prop({ required: true })
  waiterId: string;

  @Prop()
  waiterName?: string;

  @Prop({ required: true })
  pct: number;

  @Prop({ default: false })
  comisionPagada?: boolean;

  @Prop()
  comisionPagadaAt?: Date;

  @Prop()
  comisionPagoId?: string;
}

// Subdoc para la solicitud de transferencia de mesa entre camareros
@Schema({ _id: false, timestamps: false })
class TransferRequest {
  @Prop({
    required: true,
    enum: ['REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
  })
  status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

  @Prop({ required: true })
  fromWaiterId: string;

  @Prop()
  fromWaiterName?: string;

  @Prop({ required: true })
  toWaiterId: string;

  @Prop()
  toWaiterName?: string;

  @Prop({ required: true })
  fromPct: number;

  @Prop({ required: true })
  toPct: number;

  @Prop({ required: true })
  requestedAt: Date;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  reason?: string;
}

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop()
  orderNumber?: string;

  // Idempotencia de creacion: el cliente genera un id por intento de checkout
  // y lo reusa en reintentos (mala red). Mismo id => misma orden, no duplica.
  // El dedupe en `create()` (findOne antes de insertar) no alcanza contra dos
  // POST simultaneos (mismo problema que se documenta junto al indice de
  // `payment.schema.ts`): la garantia real es este indice unico. `sparse`
  // para no chocar entre las ordenes que no mandan la clave (la mayoria).
  //
  // OJO antes de desplegar: este indice NO se construye si ya hay
  // `clientRequestId` duplicados historicos. Dedupe en mongosh (conservando
  // la orden mas vieja de cada grupo):
  //
  //   db.orders.aggregate([
  //     { $match: { clientRequestId: { $type: "string", $ne: "" } } },
  //     { $sort: { createdAt: 1 } },
  //     { $group: { _id: "$clientRequestId", ids: { $push: "$_id" }, count: { $sum: 1 } } },
  //     { $match: { count: { $gt: 1 } } },
  //   ]).forEach(g => {
  //     const ids = g.ids.slice(1); // conserva la mas vieja (createdAt asc)
  //     db.orders.deleteMany({ _id: { $in: ids } });
  //   });
  @Prop({ index: true, unique: true, sparse: true })
  clientRequestId?: string;

  @Prop()
  tableId?: string;

  @Prop()
  waiterId?: string;

  // Nombre del mesonero (denormalizado). Sin este @Prop, Mongoose (strict) lo
  // descartaba al guardar y la estacion no podia mostrar quien atiende la orden.
  @Prop()
  waiterName?: string;

  @Prop()
  customerAlias?: string;

  @Prop()
  associateNumber?: string;

  @Prop()
  sector?: string;

  @Prop()
  customerId?: string;

  @Prop()
  customerName?: string;

  // QR de vinculo del cliente. Rotar el nonce revoca un QR ya mostrado/capturado.
  @Prop()
  linkNonce?: string;

  @Prop({ required: true })
  userId: string;

  @Prop({
    required: true,
    enum: Object.values(OrderStatusEnum),
    default: OrderStatusEnum.PENDING,
  })
  status: string;

  @Prop({ type: [OrderItem], required: true, default: [] })
  items: OrderItem[];

  // Soft-delete visible: items eliminados/reducidos de la orden DESPUES de
  // haberse comandado. Nunca se borran — quedan aqui con quien autorizo (PIN),
  // el mesonero de la orden y el motivo. Anti-fraude (caso tobos jul-2026).
  @Prop({ type: [Object], default: [] })
  cancelledItems?: Array<{
    productId: string;
    name: string;
    qty: number;
    unitPrice?: number;
    total?: number;
    station?: string | null;
    reason?: string;
    authorizedById?: string | null;
    authorizedByName?: string | null;
    actorId?: string | null;
    cancelledAt: Date;
  }>;

  @Prop({ required: true })
  subtotal: number;

  @Prop({ default: 0 })
  serviceCharge: number;

  // Antes required: true. Órdenes creadas sin IVA (web POS legacy, zonas)
  // llegaban sin `tax` y el order.save() de deliverByFicha reventaba con
  // "Path `tax` is required" → la barra no podía entregar. Default 0.
  @Prop({ default: 0 })
  tax: number;

  @Prop({ required: true })
  total: number;

  // Suma de items con noCharge:true (cortesias). Sin @Prop el strict mode
  // de Mongoose lo descarta y el frontend no puede mostrar el desglose.
  // Se calcula en recomputeOrderTotals() al cancelar / no-charge / etc.
  @Prop({ default: 0 })
  noChargeAmount?: number;

  // Suma de los descuentos por item. Mismo motivo que noChargeAmount: sin
  // @Prop el strict mode lo descarta y el desglose no lo puede mostrar.
  @Prop({ default: 0 })
  discountAmount?: number;

  // Base de comision del mesonero: 10% de (subtotal − cortesias − descuentos).
  // Distinto de serviceCharge (lo que paga el cliente, que NO baja por
  // cortesia): la cortesia no genera comision (decision del dueño 13/09/2026).
  // Lo escribe recomputeOrderTotals(). Sin @Prop el strict mode lo descarta.
  @Prop({ default: 0 })
  comisionBase?: number;

  // Tasas con las que se calculó la orden (ver config-de-orden.util.ts). Un cambio
  // de tarifa en Ajustes no las reescribe: la orden se recalcula con las suyas.
  // Sin @Prop el strict mode las descarta y el recálculo volvería a las vigentes.
  @Prop({ default: 0 })
  servicioIncluido?: number;

  @Prop()
  tasaServicio?: number;

  @Prop({ type: String, enum: SERVICE_MODES })
  modoServicio?: ServiceMode;

  @Prop()
  tasaIva?: number;

  @Prop()
  ivaIncluido?: boolean;

  @Prop({ type: Object })
  configAplicada?: ConfigDeCalculo;

  @Prop()
  tipAmount?: number;

  /**
   * Lo cobrado hasta ahora, en dolares. Lo mantiene el SERVIDOR con un $inc
   * condicional: es el candado que impide el cobro doble.
   *
   * Mongo esta en standalone (sin transacciones), asi que la unica garantia
   * real ante dos cierres simultaneos es una operacion atomica sobre UN
   * documento. Consultar y despues insertar no alcanza: las dos peticiones
   * leen antes de que ninguna escriba y las dos pasan — medido, 3 POST a la
   * vez dejaban 3 cobros de $5.50 en una orden de $5.50.
   *
   * Es un espejo de la suma de `payments`, no la verdad contable: si alguna
   * vez se desincroniza, se recalcula con scripts/backfill-paid-amount.mjs.
   */
  @Prop({ default: 0 })
  paidAmount?: number;

  @Prop()
  @Prop()
  paymentMethod?: string;

  @Prop()
  orderType?: string;

  @Prop({
    enum: Object.values(PaymentStatusEnum),
    default: PaymentStatusEnum.PENDING,
  })
  paymentStatus?: string;

  @Prop()
  notes?: string;

  @Prop({ type: [AdditionalNote], default: [] })
  additionalNotes?: AdditionalNote[];

  @Prop({ default: false })
  isDeleted?: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop()
  deletedBy?: string;

  @Prop()
  deletedReason?: string;

  @Prop()
  paymentReference?: string;

  @Prop()
  bcvRate?: number;

  @Prop()
  paymentAmountBs?: number;

  @Prop({ type: [String], default: [] })
  paymentProofUrls?: string[];

  @Prop()
  pagoMovilPhone?: string;

  @Prop()
  pagoMovilCedula?: string;

  @Prop()
  pagoMovilBanco?: string;

  @Prop({ type: [PendingPayment], default: [] })
  pendingPayments?: PendingPayment[];

  @Prop({ default: false })
  paymentRejected?: boolean;

  @Prop()
  paymentRejectionReason?: string;

  @Prop()
  paymentRejectedAt?: Date;

  @Prop()
  paymentRejectedBy?: string;

  @Prop()
  tableName?: string;

  // Flags de pago de comision al mesonero. Sin estos @Prop el strict mode de
  // Mongoose descarta el $set silenciosamente y la orden sigue apareciendo
  // como pendiente en /private/comisiones aunque el pago ya se registro.
  @Prop({ default: false })
  comisionPagada?: boolean;

  @Prop()
  comisionPagadaAt?: Date;

  @Prop()
  comisionPagoId?: string;

  // Idempotencia del descuento de inventario (motor de consumo)
  @Prop({ default: false })
  inventoryProcessed?: boolean;

  // Última entrega marcada: quién y cuándo. La pinta la zona del POS.
  @Prop({ type: Object, default: null })
  ultimaEntrega?: UltimaEntrega | null;

  // Nonce de la ficha QR de barra. Se genera perezosamente la primera vez que
  // se produce el token (al mostrar/imprimir la ficha). Rotarlo revoca la
  // ficha impresa vieja. Ver ficha-token.util.ts.
  @Prop()
  fichaNonce?: string;

  // Idempotencia de entrega por ficha: lista de opIds ya aplicados. Si se
  // reintenta con un opId ya aqui, no se aplica nada y se devuelve la ficha
  // en estado actual (mismo retorno que entrega exitosa).
  @Prop({ type: [String], default: [] })
  fichaDeliveryOps?: string[];

  // Idempotencia de devolucion por ficha: ledger SEPARADO del de entrega. Una
  // devolucion es una operacion distinta de una entrega, asi que aunque reuse el
  // mismo opId que una entrega previa NO debe deduplicarse contra ella; solo se
  // deduplica el reintento de la MISMA devolucion.
  @Prop({ type: [String], default: [] })
  fichaReturnOps?: string[];

  // Solicitud de dejar pendiente (crédito solicitado por mesonero)
  @Prop({ type: Object })
  creditRequest?: CreditRequest;

  // Solicitud de transferencia de mesa entre camareros
  @Prop({ type: Object })
  transferRequest?: TransferRequest;

  // Array de camareros con comisión compartida (usado cuando transferRequest aceptada)
  @Prop({ type: [Object], default: [] })
  waiterShares?: WaiterShare[];

  // ─── Fusion de ordenes ───────────────────────────────────────────────
  // La orden ORIGEN de una fusion queda apuntando aca. Sus items ya viven en
  // el destino, asi que ademas se marca isDeleted: si siguiera contando como
  // venta, el mismo consumo sumaria dos veces en reportes, cierre y comision.
  // No se borra: se conserva para auditar de donde salio cada item.
  @Prop()
  mergedIntoOrderId?: string;

  @Prop()
  mergedAt?: Date;

  @Prop()
  mergedBy?: string;

  // En la orden DESTINO: de que ordenes absorbio items.
  @Prop({ type: [String], default: undefined })
  mergedFromOrderIds?: string[];

  // Solicitudes del cliente vinculado (producto / llamar / pedir algo)
  @Prop({ type: [Object], default: [] })
  customerRequests: CustomerRequest[];

  // El cliente pidió la cuenta (aviso al mesonero/caja; sin manejo de dinero)
  @Prop({ default: false })
  billRequested: boolean;

  @Prop()
  billRequestedAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
