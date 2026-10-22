import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrintQueueService } from './print-queue.service';
import { PrintQueueController } from './print-queue.controller';
import { PrintJob, PrintJobSchema } from './schemas/print-job.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { WebsocketsModule } from '../websockets/websockets.module';
import { PrintAlertsService } from './print-alerts.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrintJob.name, schema: PrintJobSchema },
      // Para imprimir "SIN cebolla" y no "SIN prod-botella-a": los
      // ingredientes quitados viajan como ids y aqui se traducen a nombre.
      { name: Product.name, schema: ProductSchema },
    ]),
    WebsocketsModule,
    // Para partir la ficha por estacion hace falta leer los items reales de la
    // orden (la app manda la ficha completa, sin decir de que estacion es cada
    // item). OrdersModule no importa PrintQueueModule: no hay ciclo.
    OrdersModule,
  ],
  providers: [PrintQueueService, PrintAlertsService],
  controllers: [PrintQueueController],
  exports: [PrintQueueService],
})
export class PrintQueueModule {}
