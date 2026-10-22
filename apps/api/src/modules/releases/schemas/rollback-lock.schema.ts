import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RollbackLockDocument = HydratedDocument<RollbackLock>;

/**
 * Candado de "una reversion a la vez".
 *
 * El Mongo del VPS es standalone (sin transacciones), asi que el unico guardia
 * real es un updateOne condicional sobre un documento fijo.
 */
@Schema({ timestamps: true, collection: 'rollback_lock' })
export class RollbackLock {
  @Prop({ type: String, default: 'lock' })
  _id: string;

  @Prop({ default: false })
  enCurso: boolean;

  @Prop()
  ambito?: string;

  @Prop()
  sha?: string;

  @Prop()
  paso?: string;

  @Prop()
  iniciadoEn?: Date;

  @Prop()
  iniciadoPor?: string;
}

export const RollbackLockSchema = SchemaFactory.createForClass(RollbackLock);
