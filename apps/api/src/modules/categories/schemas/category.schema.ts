import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true })
  name: string;

  // Jerarquía padre→hijo: una categoría con `parentId` es una SUBCATEGORÍA de
  // la categoría raíz apuntada. Opcional: las categorías de venta normales no
  // lo llevan. Se usa hoy para las subcategorías de insumos (productos BASE).
  @Prop()
  parentId?: string;

  @Prop()
  description: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: true })
  isForSale: boolean;

  @Prop()
  imageUrl: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
