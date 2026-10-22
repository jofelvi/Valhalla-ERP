import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CashRegisterController } from './cash-register.controller';
import { CashRegisterService } from './cash-register.service';
import {
  CashRegisterSession,
  CashRegisterSessionSchema,
} from './schemas/cash-register-session.schema';
import {
  CashRegisterEvent,
  CashRegisterEventSchema,
} from './schemas/cash-register-event.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CashRegisterSession.name, schema: CashRegisterSessionSchema },
      { name: CashRegisterEvent.name, schema: CashRegisterEventSchema },
      // Solo lectura, y agregada: el resumen del cierre se calcula con un
      // $group en Mongo en vez de bajarse los 4.336 pagos al telefono.
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [CashRegisterController],
  providers: [CashRegisterService],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}
