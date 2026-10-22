import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InsumoRequestDocument = HydratedDocument<InsumoRequest>;

export type InsumoRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Qué está pidiendo la estación:
 * - TRASLADO:    que le repongan del depósito (lo único que existía antes).
 * - PRODUCCION:  ya elaboró algo (masas, salsa, porciones). Al aprobar entra el
 *                elaborado a su almacén y sale el crudo según la receta.
 * - ALTA_INSUMO: el insumo no existe en el catálogo y propone crearlo. La
 *                estación nunca escribe el catálogo: solo propone.
 */
export type InsumoRequestType = 'TRASLADO' | 'PRODUCCION' | 'ALTA_INSUMO';

// Un renglón solicitado (producto + cantidad en su unidad base).
@Schema({ _id: false, timestamps: false })
class InsumoRequestItem {
  @Prop({ required: true })
  productId: string;

  @Prop({ required: true })
  productName: string;

  @Prop({ required: true })
  qty: number;

  @Prop({ required: true })
  unit: string;
}

// Solicitud de una estación (barra/cocina/pizza) al admin para que le repongan
// insumos desde el depósito (almacén GENERAL). Al aprobar se transfiere el
// stock automáticamente al almacén de la estación.
@Schema({ timestamps: true, collection: 'insumoRequests' })
export class InsumoRequest {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true, enum: ['BAR', 'KITCHEN', 'PIZZA'], index: true })
  station: string;

  // Sin default explícito en los documentos viejos: los que no lo traen son
  // TRASLADO, que era lo único que existía cuando se crearon.
  @Prop({
    required: true,
    enum: ['TRASLADO', 'PRODUCCION', 'ALTA_INSUMO'],
    default: 'TRASLADO',
    index: true,
  })
  type: InsumoRequestType;

  @Prop({ type: [InsumoRequestItem], required: true, default: [] })
  items: InsumoRequestItem[];

  /**
   * Solo para ALTA_INSUMO: lo que la estación propone crear. Gerencia completa
   * al aprobar lo que no le toca decidir al personal (costo, criticidad y la
   * receta si es elaborado).
   */
  @Prop({
    type: {
      _id: false,
      name: { type: String, required: true },
      unit: String,
      purpose: String,
      linkedProductId: String,
    },
    default: undefined,
  })
  proposedProduct?: {
    name: string;
    unit?: string;
    purpose?: string;
    /** Si al aprobar resultó ser un insumo que ya existía, queda enlazado aquí. */
    linkedProductId?: string;
  };

  /**
   * Avisos calculados al crear/aprobar, p. ej. "la harina queda en -2.400 gr".
   * Se guardan para que la decisión de gerencia quede documentada.
   */
  @Prop({ type: [String], default: undefined })
  warnings?: string[];

  @Prop()
  note?: string;

  @Prop({
    required: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
    index: true,
  })
  status: InsumoRequestStatus;

  @Prop({ required: true })
  requestedById: string;

  @Prop()
  requestedByName?: string;

  @Prop()
  resolvedById?: string;

  @Prop()
  resolvedByName?: string;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  rejectionReason?: string;

  // Almacén origen/destino resueltos al aprobar (auditoría de la transferencia).
  @Prop()
  fromWarehouseId?: string;

  @Prop()
  toWarehouseId?: string;
}

export const InsumoRequestSchema = SchemaFactory.createForClass(InsumoRequest);
