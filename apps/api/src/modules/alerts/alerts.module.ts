import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import {
  MarginAlert,
  MarginAlertSchema,
} from '../products/schemas/margin-alert.schema';
import { ProductsModule } from '../products/products.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: MarginAlert.name, schema: MarginAlertSchema },
    ]),
    // De aqui salen los margenes abiertos y el orquestador MarginAlertsService.
    ProductsModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
