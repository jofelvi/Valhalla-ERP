import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { InvoiceStatusEnum } from '@odin6/types';

export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({ _id: true, timestamps: true })
class InvoiceItem {
  @Prop()
  productId?: string;

  @Prop()
  name?: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  unitPrice: number;

  @Prop({ required: true })
  total: number;

  @Prop()
  notes?: string;
}

@Schema({ timestamps: true, collection: 'invoices' })
export class Invoice {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  invoiceNumber: string;

  @Prop()
  orderId?: string;

  @Prop()
  customerId?: string;

  @Prop()
  customerName?: string;

  @Prop()
  customerRif?: string;

  // Datos fiscales adicionales (factura SENIAT)
  @Prop()
  customerIdType?: string; // V, E, J, G, P

  @Prop()
  customerAddress?: string;

  @Prop()
  customerPhone?: string;

  @Prop()
  customerEmail?: string;

  // Tipo de cliente segun SENIAT (afecta retenciones)
  @Prop()
  customerType?: string; // contribuyente_ordinario | contribuyente_formal | no_contribuyente

  // Numero de control fiscal (correlativo, separado del invoiceNumber)
  @Prop()
  controlNumber?: string;

  // Forma/condicion de pago
  @Prop()
  paymentCondition?: string; // contado | credito_15 | credito_30 | credito_60

  // Fecha de emision (separada del createdAt para permitir retro-fechado fiscal)
  @Prop()
  issueDate?: Date;

  // Observaciones / notas fiscales
  @Prop()
  observations?: string;

  // Descuento aplicado en monto absoluto
  @Prop()
  discount?: number;

  // Linkeo con presupuesto del que se genero (opcional)
  @Prop()
  budgetId?: string;

  @Prop()
  subtotal?: number;

  @Prop()
  serviceCharge?: number;

  // Etiquetas impresas de las líneas de impuesto y servicio, copiadas de `tarifas` y
  // `vocabulario` al facturar: la factura conserva el nombre que tenía entonces.
  @Prop()
  taxLabel?: string;

  @Prop()
  serviceChargeLabel?: string;

  @Prop()
  tax?: number;

  @Prop()
  total?: number;

  @Prop()
  tip?: number;

  @Prop()
  totalAmount?: number;

  @Prop()
  paymentType?: string;

  @Prop({ default: 'USD' })
  currency?: string;

  @Prop({
    enum: Object.values(InvoiceStatusEnum),
    default: InvoiceStatusEnum.PENDING,
  })
  status?: string;

  @Prop()
  dueDate?: Date;

  @Prop()
  paidAt?: Date;

  @Prop()
  notes?: string;

  @Prop({ type: [InvoiceItem], default: [] })
  items?: InvoiceItem[];

  // ── Datos del cobro (cuando proviene de verificacion de cobro mesonero) ──
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
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

/**
 * Una orden no puede tener dos facturas.
 *
 * El control en codigo no basta contra peticiones simultaneas: las dos
 * consultan antes de que ninguna haya insertado y las dos pasan. Solo el
 * indice unico lo resuelve de forma atomica.
 *
 * Parcial: las 3 facturas historicas sin `orderId` quedan fuera.
 *
 * OJO: no se construye mientras existan duplicados historicos. Correr antes
 * `scripts/dedupe-invoices.mjs`.
 */
InvoiceSchema.index(
  { orderId: 1 },
  {
    unique: true,
    name: 'uniq_factura_por_orden',
    partialFilterExpression: { orderId: { $type: 'string' } },
  },
);
