import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PagoMovilController } from './pago-movil.controller';
import { PagoMovilService } from './pago-movil.service';
import { PagoMovil, PagoMovilSchema } from './schemas/pago-movil.schema';
import { BanvenesScrapeService } from './banvenes-scraper.service';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { TableSchema } from '../tables/schemas/table.schema';
import { WebsocketsModule } from '../websockets/websockets.module';
import { BanvenezModule } from '../banvenez/banvenez.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: PagoMovil.name, schema: PagoMovilSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: 'Table', schema: TableSchema },
    ]),
    WebsocketsModule,
    BanvenezModule,
    PushModule,
  ],
  controllers: [PagoMovilController],
  providers: [PagoMovilService, BanvenesScrapeService],
  exports: [PagoMovilService],
})
export class PagoMovilModule {}
