import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  PagoMovil,
  PagoMovilSchema,
} from '../pago-movil/schemas/pago-movil.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { AccountReceivableSchema } from '../accounts-receivable/schemas/account-receivable.schema';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: 'Order', schema: OrderSchema },
      { name: PagoMovil.name, schema: PagoMovilSchema },
      { name: 'Customer', schema: CustomerSchema },
      // Para calcular la deuda total del cliente en el aviso de compra.
      { name: 'AccountReceivable', schema: AccountReceivableSchema },
    ]),
    SmsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
