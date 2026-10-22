import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EventReservationDocument = HydratedDocument<EventReservation>;

export const RESERVATION_PACKAGES = ['RON', 'WHISKY'] as const;
export type ReservationPackage = (typeof RESERVATION_PACKAGES)[number];

export const RESERVATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

@Schema({ timestamps: true, collection: 'eventReservations' })
export class EventReservation {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ required: true, index: true })
  eventSlug: string;

  @Prop({ required: true, min: 1, max: 30 })
  tableNumber: number;

  @Prop({ type: String, required: true, enum: RESERVATION_PACKAGES })
  package: ReservationPackage;

  @Prop({ required: true })
  cedula: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  paymentReference: string;

  @Prop({ required: true })
  amountUsd: number;

  @Prop({ required: true })
  amountBs: number;

  @Prop({ required: true })
  bcvRate: number;

  @Prop({ type: String, enum: RESERVATION_STATUSES, default: 'PENDING' })
  status: ReservationStatus;
}

export const EventReservationSchema =
  SchemaFactory.createForClass(EventReservation);

// Anti-doble-reserva: una mesa solo puede tener UNA reserva activa
// (PENDING o CONFIRMED) por evento. Las CANCELLED no bloquean la mesa.
// Mongo lanza E11000 ante la carrera; el service lo mapea a 409.
EventReservationSchema.index(
  { eventSlug: 1, tableNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'CONFIRMED'] } },
  },
);
