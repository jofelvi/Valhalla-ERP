import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountReceivableSchema } from '../accounts-receivable/schemas/account-receivable.schema';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { CustomerNotifierService } from './customer-notifier.service';
import { CustomerDebtService } from './customer-debt.service';

/**
 * Modulo sin dependencias de otros modulos de dominio a proposito: lo importan
 * accounts-receivable y payments, asi que cualquier import cruzado aqui crearia
 * una dependencia circular.
 */
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: 'AccountReceivable', schema: AccountReceivableSchema },
    ]),
  ],
  providers: [
    SmsService,
    EmailService,
    CustomerNotifierService,
    CustomerDebtService,
  ],
  exports: [
    SmsService,
    EmailService,
    CustomerNotifierService,
    CustomerDebtService,
  ],
})
export class SmsModule {}
