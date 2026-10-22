import { OPERACION_DEFAULT } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import {
  WeeklyReport,
  WeeklyReportSchema,
} from './schemas/weekly-report.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  InventoryMovement,
  InventoryMovementSchema,
} from './schemas/inventory-movement.schema';
import { Purchase, PurchaseSchema } from './schemas/purchase.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { WeeklyReportService } from './weekly-report.service';
import { DeepseekService } from './deepseek.service';

describe('WeeklyReportService', () => {
  let service: WeeklyReportService;
  let module: TestingModule;
  let mongoServer: MongoMemoryServer;
  let connection: Connection;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: WeeklyReport.name, schema: WeeklyReportSchema },
          { name: Order.name, schema: OrderSchema },
          { name: InventoryMovement.name, schema: InventoryMovementSchema },
          { name: Purchase.name, schema: PurchaseSchema },
          { name: Product.name, schema: ProductSchema },
        ]),
      ],
      providers: [
        WeeklyReportService,
        {
          provide: ConfigsService,
          useValue: { obtener: () => Promise.resolve(OPERACION_DEFAULT) },
        },
        {
          provide: DeepseekService,
          useValue: {
            complete: jest.fn().mockResolvedValue({
              text: 'Resumen de prueba: Excelente semana. Recomendaciones: 1. Aumentar inventario. 2. Revisar costos.',
              error: null,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WeeklyReportService>(WeeklyReportService);
    connection = module.get<Connection>(getConnectionToken());

    // No llamar onModuleInit para evitar que el cron siga vivo
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  describe('Caso 1: Semana con 2 órdenes pagadas (una con receta), ventas y ticket exactos', () => {
    it('debe calcular ventas totales, órdenes y ticket promedio correctamente', async () => {
      const weekStart = new Date('2026-02-02T00:00:00Z');
      const weekEnd = new Date('2026-02-09T00:00:00Z');

      // Crear producto con receta
      const Product1 = await module.get(getModelToken('Product')).create({
        _id: 'prod-hamburguesa',
        name: 'Hamburguesa',
        price: 7.75,
        categoryId: 'cat-platos',
        cost: 5,
        presentation: 'Unidad',
        presentationQuantity: 1,
        ingredients: [
          {
            productId: 'ing-carne',
            quantity: 150,
            unit: 'gr',
            wastePercentage: 10,
          },
        ],
      });

      const Ingredient = await module.get(getModelToken('Product')).create({
        _id: 'ing-carne',
        name: 'Carne Molida',
        price: 10,
        categoryId: 'cat-insumos',
        cost: 10,
        presentation: 'Kilogramo',
        presentationQuantity: 1,
        isForInventory: true,
      });

      // Crear 2 órdenes pagadas
      const Order1 = await module.get(getModelToken('Order')).create({
        _id: 'order-1',
        userId: 'user-test',
        subtotal: 15.5,
        tax: 0,
        total: 15.5,
        paymentStatus: 'paid',
        createdAt: new Date('2026-02-03T10:00:00Z'),
        items: [
          {
            productId: 'prod-hamburguesa',
            name: 'Hamburguesa',
            quantity: 2,
            unitPrice: 7.75,
            total: 15.5,
          },
        ],
      });

      const Order2 = await module.get(getModelToken('Order')).create({
        _id: 'order-2',
        userId: 'user-test',
        subtotal: 24.0,
        tax: 0,
        total: 24.0,
        paymentStatus: 'paid',
        createdAt: new Date('2026-02-04T12:30:00Z'),
        items: [
          {
            productId: 'prod-hamburguesa',
            name: 'Hamburguesa',
            quantity: 3,
            unitPrice: 8.0,
            total: 24.0,
          },
        ],
      });

      // Ejecutar generate
      const report = await service.generate(weekStart);

      // Verificar ventas
      expect(report.kpis.ventas.totalUsd).toBeCloseTo(39.5, 2);
      expect(report.kpis.ventas.ordenes).toBe(2);
      expect(report.kpis.ventas.ticketPromedio).toBeCloseTo(19.75, 2);
    });
  });

  describe('Caso 2: FoodCostPct con consumo sembrado', () => {
    it('debe calcular foodCostPct correctamente con movimientos de consumo', async () => {
      const weekStart = new Date('2026-02-02T00:00:00Z');
      const weekEnd = new Date('2026-02-09T00:00:00Z');

      // Crear orden pagada
      await module.get(getModelToken('Order')).create({
        _id: 'order-fc1',
        userId: 'user-test',
        subtotal: 100,
        tax: 0,
        total: 100,
        paymentStatus: 'paid',
        createdAt: new Date('2026-02-03T10:00:00Z'),
        items: [
          {
            productId: 'prod-test',
            name: 'Plato Test',
            quantity: 1,
            unitPrice: 100,
            total: 100,
          },
        ],
      });

      // Crear movimiento de consumo: qty=-1000 (negativo), unitCost=0.05
      // consumoUsd = |1000 * 0.05| = 50
      // foodCostPct = 50/100 * 100 = 50%
      await module.get(getModelToken('InventoryMovement')).create({
        productId: 'ing-test',
        type: 'CONSUMO_VENTA',
        qty: -1000,
        baseUnit: 'GR',
        unitCost: 0.05,
        warehouseId: 'warehouse-1',
        userId: 'user-test',
        createdAt: new Date('2026-02-03T10:30:00Z'),
        refType: 'order',
        refId: 'order-fc1',
      });

      const report = await service.generate(weekStart);

      expect(report.kpis.foodCost.consumoUsd).toBeCloseTo(50, 2);
      expect(report.kpis.foodCost.ventasUsd).toBeCloseTo(100, 2);
      expect(report.kpis.foodCost.foodCostPct).toBeCloseTo(50, 2);
    });
  });

  describe('Caso 3: Merma declarada + ajuste negativo + ajuste positivo separados', () => {
    it('debe separar correctamente merma declarada, faltante y sobrante', async () => {
      const weekStart = new Date('2026-02-02T00:00:00Z');

      // Crear producto para compras (así comprasUsd > 0)
      await module.get(getModelToken('Purchase')).create({
        _id: 'purch-1',
        placeId: 'place-restaurant',
        placeName: 'Restaurante Principal',
        date: new Date('2026-02-03T08:00:00Z'),
        items: [],
        total: 500,
        warehouseId: 'warehouse-1',
        createdBy: 'user-test',
        createdAt: new Date('2026-02-03T08:00:00Z'),
      });

      // Merma declarada: qty=-100, unitCost=2 → 200 USD
      await module.get(getModelToken('InventoryMovement')).create({
        productId: 'prod-merma',
        type: 'MERMA_DECLARADA',
        qty: -100,
        baseUnit: 'UND',
        unitCost: 2,
        warehouseId: 'warehouse-1',
        userId: 'user-test',
        createdAt: new Date('2026-02-04T10:00:00Z'),
      });

      // Conteo ajuste negativo (faltante): qty=-50, unitCost=1.5 → 75 USD
      await module.get(getModelToken('InventoryMovement')).create({
        productId: 'prod-faltante',
        type: 'CONTEO_AJUSTE',
        qty: -50,
        baseUnit: 'UND',
        unitCost: 1.5,
        warehouseId: 'warehouse-1',
        userId: 'user-test',
        createdAt: new Date('2026-02-05T10:00:00Z'),
      });

      // Conteo ajuste positivo (sobrante): qty=30, unitCost=3 → 90 USD
      await module.get(getModelToken('InventoryMovement')).create({
        productId: 'prod-sobrante',
        type: 'CONTEO_AJUSTE',
        qty: 30,
        baseUnit: 'UND',
        unitCost: 3,
        warehouseId: 'warehouse-1',
        userId: 'user-test',
        createdAt: new Date('2026-02-06T10:00:00Z'),
      });

      const report = await service.generate(weekStart);

      expect(report.kpis.merma.declaradaUsd).toBeCloseTo(200, 2);
      expect(report.kpis.merma.faltanteUsd).toBeCloseTo(75, 2);
      expect(report.kpis.merma.sobranteUsd).toBeCloseTo(90, 2);
      expect(report.kpis.merma.totalUsd).toBeCloseTo(275, 2);
      expect(report.kpis.merma.pctSobreCompras).toBeCloseTo(55, 2); // 275/500*100
    });
  });

  describe('Caso 4: Semana sin datos → KPIs en 0/null sin crashear', () => {
    it('debe retornar KPIs válidos con ceros y nulls cuando no hay datos', async () => {
      const weekStart = new Date('2026-02-02T00:00:00Z');

      const report = await service.generate(weekStart);

      expect(report.kpis.ventas.totalUsd).toBe(0);
      expect(report.kpis.ventas.ordenes).toBe(0);
      expect(report.kpis.ventas.ticketPromedio).toBe(0);
      expect(report.kpis.ventas.vsSemanaAnterior.deltaPct).toBeNull();

      expect(report.kpis.foodCost.consumoUsd).toBe(0);
      expect(report.kpis.foodCost.ventasUsd).toBe(0);
      expect(report.kpis.foodCost.foodCostPct).toBeNull();

      expect(report.kpis.merma.declaradaUsd).toBe(0);
      expect(report.kpis.merma.totalUsd).toBe(0);
      expect(report.kpis.merma.pctSobreCompras).toBeNull();

      expect(report.kpis.compras.totalUsd).toBe(0);
      expect(report.kpis.cobertura.ventasTotal).toBe(0);
      expect(report.kpis.cobertura.pct).toBe(0);
    });
  });

  describe('Caso 5: Upsert — generate dos veces la misma semana → 1 doc actualizado', () => {
    it('debe actualizar el mismo documento cuando se llama generate en la misma semana', async () => {
      const weekStart = new Date('2026-02-02T00:00:00Z');

      // Primera llamada
      const report1 = await service.generate(weekStart);
      const id1 = String(report1._id);

      // Segunda llamada (sin cambios en datos, pero podría haber cambios)
      const report2 = await service.generate(weekStart);
      const id2 = String(report2._id);

      // Deben ser el mismo documento
      expect(id1).toBe(id2);

      // Contar documentos totales: debe haber solo 1
      const count = await module
        .get(getModelToken('WeeklyReport'))
        .countDocuments({ weekStart });

      expect(count).toBe(1);
    });
  });

  describe('Caso 5b: Concurrencia — dos generate() simultáneos para la misma semana', () => {
    it('debe retornar 1 doc (no chocar con upsert) cuando se llama generate() en paralelo', async () => {
      const weekStart = new Date('2026-02-02T00:00:00Z');

      // Lanzar dos generate() simultáneos (Promise.all)
      const [report1, report2] = await Promise.all([
        service.generate(weekStart),
        service.generate(weekStart),
      ]);

      // Deben ser el MISMO documento (misma _id)
      expect(String(report1._id)).toBe(String(report2._id));

      // Verificar que solo existe 1 documento en la BD
      const count = await module
        .get(getModelToken('WeeklyReport'))
        .countDocuments({ weekStart });

      expect(count).toBe(1);
    });
  });

  describe('Caso 6: Costo teórico usa misma expansión de recetas que consumption.service', () => {
    it('debe calcular costo de receta expandida idénticamente a consumption.service', async () => {
      const weekStart = new Date('2026-02-02T00:00:00Z');

      // Crear producto hamburguesa con receta
      await module.get(getModelToken('Product')).create({
        _id: 'prod-burger',
        name: 'Hamburguesa Premium',
        price: 10,
        categoryId: 'cat-platos',
        cost: 0, // No tiene costo directo
        ingredients: [
          {
            productId: 'ing-carne-molida',
            quantity: 150, // gramos
            unit: 'gr',
            wastePercentage: 10, // 10% waste
          },
          {
            productId: 'ing-pan',
            quantity: 1,
            unit: 'und',
            wastePercentage: 0,
          },
        ],
      });

      // Ingrediente 1: carne molida
      // cost=10 USD/kg, presentation=Kilogramo, presentationQuantity=1
      // costPerBaseUnit = 10 / 1 / 1000 = 0.01 por gramo
      // qty_base = 150 * waste(1.1) = 165 gr por hamburguesa vendida
      // costo_ing1 = 165 * 0.01 = 1.65 por hamburguesa
      await module.get(getModelToken('Product')).create({
        _id: 'ing-carne-molida',
        name: 'Carne Molida Premium',
        price: 10,
        categoryId: 'cat-insumos',
        cost: 10,
        presentation: 'Kilogramo',
        presentationQuantity: 1,
        isForInventory: false,
      });

      // Ingrediente 2: pan
      // cost=0.5 USD/unidad, presentation=Unidad, presentationQuantity=1
      // costPerBaseUnit = 0.5 / 1 / 1 = 0.5 por unidad
      // qty_base = 1 * waste(1.0) = 1 und por hamburguesa
      // costo_ing2 = 1 * 0.5 = 0.5 por hamburguesa
      await module.get(getModelToken('Product')).create({
        _id: 'ing-pan',
        name: 'Pan de Hamburguesa',
        price: 0.5,
        categoryId: 'cat-insumos',
        cost: 0.5,
        presentation: 'Unidad',
        presentationQuantity: 1,
        isForInventory: false,
      });

      // Orden: 2 hamburguesas vendidas a 10 USD cada una = 20 USD total
      // Costo teórico: 2 * (1.65 + 0.5) = 2 * 2.15 = 4.30
      await module.get(getModelToken('Order')).create({
        _id: 'order-burger',
        userId: 'user-test',
        subtotal: 20,
        tax: 0,
        total: 20,
        paymentStatus: 'paid',
        createdAt: new Date('2026-02-03T10:00:00Z'),
        items: [
          {
            productId: 'prod-burger',
            name: 'Hamburguesa Premium',
            quantity: 2,
            unitPrice: 10,
            total: 20,
          },
        ],
      });

      const report = await service.generate(weekStart);

      // Verificar que el costo de receta se calculó
      const topVendido = report.kpis.rentabilidad.topVendidos.find(
        (tv) => tv.productId === 'prod-burger',
      );

      expect(topVendido).toBeDefined();
      expect(topVendido!.costoReceta).toBeCloseTo(4.3, 2); // 1.65*2 + 0.5*2
      expect(topVendido!.margenUsd).toBeCloseTo(15.7, 2); // 20 - 4.3
      expect(topVendido!.margenPct).toBeCloseTo(78.5, 1); // 15.7/20*100
    });
  });
});
