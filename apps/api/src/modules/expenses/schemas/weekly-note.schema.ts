import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

/** Novedad de la semana ("se daño la nevera", "vino el de la gaveta"). */
@Schema({ collection: 'weekly_notes', timestamps: true })
export class WeeklyNote {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, required: true })
  text: string;

  @Prop({ type: String, required: true })
  socio: string;

  @Prop({ type: Number })
  telegramId?: number;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: Date, required: true, index: true })
  weekStart: Date;
}

export const WeeklyNoteSchema = SchemaFactory.createForClass(WeeklyNote);
export type WeeklyNoteDocument = HydratedDocument<WeeklyNote>;
export type WeeklyNoteLean = WeeklyNote;
