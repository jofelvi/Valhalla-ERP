import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderItemEventsService } from './order-item-events.service';
import { Order, OrderSchema } from './schemas/order.schema';
import {
  OrderItemEvent,
  OrderItemEventSchema,
} from './schemas/order-item-event.schema';
import { Table, TableSchema } from '../tables/schemas/table.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { PaymentsModule } from '../payments/payments.module';
import { OcrModule } from '../ocr/ocr.module';
import { WebsocketsModule } from '../websockets/websockets.module';
import { AuthModule } from '../auth/auth.module';
import { PagoMovilModule } from '../pago-movil/pago-movil.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsReceivableModule } from '../accounts-receivable/accounts-receivable.module';
import { ProductSchema } from '../products/schemas/product.schema';
import { PushModule } from '../push/push.module';
import { SociosExcluidosModule } from '../socios-excluidos/socios-excluidos.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderItemEvent.name, schema: OrderItemEventSchema },
      { name: 'Table', schema: TableSchema },
      { name: 'User', schema: UserSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: 'Product', schema: ProductSchema },
    ]),
    PaymentsModule,
    OcrModule,
    WebsocketsModule,
    AuthModule,
    PagoMovilModule,
    InventoryModule,
    AccountsReceivableModule,
    PushModule,
    SociosExcluidosModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderItemEventsService],
  exports: [OrdersService, OrderItemEventsService],
})
export class OrdersModule {}
