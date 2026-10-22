import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema';
import {
  AccountReceivable,
  AccountReceivableSchema,
} from '../accounts-receivable/schemas/account-receivable.schema';
import { SmsModule } from '../sms/sms.module';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';
import {
  AccountDeletionRequest,
  AccountDeletionRequestSchema,
} from './schemas/account-deletion-request.schema';

/**
 * Baja de cuenta pedida desde la app (Apple 5.1.1(v) / Play).
 *
 * Solo registra la solicitud y avisa: no borra datos por sí mismo. Importa
 * `SmsModule` (que ya exporta `EmailService`) en vez de duplicar el envío.
 */
@Module({
  imports: [
    ConfigModule,
    SmsModule,
    MongooseModule.forFeature([
      {
        name: AccountDeletionRequest.name,
        schema: AccountDeletionRequestSchema,
      },
      { name: User.name, schema: UserSchema },
      { name: AccountReceivable.name, schema: AccountReceivableSchema },
    ]),
  ],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService],
})
export class AccountDeletionModule {}
