import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import {
  AccountReceivable,
  AccountReceivableSchema,
} from '../accounts-receivable/schemas/account-receivable.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  Customer,
  CustomerSchema,
} from '../customers/schemas/customer.schema';
import { Member, MemberSchema } from './schemas/member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccountReceivable.name, schema: AccountReceivableSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
  ],
  providers: [PublicService],
  controllers: [PublicController],
  exports: [PublicService],
})
export class PublicModule {}
