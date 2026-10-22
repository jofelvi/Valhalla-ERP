import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsService } from './products.service';
import { CostPropagationService } from './cost-propagation.service';
import { MarginAlertsService } from './margin-alerts.service';
import { ProductsController } from './products.controller';
import { Product, ProductSchema } from './schemas/product.schema';
import { MarginAlert, MarginAlertSchema } from './schemas/margin-alert.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: MarginAlert.name, schema: MarginAlertSchema },
      // Solo para costear el tiempo de preparacion con el sueldo real de quien
      // prepara. Lectura, nunca escritura.
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, CostPropagationService, MarginAlertsService],
  // CostPropagationService lo usa el modulo de inventario: una compra sube el
  // costo del insumo y con el, el de todo lo que lo lleva.
  // MarginAlertsService lo usa el modulo de alertas para exponer los márgenes.
  exports: [ProductsService, CostPropagationService, MarginAlertsService],
})
export class ProductsModule {}
