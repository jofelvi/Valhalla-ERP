import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComisionesController } from './comisiones.controller';
import { ComisionesService } from './comisiones.service';
import {
  PagoComision,
  PagoComisionSchema,
} from './schemas/pago-comision.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PagoComision.name, schema: PagoComisionSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [ComisionesController],
  providers: [ComisionesService],
  exports: [ComisionesService],
})
export class ComisionesModule {}
