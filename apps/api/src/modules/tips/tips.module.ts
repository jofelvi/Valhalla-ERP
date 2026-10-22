import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TipsController } from './tips.controller';
import { TipsService } from './tips.service';
import { Tip, TipSchema } from './schemas/tip.schema';
import { OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tip.name, schema: TipSchema },
      // La propina se escribe en la orden en el mismo paso: `order.tipAmount`
      // es la fuente de verdad (ver tips.service.create).
      { name: 'Order', schema: OrderSchema },
    ]),
  ],
  controllers: [TipsController],
  providers: [TipsService],
  exports: [TipsService],
})
export class TipsModule {}
