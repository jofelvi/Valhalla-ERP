import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AccountDeletionRequestDocument =
  HydratedDocument<AccountDeletionRequest>;

/**
 * Qué se hace con la cuenta al procesar la solicitud.
 *
 * - `completa`: sin saldo pendiente. Se eliminan los datos personales; los
 *   pedidos y pagos quedan anonimizados por obligación contable.
 * - `solo_acceso`: con saldo pendiente. Se elimina SOLO el acceso (el usuario
 *   para entrar) y se conservan los datos que hacen falta para cobrar.
 */
export type AlcanceDeBaja = 'completa' | 'solo_acceso';
export type EstadoDeBaja = 'pending' | 'processed';

@Schema({ timestamps: true, collection: 'account_deletion_requests' })
export class AccountDeletionRequest {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  /** Es el mismo id del cliente: en este sistema usuario y cliente comparten `_id`. */
  @Prop({ required: true })
  userId: string;

  @Prop({ type: String, default: null })
  email: string | null;

  @Prop({ type: String, default: null })
  name: string | null;

  @Prop({ type: String, default: null })
  phone: string | null;

  @Prop({ type: String, default: null })
  role: string | null;

  /** Saldo vivo en USD AL MOMENTO de pedir la baja. */
  @Prop({ default: 0 })
  deuda: number;

  @Prop({ default: 0 })
  cuentasVivas: number;

  @Prop({ required: true, enum: ['completa', 'solo_acceso'] })
  alcance: AlcanceDeBaja;

  @Prop({
    required: true,
    enum: ['pending', 'processed'],
    default: 'pending',
  })
  estado: EstadoDeBaja;

  @Prop({ type: String, default: null })
  motivo: string | null;

  @Prop({ type: String, default: 'app' })
  origen: string;

  @Prop({ type: Date, default: null })
  procesadaEn: Date | null;

  @Prop({ type: String, default: null })
  procesadaPor: string | null;

  @Prop({ type: String, default: null })
  nota: string | null;
}

export const AccountDeletionRequestSchema = SchemaFactory.createForClass(
  AccountDeletionRequest,
);

// Una sola solicitud pendiente por persona, garantizado por la base: dos
// toques seguidos (o un reintento por red lenta) no crean dos.
AccountDeletionRequestSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { estado: 'pending' } },
);
AccountDeletionRequestSchema.index({ estado: 1, createdAt: -1 });
