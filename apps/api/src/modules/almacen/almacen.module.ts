import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlmacenService } from './almacen.service';
import { AlmacenController } from './almacen.controller';
import {
  AlmacenDiario,
  AlmacenDiarioSchema,
} from './schemas/almacen-diario.schema';
import {
  AlmacenGeneral,
  AlmacenGeneralSchema,
} from './schemas/almacen-general.schema';
import {
  KitchenSession,
  KitchenSessionSchema,
} from './schemas/kitchen-session.schema';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AlmacenDiario.name, schema: AlmacenDiarioSchema },
      { name: AlmacenGeneral.name, schema: AlmacenGeneralSchema },
      { name: KitchenSession.name, schema: KitchenSessionSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [AlmacenController, KitchenController],
  providers: [AlmacenService, KitchenService],
  exports: [AlmacenService, KitchenService],
})
export class AlmacenModule {}
