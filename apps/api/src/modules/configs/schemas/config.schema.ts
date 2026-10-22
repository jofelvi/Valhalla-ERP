import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ConfigDocument = HydratedDocument<Config>;

/**
 * Configuraciones globales del sistema.
 *
 * Documentos del contrato (`_id` ∈ CONFIG_IDS, ver docs/contrato-config.md): `valor` es un
 * objeto. Los documentos viejos de tipo numérico (`margen_minimo`, `precio_minimo`...) siguen
 * siendo legibles: `valor` admite cualquier forma y se normaliza al leer.
 *
 * Se leen y escriben SIEMPRE a través de `ConfigsService`.
 */
@Schema({ collection: 'configs' })
export class Config {
  @Prop({ type: String, required: true })
  _id: string; // 'margen_minimo', 'precio_minimo', etc.

  /** Objeto del contrato, o un valor suelto de los documentos viejos. */
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  valor: unknown;

  @Prop({ type: String })
  descripcion?: string;

  @Prop({ type: Date, default: () => new Date() })
  updatedAt: Date;

  /** Usuario que hizo el último cambio (null en escrituras del sistema). */
  @Prop({ type: String, default: null })
  updatedBy?: string | null;
}

export const ConfigSchema = SchemaFactory.createForClass(Config);
