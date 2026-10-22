import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentReportsController } from './payment-reports.controller';
import { PaymentReportsService } from './payment-reports.service';
import {
  PaymentReport,
  PaymentReportSchema,
} from './schemas/payment-report.schema';
import {
  AccountReceivable,
  AccountReceivableSchema,
} from '../accounts-receivable/schemas/account-receivable.schema';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentReport.name, schema: PaymentReportSchema },
      { name: AccountReceivable.name, schema: AccountReceivableSchema },
    ]),
    PaymentsModule,
  ],
  controllers: [PaymentReportsController],
  providers: [PaymentReportsService],
  exports: [PaymentReportsService],
})
export class PaymentReportsModule {}
