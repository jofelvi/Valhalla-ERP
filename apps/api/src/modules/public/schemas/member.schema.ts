import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MemberDocument = HydratedDocument<Member>;

/**
 * Socio pre-registrado del club. _id es el numero de accion (string de 5
 * digitos con ceros a la izquierda: "00004").
 *
 * Los campos de credito los traia el padron migrado de Firestore y no estaban
 * declarados aqui, asi que el POS los pedia a Firestore directamente. Estan
 * en los 1083 documentos.
 */
@Schema({ collection: 'members' })
export class Member {
  @Prop({ type: String })
  _id: string;

  @Prop({ required: true })
  accion: number;

  @Prop({ required: true, index: true })
  cedula: string;

  @Prop({ required: true })
  nombre: string;

  /** Cuanto puede consumir a credito. 0 = sin credito otorgado. */
  @Prop({ type: Number, default: 0 })
  creditLimit: number;

  /** Cuanto lleva consumido y no pagado. */
  @Prop({ type: Number, default: 0 })
  creditUsed: number;

  /** Meses de cuota al dia: condicion para tener credito. */
  @Prop({ type: Number, default: 0 })
  creditMonthsPaid: number;

  @Prop({ type: Date, default: null })
  creditGrantedAt: Date | null;
}

export const MemberSchema = SchemaFactory.createForClass(Member);

/**
 * El padron usa la accion con ceros a la izquierda como _id ("00004").
 * El POS la escribe indistintamente con o sin relleno, asi que se normaliza
 * en un solo sitio.
 */
export function accionNormalizada(accion: string): string {
  return String(accion ?? '').trim().padStart(5, '0');
}
