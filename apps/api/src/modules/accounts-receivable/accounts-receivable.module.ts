import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { AccountsReceivableService } from './accounts-receivable.service';
import {
  AccountReceivable,
  AccountReceivableSchema,
} from './schemas/account-receivable.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { SmsModule } from '../sms/sms.module';
import { SociosExcluidosModule } from '../socios-excluidos/socios-excluidos.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccountReceivable.name, schema: AccountReceivableSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    SmsModule,
    // El resumen de la cartera aparta el consumo de los socios directivos: la
    // lista de quienes son la sirve este modulo, para que todas las pantallas
    // den el MISMO numero.
    SociosExcluidosModule,
  ],
  controllers: [AccountsReceivableController],
  providers: [AccountsReceivableService],
  exports: [AccountsReceivableService],
})
export class AccountsReceivableModule {}
