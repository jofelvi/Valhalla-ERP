import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import {
  AccountReceivable,
  AccountReceivableSchema,
} from '../accounts-receivable/schemas/account-receivable.schema';
import { CobrosIncompletosService } from './cobros-incompletos.service';
import { TurnosSociosService } from './turnos-socios.service';
import { SociosExcluidosModule } from '../socios-excluidos/socios-excluidos.module';
import { PanelService } from './panel/panel.service';
import { PanelController } from './panel/panel.controller';

@Module({
  imports: [
    SociosExcluidosModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: AccountReceivable.name, schema: AccountReceivableSchema },
    ]),
  ],
  providers: [
    AnalyticsService,
    CobrosIncompletosService,
    TurnosSociosService,
    PanelService,
  ],
  controllers: [AnalyticsController, PanelController],
  exports: [
    AnalyticsService,
    CobrosIncompletosService,
    TurnosSociosService,
    PanelService,
  ],
})
export class AnalyticsModule {}
