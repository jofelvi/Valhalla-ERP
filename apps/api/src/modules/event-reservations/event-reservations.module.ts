import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventReservationsController } from './event-reservations.controller';
import { EventReservationsService } from './event-reservations.service';
import {
  EventReservation,
  EventReservationSchema,
} from './schemas/event-reservation.schema';
import { ExchangeModule } from '../exchange/exchange.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventReservation.name, schema: EventReservationSchema },
    ]),
    ExchangeModule,
    NotificationsModule,
  ],
  controllers: [EventReservationsController],
  providers: [EventReservationsService],
})
export class EventReservationsModule {}
