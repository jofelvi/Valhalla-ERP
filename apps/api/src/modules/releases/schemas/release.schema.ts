import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ReleaseAmbitoEnum } from '@odin6/types';

export type ReleaseDocument = HydratedDocument<Release>;

@Schema({ timestamps: true, collection: 'releases' })
export class Release {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  /** La del deploy real, no la de creacion del registro. */
  @Prop({ required: true, index: true })
  fecha: Date;

  @Prop({ type: [String], enum: ReleaseAmbitoEnum, required: true })
  ambito: string[];

  /** Solo APK: 'v1.2.1'. */
  @Prop()
  version?: string;

  @Prop({ required: true })
  titulo: string;

  @Prop({ type: [String], default: [] })
  cambios: string[];

  @Prop({ type: [String], default: [] })
  commits: string[];

  /**
   * El commit que quedo desplegado en cada lado. Sin esto no hay reversion
   * posible: no se sabria a donde volver.
   */
  @Prop({ type: Object, default: {} })
  shas: { web?: string; api?: string };

  /**
   * Si el despliegue movio datos. Por defecto true cuando hay ambito `api`,
   * para que el descuido bloquee de mas y nunca de menos.
   */
  @Prop({ default: false })
  migroDatos: boolean;

  @Prop()
  revertidaDe?: string;

  @Prop()
  createdBy: string;
}

export const ReleaseSchema = SchemaFactory.createForClass(Release);
ReleaseSchema.index({ fecha: -1 });
ReleaseSchema.index({ ambito: 1, fecha: -1 });
