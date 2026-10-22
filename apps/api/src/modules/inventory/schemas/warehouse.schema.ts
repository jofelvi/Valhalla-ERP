import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { InventoryArea } from '../units';

export type WarehouseDocument = HydratedDocument<Warehouse>;

@Schema({ timestamps: true, collection: 'warehouses' })
export class Warehouse {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  name: string; // "Nevera Cocina 1", "Cava fría", "Depósito seco"

  @Prop({
    type: String,
    required: true,
    enum: ['GENERAL', 'COCINA', 'PIZZERIA', 'BARRA'],
  })
  area: InventoryArea;

  // Almacén destino por defecto del área (consumos por venta / compras)
  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: true })
  isActive: boolean;

  /**
   * Cuándo se hizo el conteo INICIAL de este almacén.
   *
   * Sin línea base, el stock del sistema arrastra el daño histórico y decir
   * "agotado" sería mentir: Cocina lleva la Papa en −13.776 g porque nunca se
   * contó, no porque falte. Mientras esto sea null, el POS avisa "inventario
   * no cargado" en vez de "agotado".
   */
  @Prop()
  baselineAt?: Date;
}

export const WarehouseSchema = SchemaFactory.createForClass(Warehouse);
