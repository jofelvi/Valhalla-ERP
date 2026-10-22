import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OcrModule } from '../ocr/ocr.module';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import {
  InventoryMovement,
  InventoryMovementSchema,
} from './schemas/inventory-movement.schema';
import {
  WarehouseStock,
  WarehouseStockSchema,
} from './schemas/warehouse-stock.schema';
import {
  InventoryCount,
  InventoryCountSchema,
} from './schemas/inventory-count.schema';
import {
  PriceHistory,
  PriceHistorySchema,
} from './schemas/price-history.schema';
import { Purchase, PurchaseSchema } from './schemas/purchase.schema';
import {
  ShoppingList,
  ShoppingListSchema,
} from './schemas/shopping-list.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Supplier, SupplierSchema } from '../suppliers/schemas/supplier.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  WeeklyReport,
  WeeklyReportSchema,
} from './schemas/weekly-report.schema';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { MovementsService } from './movements.service';
import { MovementsController } from './movements.controller';
import { CountsService } from './counts.service';
import { CountsController } from './counts.controller';
import { ConsumptionService } from './consumption.service';
import { PriceHistoryService } from './price-history.service';
import { PurchaseAliasesService } from './purchase-aliases.service';
import { AuthModule } from '../auth/auth.module';
import {
  PurchaseAlias,
  PurchaseAliasSchema,
} from './schemas/purchase-alias.schema';
import { PriceHistoryController } from './price-history.controller';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingListsController } from './shopping-lists.controller';
import { SHOPPING_LIST_MARKER } from './purchases.service';
import { DeepseekService } from './deepseek.service';
import { WeeklyReportService } from './weekly-report.service';
import { WeeklyReportController } from './weekly-report.controller';
import { CatalogAuditService } from './catalog-audit.service';
import { CatalogAuditController } from './catalog-audit.controller';
import {
  InsumoRequest,
  InsumoRequestSchema,
} from './schemas/insumo-request.schema';
import { InsumoRequestsService } from './insumo-requests.service';
import { InsumoRequestsController } from './insumo-requests.controller';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    // Para autorizar solicitudes con el PIN del jefe sin duplicar esa logica.
    AuthModule,
    MongooseModule.forFeature([
      { name: Warehouse.name, schema: WarehouseSchema },
      { name: InventoryMovement.name, schema: InventoryMovementSchema },
      { name: WarehouseStock.name, schema: WarehouseStockSchema },
      { name: InventoryCount.name, schema: InventoryCountSchema },
      { name: PriceHistory.name, schema: PriceHistorySchema },
      { name: Purchase.name, schema: PurchaseSchema },
      { name: PurchaseAlias.name, schema: PurchaseAliasSchema },
      { name: ShoppingList.name, schema: ShoppingListSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: Order.name, schema: OrderSchema },
      { name: WeeklyReport.name, schema: WeeklyReportSchema },
      { name: InsumoRequest.name, schema: InsumoRequestSchema },
    ]),
    OcrModule,
    // Una compra sube el costo del insumo y, con el, el de todo lo que lo
    // lleva; de ahi salen las alertas de margen.
    ProductsModule,
  ],
  controllers: [
    WarehousesController,
    MovementsController,
    InsumoRequestsController,
    CountsController,
    PriceHistoryController,
    PurchasesController,
    ShoppingListsController,
    WeeklyReportController,
    CatalogAuditController,
    AvailabilityController,
  ],
  providers: [
    WarehousesService,
    MovementsService,
    InsumoRequestsService,
    CountsService,
    ConsumptionService,
    PriceHistoryService,
    PurchaseAliasesService,
    PurchasesService,
    ShoppingListsService,
    DeepseekService,
    WeeklyReportService,
    CatalogAuditService,
    AvailabilityService,
    { provide: SHOPPING_LIST_MARKER, useExisting: ShoppingListsService },
  ],
  exports: [
    WarehousesService,
    MovementsService,
    CountsService,
    ConsumptionService,
    PriceHistoryService,
    PurchaseAliasesService,
    PurchasesService,
    ShoppingListsService,
    DeepseekService,
    WeeklyReportService,
    CatalogAuditService,
    SHOPPING_LIST_MARKER,
  ],
})
export class InventoryModule {}
