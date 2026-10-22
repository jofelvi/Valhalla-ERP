import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Lo que habia en el banco al abrir una semana de negocio.
 *
 * No se calcula desde la semana anterior a proposito. Se probaron las dos y la
 * cadena pierde: basta que una semana quede incompleta —el 28/09/2026 faltaban
 * 12 gastos por Bs 348.289, que el bot no habia reconocido— para que el arrastre
 * meta ese error en todas las semanas siguientes, sin que nada avise. Cargado a
 * mano, el numero es de quien arqueo el banco y solo miente la semana en que se
 * escribio mal (dueño, 29/09/2026).
 *
 * El `_id` es el `weekStart` (martes 6am VE) en ISO, para que sea imposible
 * tener dos saldos de la misma semana.
 */
@Schema({ collection: 'weekly_balances', timestamps: true })
export class WeeklyBalance {
  /** weekStart en ISO, ej. "2026-09-22T10:00:00.000Z". */
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Date, required: true, index: true })
  weekStart: Date;

  /** Saldo en USD al abrir la semana. */
  @Prop({ type: Number, required: true })
  saldoInicial: number;

  /** Quien lo cargo, para poder preguntarle. */
  @Prop({ type: String, required: true })
  socio: string;

  @Prop({ type: Number })
  telegramId?: number;

  @Prop({ type: String })
  notes?: string;
}

export const WeeklyBalanceSchema = SchemaFactory.createForClass(WeeklyBalance);
export type WeeklyBalanceDocument = HydratedDocument<WeeklyBalance>;
export type WeeklyBalanceLean = WeeklyBalance;
