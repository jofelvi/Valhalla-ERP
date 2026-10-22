import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AlmacenDiarioDocument = HydratedDocument<AlmacenDiario>;

interface StockEntry {
  productId: string;
  cantidad: number;
}

interface Movimiento {
  id: string;
  tipo: string;
  productId: string;
  cantidad: number;
  timestamp: Date;
  motivo?: string;
  usuario?: string;
}

interface VentaRef {
  orderId: string;
  timestamp: Date;
  total: number;
}

interface StockFinal {
  productId: string;
  cantidadInicial: number;
  cantidadVendida: number;
  cantidadAjustada: number;
  cantidadFinal: number;
}

interface Resumen {
  totalProductosInicial: number;
  totalVentas: number;
  totalProductosFinal: number;
  montoTotalVentas: number;
  numeroOrdenes: number;
}

@Schema({ timestamps: true, collection: 'almacen-diario' })
export class AlmacenDiario {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  fecha: Date;

  @Prop({ enum: ['abierto', 'cerrado'], default: 'abierto' })
  estado: string;

  @Prop({ required: true })
  horaApertura: Date;

  @Prop()
  horaCierre?: Date;

  @Prop({ type: [Object], default: [] })
  stockInicial: StockEntry[];

  @Prop({ type: [Object], default: [] })
  stockActual: StockEntry[];

  @Prop({ type: [Object], default: [] })
  movimientos: Movimiento[];

  @Prop({ type: [Object], default: [] })
  ventasRef: VentaRef[];

  @Prop({ type: [Object] })
  stockFinal?: StockFinal[];

  @Prop({ type: Object })
  resumen?: Resumen;

  @Prop()
  usuarioApertura?: string;

  @Prop()
  usuarioCierre?: string;

  @Prop()
  notas?: string;
}

export const AlmacenDiarioSchema = SchemaFactory.createForClass(AlmacenDiario);
