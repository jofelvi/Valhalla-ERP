import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { KitchenNotifierService } from './kitchen-notifier.service';
import { ApnsService } from './apns.service';

/**
 * Push a los telefonos del staff (FCM directo, sin firebase-admin).
 * Se exporta KitchenNotifierService para que OrdersService avise cuando
 * cocina entrega.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [PushController],
  providers: [PushService, KitchenNotifierService, ApnsService],
  exports: [PushService, KitchenNotifierService],
})
export class PushModule {}
