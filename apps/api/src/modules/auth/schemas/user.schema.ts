import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRoleEnum } from '@odin6/types';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  image: string;

  @Prop({
    required: true,
    enum: Object.values(UserRoleEnum),
    default: UserRoleEnum.CUSTOMER,
  })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  /** Telefono del cliente (opcional; el registro clasico no lo pedia). */
  @Prop()
  phone: string;

  /** Verificacion de email por codigo de 6 digitos. */
  @Prop({ default: false })
  emailVerified: boolean;

  /** Hash SHA-256 del codigo de verificacion vigente (nunca en claro). */
  @Prop()
  verificationCodeHash?: string;

  /** Expiracion del codigo de verificacion. */
  @Prop()
  verificationExpiresAt?: Date;

  @Prop()
  firebaseAuthId: string;

  /**
   * PIN de acceso rapido (verify-admin-pin, cancelar orden con PIN, etc.).
   * Migrando a bcrypt con compatibilidad hacia atras: los PIN historicos
   * (de la migracion Firebase) viven en texto plano en este campo; la
   * verificacion (`AuthService.verifyAdminPin`) los re-hashea al vuelo hacia
   * `pinHash` en el primer acierto y borra este. No se corre una migracion
   * masiva — ver notas en AuthService.
   */
  @Prop()
  pin?: string;

  /** Hash bcrypt del PIN. Unica forma en que se escribe un PIN nuevo. */
  @Prop()
  pinHash?: string;

  @Prop()
  lastLoginAt: Date;

  // ─── Version del cliente (APK/web) ──────────────────────────────────────
  // El telefono ya manda X-App-Version en cada request; hasta ahora solo se
  // escribia en un log cuando se rechazaba una peticion. Guardarla permite
  // responder de un vistazo quien tiene que actualizar, y correlacionar un
  // error reportado con la version que esa persona esta usando.
  @Prop()
  lastAppVersion?: string;

  @Prop()
  lastAppPlatform?: string;

  @Prop()
  lastAppSeenAt?: Date;

  /**
   * Tokens FCM de los telefonos donde este usuario tiene la app. Es un array
   * porque un mesonero puede usar dos equipos; los vencidos se limpian solos
   * cuando FCM responde UNREGISTERED.
   */
  @Prop({
    type: [
      {
        _id: false,
        token: { type: String, required: true },
        platform: String,
        deviceName: String,
        updatedAt: Date,
      },
    ],
    default: undefined,
  })
  pushTokens: Array<{
    token: string;
    platform?: string;
    deviceName?: string;
    updatedAt?: Date;
  }>;
}

export const UserSchema = SchemaFactory.createForClass(User);
