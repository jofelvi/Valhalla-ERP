import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AlmacenGeneralDocument = HydratedDocument<AlmacenGeneral>;

interface ProductoStock {
  productId: string;
  stockDisponible: number;
  ubicacion?: string;
  fechaUltimaActualizacion?: Date;
}

@Schema({ timestamps: true, collection: 'almacen-general' })
export class AlmacenGeneral {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ type: [Object], default: [] })
  productos: ProductoStock[];
}

export const AlmacenGeneralSchema =
  SchemaFactory.createForClass(AlmacenGeneral);
