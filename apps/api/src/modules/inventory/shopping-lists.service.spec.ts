import { OPERACION_DEFAULT } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { ShoppingListsService } from './shopping-lists.service';
import { weekStartOf } from './units';
import { MovementsService } from './movements.service';
import { PriceHistoryService } from './price-history.service';
import { DeepseekService } from './deepseek.service';
import {
  InventoryMovement,
  InventoryMovementSchema,
} from './schemas/inventory-movement.schema';
import {
  WarehouseStock,
  WarehouseStockSchema,
} from './schemas/warehouse-stock.schema';
import {
  ShoppingList,
  ShoppingListSchema,
} from './schemas/shopping-list.schema';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Supplier, SupplierSchema } from '../suppliers/schemas/supplier.schema';
import {
  PriceHistory,
  PriceHistorySchema,
} from './schemas/price-history.schema';

describe('ShoppingListsService', () => {
  let mongod: MongoMemoryServer;
  let service: ShoppingListsService;
  let priceHistory: PriceHistoryService;
  let connection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: InventoryMovement.name, schema: InventoryMovementSchema },
          { name: WarehouseStock.name, schema: WarehouseStockSchema },
          { name: ShoppingList.name, schema: ShoppingListSchema },
          { name: Warehouse.name, schema: WarehouseSchema },
          { name: Product.name, schema: ProductSchema },
          { name: Supplier.name, schema: SupplierSchema },
          { name: PriceHistory.name, schema: PriceHistorySchema },
        ]),
      ],
      providers: [
        MovementsService,
        PriceHistoryService,
        ShoppingListsService,
        {
          provide: DeepseekService,
          useValue: {
            complete: jest.fn(),
          },
        },
        {
          provide: ConfigsService,
          useValue: { obtener: () => Promise.resolve(OPERACION_DEFAULT) },
        },
      ],
    }).compile();
    service = module.get(ShoppingListsService);
    priceHistory = module.get(PriceHistoryService);
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    // Setup producto base
    await connection.collection('products').insertOne({
      _id: 'P1',
      name: 'Harina',
      price: 0,
      cost: 10,
      presentation: 'Kilogramo',
      presentationQuantity: 1,
      categoryId: 'cat1',
      stock: 0,
      // el sugerido BAJO_MINIMO solo considera insumos de inventario
      isForInventory: true,
      isActive: true,
    });

    // Setup warehouse GENERAL
    await connection.collection('warehouses').insertOne({
      _id: 'W1',
      name: 'Almacén General',
      area: 'GENERAL',
      isDefault: true,
      isActive: true,
    });
  });

  afterEach(async () => {
    const colls = [
      'products',
      'inventory_movements',
      'warehouse_stocks',
      'shopping_lists',
      'warehouses',
      'price_history',
      'suppliers',
    ];
    for (const coll of colls) {
      await connection.collection(coll).deleteMany({});
    }
  });

  it('caso 1: media ponderada 4,3,2,1 calcula suggestedQty correcto (más reciente pesa 4)', async () => {
    // Seed: 4 semanas con consumo progresivo (reciente pesa más)
    // Usar new Date() para que coincida con lo que suggest() usa internamente
    const today = new Date();
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);

    // Semana -4 (más antigua): consumo 400 GR — miércoles de esa semana
    const week4 = new Date(weekStart.getTime() - 4 * 7 * 24 * 3600 * 1000);
    const day4 = new Date(week4.getTime() + 3 * 24 * 3600 * 1000);
    await connection.collection('inventory_movements').insertOne({
      type: 'CONSUMO_VENTA',
      warehouseId: 'W1',
      productId: 'P1',
      qty: -400,
      baseUnit: 'GR',
      unitCost: 0,
      totalCost: 0,
      userId: 'u1',
      createdAt: day4,
      updatedAt: day4,
    });

    // Semana -3: consumo 600 GR
    const week3 = new Date(weekStart.getTime() - 3 * 7 * 24 * 3600 * 1000);
    const day3 = new Date(week3.getTime() + 3 * 24 * 3600 * 1000);
    await connection.collection('inventory_movements').insertOne({
      type: 'CONSUMO_VENTA',
      warehouseId: 'W1',
      productId: 'P1',
      qty: -600,
      baseUnit: 'GR',
      unitCost: 0,
      totalCost: 0,
      userId: 'u1',
      createdAt: day3,
      updatedAt: day3,
    });

    // Semana -2: consumo 800 GR
    const week2 = new Date(weekStart.getTime() - 2 * 7 * 24 * 3600 * 1000);
    const day2 = new Date(week2.getTime() + 3 * 24 * 3600 * 1000);
    await connection.collection('inventory_movements').insertOne({
      type: 'CONSUMO_VENTA',
      warehouseId: 'W1',
      productId: 'P1',
      qty: -800,
      baseUnit: 'GR',
      unitCost: 0,
      totalCost: 0,
      userId: 'u1',
      createdAt: day2,
      updatedAt: day2,
    });

    // Semana -1 (más reciente): consumo 1000 GR — PESA 4
    const week1 = new Date(weekStart.getTime() - 1 * 7 * 24 * 3600 * 1000);
    const day1 = new Date(week1.getTime() + 3 * 24 * 3600 * 1000);
    await connection.collection('inventory_movements').insertOne({
      type: 'CONSUMO_VENTA',
      warehouseId: 'W1',
      productId: 'P1',
      qty: -1000,
      baseUnit: 'GR',
      unitCost: 0,
      totalCost: 0,
      userId: 'u1',
      createdAt: day1,
      updatedAt: day1,
    });

    // Stock actual: 500 GR
    await connection
      .collection('warehouse_stocks')
      .updateOne(
        { warehouseId: 'W1', productId: 'P1' },
        { $set: { qty: 500 } },
        { upsert: true },
      );

    // Suggerir
    const suggested = await service.suggest();

    const item = suggested.find((s) => s.productId === 'P1');
    expect(item).toBeDefined();
    // Media ponderada (más reciente pesa 4): (1000×4 + 800×3 + 600×2 + 400×1) / (4+3+2+1) = 8000/10 = 800
    // suggestedQty = 800 × 1.15 - 500 = 920 - 500 = 420
    expect(item?.suggestedQty).toBe(420);
    expect(item?.reason).toBe('CONSUMO_PROMEDIO');
  });

  it('caso 2: solo 2 semanas con datos → pesos 4,3 normalizado (más reciente pesa 4)', async () => {
    // Usar new Date() para que coincida con lo que suggest() usa
    const today = new Date();
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);

    // Semana -2: consumo 800 GR
    const week2 = new Date(weekStart.getTime() - 2 * 7 * 24 * 3600 * 1000);
    const day2 = new Date(week2.getTime() + 3 * 24 * 3600 * 1000);
    await connection.collection('inventory_movements').insertOne({
      type: 'CONSUMO_VENTA',
      warehouseId: 'W1',
      productId: 'P1',
      qty: -800,
      baseUnit: 'GR',
      unitCost: 0,
      totalCost: 0,
      userId: 'u1',
      createdAt: day2,
      updatedAt: day2,
    });

    // Semana -1 (más reciente): consumo 1000 GR — PESA 4
    const week1 = new Date(weekStart.getTime() - 1 * 7 * 24 * 3600 * 1000);
    const day1 = new Date(week1.getTime() + 3 * 24 * 3600 * 1000);
    await connection.collection('inventory_movements').insertOne({
      type: 'CONSUMO_VENTA',
      warehouseId: 'W1',
      productId: 'P1',
      qty: -1000,
      baseUnit: 'GR',
      unitCost: 0,
      totalCost: 0,
      userId: 'u1',
      createdAt: day1,
      updatedAt: day1,
    });

    // Stock: 500
    await connection
      .collection('warehouse_stocks')
      .updateOne(
        { warehouseId: 'W1', productId: 'P1' },
        { $set: { qty: 500 } },
        { upsert: true },
      );

    const suggested = await service.suggest();
    const item = suggested.find((s) => s.productId === 'P1');

    // Media (más reciente pesa 4): (1000×4 + 800×3) / (4+3) = (4000 + 2400) / 7 ≈ 914.29
    // suggestedQty = 914.29 × 1.15 - 500 ≈ 1051.44 - 500 ≈ 551.44 → roundQty ≈ 551
    expect(item).toBeDefined();
    // Permitir pequeña tolerancia de redondeo
    expect(Math.abs(item!.suggestedQty - 551)).toBeLessThan(2);
  });

  it('caso 2b: test asimétrico captura semántica (reciente pesa más que vieja)', async () => {
    // Consumo ASIMÉTRICO: 1000 GR SOLO en la semana más reciente, 100 GR SOLO en la más vieja
    // Si los pesos estuvieran invertidos el resultado sería muy diferente.
    // Stock 0, colchón 15%.
    const today = new Date();
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);

    // Semana -4 (más antigua): consumo 100 GR
    const week4 = new Date(weekStart.getTime() - 4 * 7 * 24 * 3600 * 1000);
    const day4 = new Date(week4.getTime() + 3 * 24 * 3600 * 1000);
    await connection.collection('inventory_movements').insertOne({
      type: 'CONSUMO_VENTA',
      warehouseId: 'W1',
      productId: 'P1',
      qty: -100,
      baseUnit: 'GR',
      unitCost: 0,
      totalCost: 0,
      userId: 'u1',
      createdAt: day4,
      updatedAt: day4,
    });

    // Semanas -3 y -2: sin consumo

    // Semana -1 (más reciente): consumo 1000 GR
    const week1 = new Date(weekStart.getTime() - 1 * 7 * 24 * 3600 * 1000);
    const day1 = new Date(week1.getTime() + 3 * 24 * 3600 * 1000);
    await connection.collection('inventory_movements').insertOne({
      type: 'CONSUMO_VENTA',
      warehouseId: 'W1',
      productId: 'P1',
      qty: -1000,
      baseUnit: 'GR',
      unitCost: 0,
      totalCost: 0,
      userId: 'u1',
      createdAt: day1,
      updatedAt: day1,
    });

    // Stock: 0 GR
    await connection
      .collection('warehouse_stocks')
      .updateOne(
        { warehouseId: 'W1', productId: 'P1' },
        { $set: { qty: 0 } },
        { upsert: true },
      );

    const suggested = await service.suggest();
    const item = suggested.find((s) => s.productId === 'P1');

    // Media ponderada (más reciente pesa 4, se normaliza por suma de pesos usados):
    // Semana -1 (reciente): 1000 GR, peso 4
    // Semana -4 (vieja): 100 GR, peso 3 (de [4,3] — solo 2 semanas tienen datos)
    // Media = (1000×4 + 100×3) / (4+3) = 4300/7 ≈ 614.29
    // suggestedQty = roundQty(614.29 × 1.15 - 0) ≈ 706
    // Si los pesos estuvieran invertidos: (1000×3 + 100×4) / 7 = 3400/7 ≈ 486 (muy diferente)
    expect(item).toBeDefined();
    expect(Math.abs(item!.suggestedQty - 706)).toBeLessThan(2);
    expect(item?.reason).toBe('CONSUMO_PROMEDIO');
  });

  it('caso 3: suggestedQty ≤ 0 → no aparece (salvo BAJO_MINIMO)', async () => {
    const today = new Date('2026-02-14');
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);

    // Poquísimo consumo: 10 GR en última semana
    const week1 = new Date(weekStart.getTime() - 1 * 7 * 24 * 3600 * 1000);
    const day1 = new Date(week1.getTime() + 3 * 24 * 3600 * 1000);
    await connection.collection('inventory_movements').insertOne({
      type: 'CONSUMO_VENTA',
      warehouseId: 'W1',
      productId: 'P1',
      qty: -10,
      baseUnit: 'GR',
      unitCost: 0,
      totalCost: 0,
      userId: 'u1',
      createdAt: day1,
      updatedAt: day1,
    });

    // Stock muy alto: 10000 GR (suficiente para varias semanas)
    await connection
      .collection('warehouse_stocks')
      .updateOne(
        { warehouseId: 'W1', productId: 'P1' },
        { $set: { qty: 10000 } },
        { upsert: true },
      );

    const suggested = await service.suggest();
    const item = suggested.find((s) => s.productId === 'P1');

    // Media: 10, con colchón: 10 × 1.15 = 11.5, sugerido = 11.5 - 10000 = -9988.5 → round ≈ -9989
    // Debe ser < 0, no aparece
    expect(item).toBeUndefined();
  });

  it('caso 4: BAJO_MINIMO con minStock 10 y stock 4 → suggestedQty = 6', async () => {
    await connection
      .collection('products')
      .updateOne({ _id: 'P1' }, { $set: { minStock: 10 } });

    // Stock: 4 GR
    await connection.collection('warehouse_stocks').insertOne({
      _id: 'WS1',
      warehouseId: 'W1',
      productId: 'P1',
      qty: 4,
    });

    const suggested = await service.suggest();
    const item = suggested.find((s) => s.productId === 'P1');

    expect(item).toBeDefined();
    expect(item?.suggestedQty).toBe(6);
    expect(item?.reason).toBe('BAJO_MINIMO');
  });

  it('caso 5: propose consolida dos estaciones en un solo item', async () => {
    const dto = {
      station: 'COCINA',
      items: [
        { productId: 'P1', quantity: 0.3, unit: 'kg' }, // 300 GR
      ],
    };

    const list1 = await service.propose(dto, 'user1');
    expect(list1.items).toHaveLength(1);
    expect(list1.items[0].suggestedQty).toBe(300);
    expect(list1.items[0].proposedByStation).toBe('COCINA');

    // Segunda propuesta del mismo producto, otra estación
    const dto2 = {
      station: 'BARRA',
      items: [
        { productId: 'P1', quantity: 0.2, unit: 'kg' }, // 200 GR
      ],
    };

    const list2 = await service.propose(dto2, 'user2');
    expect(list2.items).toHaveLength(1);
    // Consolidado: 300 + 200 = 500
    expect(list2.items[0].suggestedQty).toBe(500);
    // Mantiene la estación del primero
    expect(list2.items[0].proposedByStation).toBe('COCINA');
    expect(list2.proposedBy).toContain('user1');
    expect(list2.proposedBy).toContain('user2');
  });

  it('caso 6: markPurchased marca items de lista APROBADA', async () => {
    // Usar la misma lógica que markPurchased() para garantizar que weekStart coincida
    const today = new Date();
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    // Crear lista aprobada
    const list = await connection.collection('shopping_lists').insertOne({
      _id: 'list1',
      weekStart,
      weekEnd,
      status: 'APROBADA',
      items: [
        {
          productId: 'P1',
          productName: 'Harina',
          suggestedQty: 500,
          unit: 'GR',
          reason: 'CONSUMO_PROMEDIO',
          purchased: false,
          discarded: false,
        },
      ],
      proposedBy: [],
      approvedBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.markPurchased(['P1'], 'purchase1');
    expect(result.marked).toBe(1);
    expect(result.listId).toBe('list1');

    const updated = await connection.collection('shopping_lists').findOne({
      _id: 'list1',
    });
    expect(updated.items[0].purchased).toBe(true);
    expect(updated.items[0].purchaseId).toBe('purchase1');
  });

  it('caso 6b: markPurchased lista PROPUESTA → marked = 0', async () => {
    const today = new Date('2026-02-14');
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    // Crear lista propuesta (no aprobada)
    await connection.collection('shopping_lists').insertOne({
      _id: 'list1',
      weekStart,
      weekEnd,
      status: 'PROPUESTA',
      items: [
        {
          productId: 'P1',
          productName: 'Harina',
          suggestedQty: 500,
          unit: 'GR',
          reason: 'CONSUMO_PROMEDIO',
          purchased: false,
          discarded: false,
        },
      ],
      proposedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.markPurchased(['P1'], 'purchase1');
    expect(result.marked).toBe(0);
  });

  it('caso 7: approve PROPUESTA → APROBADA', async () => {
    const today = new Date('2026-02-14');
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    const list = await connection.collection('shopping_lists').insertOne({
      _id: 'list1',
      weekStart,
      weekEnd,
      status: 'PROPUESTA',
      items: [],
      proposedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const approved = await service.approve('list1', 'admin');
    expect(approved.status).toBe('APROBADA');
    expect(approved.approvedBy).toBe('admin');
  });

  it('caso 7b: approve CERRADA → 400 error', async () => {
    const today = new Date('2026-02-14');
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    await connection.collection('shopping_lists').insertOne({
      _id: 'list1',
      weekStart,
      weekEnd,
      status: 'CERRADA',
      items: [],
      proposedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.approve('list1', 'admin')).rejects.toThrow(
      'No se puede aprobar una lista cerrada',
    );
  });

  it('caso 8: nueva semana cierra la anterior', async () => {
    const today = new Date('2026-02-14'); // sábado semana 1
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    // Crear lista de semana actual (PROPUESTA)
    const list1 = await connection.collection('shopping_lists').insertOne({
      _id: 'list1',
      weekStart,
      weekEnd,
      status: 'PROPUESTA',
      items: [],
      proposedBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Simular aprobación de semana pasada (hace 7 días)
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 3600 * 1000);
    const prevWeekEnd = new Date(
      prevWeekStart.getTime() + 7 * 24 * 3600 * 1000,
    );
    const prevList = await connection.collection('shopping_lists').insertOne({
      _id: 'list0',
      weekStart: prevWeekStart,
      weekEnd: prevWeekEnd,
      status: 'APROBADA',
      items: [],
      proposedBy: [],
      approvedBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Ahora aprobar la lista actual
    const approved = await service.approve('list1', 'admin');
    expect(approved.status).toBe('APROBADA');

    // Verificar que lista anterior se cerró
    const prevListUpdated = await connection
      .collection('shopping_lists')
      .findOne({
        _id: 'list0',
      });
    expect(prevListUpdated.status).toBe('CERRADA');
  });

  // ========== Tests para buildAiPlan (Task 4) ==========

  it('(a) buildAiPlan agrupa correctamente con price_history en 2 lugares', async () => {
    // Setup: 2 proveedores (lugares)
    await connection.collection('suppliers').insertMany([
      { _id: 'supp1', name: 'Proveedor A', isActive: true },
      { _id: 'supp2', name: 'Proveedor B', isActive: true },
    ]);

    // Setup: 2 productos con presentation=Kilogramo
    await connection.collection('products').insertMany([
      {
        _id: 'P2',
        name: 'Aceite',
        price: 0,
        cost: 50,
        presentation: 'Kilogramo',
        presentationQuantity: 1,
        categoryId: 'cat1',
        stock: 0,
        isForInventory: true,
        isActive: true,
      },
      {
        _id: 'P3',
        name: 'Sal',
        price: 0,
        cost: 5,
        presentation: 'Kilogramo',
        presentationQuantity: 1,
        categoryId: 'cat1',
        stock: 0,
        isForInventory: true,
        isActive: true,
      },
    ]);

    // Seed price_history: P2 en 2 lugares, P3 en 1 lugar
    const today = new Date();
    const phResult = await connection.collection('price_history').insertMany([
      // P2 en Proveedor B: costo 50 (mejor, más antiguo)
      {
        productId: 'P2',
        unitCost: 50,
        placeId: 'supp2',
        purchaseId: 'pur1',
        date: new Date(today.getTime() - 2 * 24 * 3600 * 1000),
      },
      // P2 en Proveedor A: costo 55 (último, más caro) — bestPlaces devolverá hint
      {
        productId: 'P2',
        unitCost: 55,
        placeId: 'supp1',
        purchaseId: 'pur2',
        date: new Date(today.getTime() - 1 * 24 * 3600 * 1000),
      },
      // P3 en Proveedor A: costo 6 (único lugar, sin hint pero sí historial)
      {
        productId: 'P3',
        unitCost: 6,
        placeId: 'supp1',
        purchaseId: 'pur3',
        date: new Date(today.getTime() - 1 * 24 * 3600 * 1000),
      },
    ]);

    // Verificar que la semilla se insertó
    const seedCheck = await connection
      .collection('price_history')
      .countDocuments();
    expect(seedCheck).toBe(3);

    // Crear shopping list con items
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
    await connection.collection('shopping_lists').insertOne({
      _id: 'testlist1',
      weekStart,
      weekEnd,
      status: 'PROPUESTA',
      items: [
        {
          productId: 'P2',
          productName: 'Aceite',
          suggestedQty: 1000, // 1 kg en GR
          unit: 'GR',
          reason: 'CONSUMO_PROMEDIO',
          purchased: false,
          discarded: false,
        },
        {
          productId: 'P3',
          productName: 'Sal',
          suggestedQty: 500, // 0.5 kg en GR
          unit: 'GR',
          reason: 'CONSUMO_PROMEDIO',
          purchased: false,
          discarded: false,
        },
      ],
      proposedBy: [],
      createdAt: today,
      updatedAt: today,
    });

    // Mock DeepSeek
    const deepseekServiceMock = service['deepseek'] as {
      complete: jest.Mock;
    };
    deepseekServiceMock.complete.mockResolvedValue({
      text: 'Plan de compra resumido.',
      error: null,
    });

    // Ejecutar
    const result = await service.buildAiPlan('testlist1');

    // Verificar
    expect(result.aiPlanByPlace).toBeDefined();
    const plan = result.aiPlanByPlace as Array<{
      placeId: string | null;
      placeName: string;
      items: Array<{
        productId: string;
        qty: number;
        lastCost: number;
      }>;
      estimatedTotal: number;
      savingsVsWorst: number;
    }>;

    // P2: último en supp1 (55), mejor en supp2 (50) → hint enviará a supp2
    // P3: solo en supp1 (6) → va a supp1 por historial
    expect(plan).toHaveLength(2);

    const groupB = plan.find((g) => g.placeId === 'supp2');
    expect(groupB).toBeDefined();
    expect(groupB!.placeName).toBe('Proveedor B');
    expect(groupB!.items).toHaveLength(1);
    expect(groupB!.items[0].productId).toBe('P2');
    expect(groupB!.items[0].lastCost).toBe(50);
    expect(groupB!.estimatedTotal).toBe(50000); // 1000 × 50
    expect(groupB!.savingsVsWorst).toBe(5000); // (55 - 50) × 1000

    const groupA = plan.find((g) => g.placeId === 'supp1');
    expect(groupA).toBeDefined();
    expect(groupA!.placeName).toBe('Proveedor A');
    expect(groupA!.items).toHaveLength(1);
    expect(groupA!.items[0].productId).toBe('P3');
    expect(groupA!.items[0].lastCost).toBe(6);
    expect(groupA!.estimatedTotal).toBe(3000); // 500 × 6
    expect(groupA!.savingsVsWorst).toBe(0); // sin hint (único lugar)

    expect(result.aiSummary).toBe('Plan de compra resumido.');
    expect(result.aiError).toBeNull();
  });

  it('(b) buildAiPlan sin historial → todo en "Donde prefieras"', async () => {
    // Setup: producto SIN historial de precios
    await connection.collection('products').insertOne({
      _id: 'P4',
      name: 'Especias',
      price: 0,
      cost: 10,
      presentation: 'Kilogramo',
      presentationQuantity: 1,
      categoryId: 'cat1',
      stock: 0,
      isForInventory: true,
      isActive: true,
    });

    // SIN price_history para P4

    // Crear shopping list
    const today = new Date();
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
    await connection.collection('shopping_lists').insertOne({
      _id: 'testlist2',
      weekStart,
      weekEnd,
      status: 'PROPUESTA',
      items: [
        {
          productId: 'P4',
          productName: 'Especias',
          suggestedQty: 100,
          unit: 'GR',
          reason: 'BAJO_MINIMO',
          purchased: false,
          discarded: false,
        },
      ],
      proposedBy: [],
      createdAt: today,
      updatedAt: today,
    });

    const deepseekServiceMock = service['deepseek'] as {
      complete: jest.Mock;
    };
    deepseekServiceMock.complete.mockResolvedValue({
      text: 'Compra según disponibilidad.',
    });

    // Ejecutar
    const result = await service.buildAiPlan('testlist2');

    // Verificar
    const plan = result.aiPlanByPlace as Array<{
      placeId: string | null;
      placeName: string;
      items: Array<{ productId: string; qty: number }>;
    }>;
    expect(plan).toHaveLength(1);
    expect(plan[0].placeId).toBeNull();
    expect(plan[0].placeName).toBe('Donde prefieras');
    expect(plan[0].items).toHaveLength(1);
    expect(plan[0].items[0].productId).toBe('P4');
  });

  it('(c) buildAiPlan sin API key → plan duro guardado, aiSummary null, aiError seteado', async () => {
    // Setup: producto
    await connection.collection('products').insertOne({
      _id: 'P5',
      name: 'Limón',
      price: 0,
      cost: 2,
      presentation: 'Kilogramo',
      presentationQuantity: 1,
      categoryId: 'cat1',
      stock: 0,
      isForInventory: true,
      isActive: true,
    });

    // Crear shopping list
    const today = new Date();
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
    await connection.collection('shopping_lists').insertOne({
      _id: 'testlist3',
      weekStart,
      weekEnd,
      status: 'PROPUESTA',
      items: [
        {
          productId: 'P5',
          productName: 'Limón',
          suggestedQty: 200,
          unit: 'GR',
          reason: 'CONSUMO_PROMEDIO',
          purchased: false,
          discarded: false,
        },
      ],
      proposedBy: [],
      createdAt: today,
      updatedAt: today,
    });

    // Mock DeepSeek: simular error (sin API key)
    const deepseekServiceMock = service['deepseek'] as {
      complete: jest.Mock;
    };
    deepseekServiceMock.complete.mockResolvedValue({
      text: null,
      error: 'DEEPSEEK_API_KEY no configurada',
    });

    // Ejecutar
    const result = await service.buildAiPlan('testlist3');

    // Verificar
    expect(result.aiPlanByPlace).toBeDefined();
    expect((result.aiPlanByPlace as Array<unknown>).length).toBeGreaterThan(0);
    expect(result.aiSummary).toBeNull();
    expect(result.aiError).toBe('DEEPSEEK_API_KEY no configurada');
  });

  it('(d) buildAiPlan excluye items descartados', async () => {
    // Setup: 2 productos
    await connection.collection('products').insertMany([
      {
        _id: 'P6',
        name: 'Tomate',
        price: 0,
        cost: 3,
        presentation: 'Kilogramo',
        presentationQuantity: 1,
        categoryId: 'cat1',
        stock: 0,
        isForInventory: true,
        isActive: true,
      },
      {
        _id: 'P7',
        name: 'Cebolla',
        price: 0,
        cost: 2,
        presentation: 'Kilogramo',
        presentationQuantity: 1,
        categoryId: 'cat1',
        stock: 0,
        isForInventory: true,
        isActive: true,
      },
    ]);

    // Setup: suppliers
    await connection.collection('suppliers').insertOne({
      _id: 'supp3',
      name: 'Mercado Local',
      isActive: true,
    });

    // Crear shopping list con 1 item descartado, 1 activo
    const today = new Date();
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
    await connection.collection('shopping_lists').insertOne({
      _id: 'testlist4',
      weekStart,
      weekEnd,
      status: 'PROPUESTA',
      items: [
        {
          productId: 'P6',
          productName: 'Tomate',
          suggestedQty: 300,
          unit: 'GR',
          reason: 'CONSUMO_PROMEDIO',
          purchased: false,
          discarded: true, // DESCARTADO
        },
        {
          productId: 'P7',
          productName: 'Cebolla',
          suggestedQty: 200,
          unit: 'GR',
          reason: 'CONSUMO_PROMEDIO',
          purchased: false,
          discarded: false, // ACTIVO
        },
      ],
      proposedBy: [],
      createdAt: today,
      updatedAt: today,
    });

    const deepseekServiceMock = service['deepseek'] as {
      complete: jest.Mock;
    };
    deepseekServiceMock.complete.mockResolvedValue({
      text: 'Solo cebolla esta semana.',
    });

    // Ejecutar
    const result = await service.buildAiPlan('testlist4');

    // Verificar: solo P7 debe estar en el plan
    const plan = result.aiPlanByPlace as Array<{
      items: Array<{ productId: string }>;
    }>;
    const allItems = plan.flatMap((g) => g.items);
    expect(allItems).toHaveLength(1);
    expect(allItems[0].productId).toBe('P7');
  });

  it('buildAiPlan lista CERRADA → 400 error', async () => {
    const today = new Date();
    const weekStart = weekStartOf(today, OPERACION_DEFAULT);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

    await connection.collection('shopping_lists').insertOne({
      _id: 'testlist5',
      weekStart,
      weekEnd,
      status: 'CERRADA',
      items: [],
      proposedBy: [],
      createdAt: today,
      updatedAt: today,
    });

    await expect(service.buildAiPlan('testlist5')).rejects.toThrow(
      'No se puede generar plan para una lista cerrada',
    );
  });

  it('buildAiPlan lista no existe → 404', async () => {
    await expect(service.buildAiPlan('nonexistent')).rejects.toThrow(
      'Lista nonexistent no encontrada',
    );
  });
});
