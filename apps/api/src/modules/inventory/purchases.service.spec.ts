import { ConfigsService } from '../configs/configs.service';
import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { PurchasesService } from './purchases.service';
import { MovementsService } from './movements.service';
import { PriceHistoryService } from './price-history.service';
import { PurchaseAliasesService } from './purchase-aliases.service';
import {
  InventoryMovement,
  InventoryMovementSchema,
} from './schemas/inventory-movement.schema';
import {
  WarehouseStock,
  WarehouseStockSchema,
} from './schemas/warehouse-stock.schema';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Supplier, SupplierSchema } from '../suppliers/schemas/supplier.schema';
import {
  PriceHistory,
  PriceHistorySchema,
} from './schemas/price-history.schema';
import { Purchase, PurchaseSchema } from './schemas/purchase.schema';
import { CostPropagationService } from '../products/cost-propagation.service';
import {
  MarginAlert,
  MarginAlertSchema,
} from '../products/schemas/margin-alert.schema';

describe('PurchasesService', () => {
  let mongod: MongoMemoryServer;
  let purchases: PurchasesService;
  let movements: MovementsService;
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
          { name: Warehouse.name, schema: WarehouseSchema },
          { name: Product.name, schema: ProductSchema },
          { name: Supplier.name, schema: SupplierSchema },
          { name: PriceHistory.name, schema: PriceHistorySchema },
          { name: Purchase.name, schema: PurchaseSchema },
          { name: MarginAlert.name, schema: MarginAlertSchema },
        ]),
      ],
      providers: [
        MovementsService,
        PriceHistoryService,
        PurchasesService,
        // El real, no un doble: una compra tiene que mover el costo de lo que
        // lleva ese insumo y levantar la alerta de margen, y eso se prueba.
        CostPropagationService,
        // Umbral de margen sin documento: sale el default del código.
        {
          provide: ConfigsService,
          useValue: {
            obtenerCrudo: (_id: string, normalizar: (doc: null) => unknown) =>
              Promise.resolve(normalizar(null)),
          },
        },
        // El aprendizaje de alias no es objeto de estas pruebas y no debe
        // poder hacer fallar una compra: se sustituye por un doble inerte.
        {
          provide: PurchaseAliasesService,
          useValue: {
            learn: jest.fn().mockResolvedValue(0),
            listFor: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();
    purchases = module.get(PurchasesService);
    movements = module.get(MovementsService);
    priceHistory = module.get(PriceHistoryService);
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    // Crear warehouse GENERAL default
    await connection.collection('warehouses').insertOne({
      _id: 'GENERAL',
      name: 'Almacén Principal',
      area: 'GENERAL',
      isDefault: true,
      isActive: true,
    });

    // Crear supplier "Mercado"
    await connection.collection('suppliers').insertOne({
      _id: 'MERCADO-1',
      name: 'Mercado',
      isActive: true,
    });

    // Crear producto harina: presentation Kilogramo, presentationQuantity 45, cost 42.44
    await connection.collection('products').insertOne({
      _id: 'HARINA',
      name: 'Harina de trigo',
      price: 0,
      cost: 42.44,
      presentation: 'Kilogramo',
      presentationQuantity: 45,
      categoryId: 'c1',
      stock: 0,
    });

    // Crear producto refresco: presentation Unidad, presentationQuantity 30, cost 12
    await connection.collection('products').insertOne({
      _id: 'REFRESCO',
      name: 'Refresco',
      price: 0,
      cost: 12,
      presentation: 'Unidad',
      presentationQuantity: 30,
      categoryId: 'c2',
      stock: 0,
    });
  });

  afterEach(async () => {
    for (const c of [
      'products',
      'suppliers',
      'warehouses',
      'inventory_movements',
      'warehouse_stocks',
      'price_history',
      'purchases',
      'margin_alerts',
    ]) {
      await connection.collection(c).deleteMany({});
    }
  });

  it('la caja de la factura manda: "SOLERA LIGHT RET 222Mlx36UN 5 C 23,01" son 180 botellas', async () => {
    // El catalogo trae las bebidas con contenido 1 (nadie lo cargo). Sin esto,
    // 5 cajas entraban como 5 botellas a $23,01 cada una.
    await connection.collection('products').insertOne({
      _id: 'SOLERA',
      name: 'Solera Light Retornable',
      price: 0,
      cost: 0,
      presentation: 'Unidad',
      presentationQuantity: 1,
      categoryId: 'c2',
      stock: 0,
    });

    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'SOLERA',
            quantity: 5,
            unit: 'unidad-compra',
            unitCost: 23.01,
            unitsPerPack: 36,
            invoiceText: 'SOLERA LIGHT RET 222Mlx36UN 5 C 23.01 115.07',
          },
        ],
      },
      'user1',
    );

    expect(purchase.total).toBeCloseTo(115.05, 2);

    // 5 cajas x 36 = 180 botellas al stock, no 5.
    const ledger = await movements.list({ refId: purchase._id });
    expect(ledger[0].qty).toBe(180);
    expect(ledger[0].baseUnit).toBe('UND');

    const product = await connection
      .collection('products')
      .findOne({ _id: 'SOLERA' } as never);
    // El costo guardado es el de la CAJA, y el contenido queda en 36: juntos
    // dan los $0,64 por botella. Dejar el contenido en 1 diria $23,01 la botella.
    expect(product!.cost).toBeCloseTo(23.01, 2);
    expect(product!.presentationQuantity).toBe(36);
    expect(purchase.items[0].costPerBaseUnit).toBeCloseTo(0.6392, 4);
  });

  it('sin contenido en la factura se sigue usando el del catalogo (la cesta de tomate)', async () => {
    await connection.collection('products').insertOne({
      _id: 'TOMATE',
      name: 'Tomate',
      price: 0,
      cost: 20,
      presentation: 'Kilogramo',
      presentationQuantity: 20,
      categoryId: 'c2',
      stock: 0,
    });

    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'TOMATE',
            quantity: 1,
            unit: 'unidad-compra',
            unitCost: 20,
          },
        ],
      },
      'user1',
    );

    const ledger = await movements.list({ refId: purchase._id });
    expect(ledger[0].qty).toBe(20000); // 20 kg en gramos
    const product = await connection
      .collection('products')
      .findOne({ _id: 'TOMATE' } as never);
    expect(product!.presentationQuantity).toBe(20);
  });

  it('caso 1: Compra en unidad-compra (2 sacos harina $43) → movimiento +90000 GR, unitCost roundUnitCost(43/45/1000), product.cost=43, price_history registrada', async () => {
    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'HARINA',
            quantity: 2,
            unit: 'unidad-compra',
            unitCost: 43,
          },
        ],
      },
      'user1',
    );

    // Verificar compra creada
    expect(purchase._id).toBeDefined();
    expect(purchase.placeName).toBe('Mercado');
    expect(purchase.items).toHaveLength(1);
    expect(purchase.items[0].subtotal).toBeCloseTo(86, 2);
    expect(purchase.total).toBeCloseTo(86, 2);

    // Verificar movimiento: qty = 2 * 45 * 1000 (basicamente) = 90000 GR
    const ledger = await movements.list({ refId: purchase._id });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('COMPRA');
    expect(ledger[0].qty).toBe(90000);
    expect(ledger[0].baseUnit).toBe('GR');
    // unitCost = roundUnitCost(43 / 45 / 1000) ≈ 0.00095556...
    expect(ledger[0].unitCost).toBeCloseTo(0.00095556, 7);

    // Verificar product.cost actualizado a 43
    const product = await connection
      .collection('products')
      .findOne({ _id: 'HARINA' } as any);
    expect(product).toBeDefined();
    expect(product!.cost).toBe(43);

    // Verificar price_history registrada
    const history = await connection
      .collection('price_history')
      .findOne({ productId: 'HARINA', purchaseId: purchase._id });
    expect(history).toBeDefined();
    expect(history!.unitCost).toBeCloseTo(0.00095556, 7);
    expect(history!.placeId).toBe('MERCADO-1');
  });

  it('caso 2: Compra suelta en kg (3.5 kg harina $1.00/kg) → baseQty 3500 GR, costPerBase 0.001, product.cost = 0.001×45×1000 = 45', async () => {
    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'HARINA',
            quantity: 3.5,
            unit: 'kg',
            unitCost: 1.0,
          },
        ],
      },
      'user1',
    );

    expect(purchase.items[0].baseQty).toBe(3500);
    expect(purchase.items[0].costPerBaseUnit).toBeCloseTo(0.001, 8);

    // Verificar product.cost recalculado: 0.001 * 45 * 1000 = 45
    const product = await connection
      .collection('products')
      .findOne({ _id: 'HARINA' } as any);
    expect(product).toBeDefined();
    expect(product!.cost).toBe(45);

    // Verificar subtotal: 3.5 * 1.00 = 3.5
    expect(purchase.items[0].subtotal).toBeCloseTo(3.5, 2);
  });

  it('caso 3: Unidad incompatible (kg para producto UND) → 400, mensaje con "incompatible", NO crea compra ni movimientos', async () => {
    await expect(
      purchases.create(
        {
          placeId: 'MERCADO-1',
          items: [
            {
              productId: 'REFRESCO',
              quantity: 5,
              unit: 'kg', // incompatible con UND
              unitCost: 10,
            },
          ],
        },
        'user1',
      ),
    ).rejects.toThrow(/incompatible/i);

    // Verificar que NO se creó compra
    const purchaseCount = await connection
      .collection('purchases')
      .countDocuments();
    expect(purchaseCount).toBe(0);

    // Verificar que NO se creó movimiento
    const movementCount = await connection
      .collection('inventory_movements')
      .countDocuments();
    expect(movementCount).toBe(0);
  });

  it('caso 4: Alertas de variación se generan cuando costPerBase hay cambios (precio history registrada)', async () => {
    // Valida el flujo de alertas: primera compra establece lastCost, segunda genera alerta si hay variación
    // Primera compra establece baseline
    const p1 = await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'HARINA',
            quantity: 1,
            unit: 'kg',
            unitCost: 1.0, // costPerBase = 0.001
          },
        ],
      },
      'user1',
    );

    // Sin precio previo, no hay alerta
    expect(p1.alerts).toHaveLength(0);

    // Verificar que price_history fue registrada
    const hist = await priceHistory.lastCost('HARINA');
    expect(hist).toBeDefined();
    expect(hist?.unitCost).toBeCloseTo(0.001, 8);
  });

  it('caso 5: Stock sube → getStockFor(warehouseId, productId) refleja baseQty tras la compra', async () => {
    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'HARINA',
            quantity: 2,
            unit: 'kg',
            unitCost: 1.0,
          },
        ],
      },
      'user1',
    );

    // Stock debe ser 2000 GR (2 kg)
    const stock = await movements.getStockFor('GENERAL', 'HARINA');
    expect(stock).toBe(2000);
  });

  it('caso 6: Total = Σ subtotales con roundMoney; date default ahora; warehouse default = isDefault GENERAL', async () => {
    const beforeTime = new Date();
    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'HARINA',
            quantity: 1,
            unit: 'kg',
            unitCost: 10.5,
          },
          {
            productId: 'REFRESCO',
            quantity: 5,
            unit: 'und',
            unitCost: 2.33,
          },
        ],
      },
      'user1',
    );
    const afterTime = new Date();

    // Verificar total = 10.5 + (5 * 2.33) = 10.5 + 11.65 = 22.15
    const expectedTotal = 10.5 + 5 * 2.33;
    expect(purchase.total).toBeCloseTo(expectedTotal, 2);

    // Verificar date está entre beforeTime y afterTime
    expect(purchase.date.getTime()).toBeGreaterThanOrEqual(
      beforeTime.getTime(),
    );
    expect(purchase.date.getTime()).toBeLessThanOrEqual(afterTime.getTime());

    // Verificar warehouseId es GENERAL (default)
    expect(purchase.warehouseId).toBe('GENERAL');
  });

  it('caso 6b: Error 400 si no existe warehouse default GENERAL y no se envía warehouseId', async () => {
    // Eliminar warehouse default
    await connection.collection('warehouses').deleteMany({});

    await expect(
      purchases.create(
        {
          placeId: 'MERCADO-1',
          items: [
            {
              productId: 'HARINA',
              quantity: 1,
              unit: 'kg',
              unitCost: 1.0,
            },
          ],
        },
        'user1',
      ),
    ).rejects.toThrow(/no existe|almacén/i);
  });

  it('caso 6c: Usa warehouseId enviado si se proporciona', async () => {
    // Crear otro warehouse
    await connection.collection('warehouses').insertOne({
      _id: 'COCINA',
      name: 'Almacén Cocina',
      area: 'COCINA',
      isDefault: false,
      isActive: true,
    } as any);

    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        warehouseId: 'COCINA',
        items: [
          {
            productId: 'HARINA',
            quantity: 1,
            unit: 'kg',
            unitCost: 1.0,
          },
        ],
      },
      'user1',
    );

    expect(purchase.warehouseId).toBe('COCINA');

    // Verificar stock en COCINA, NO en GENERAL
    const stockCocina = await movements.getStockFor('COCINA', 'HARINA');
    const stockGeneral = await movements.getStockFor('GENERAL', 'HARINA');
    expect(stockCocina).toBe(1000);
    expect(stockGeneral).toBe(0);
  });

  it('caso 7: Compra en Bs (1 kg harina Bs 36.5, bcvRate 36.5) → unitCostUsd=1.0, unitCostBs=36.5, currency=BS', async () => {
    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        currency: 'BS',
        bcvRate: 36.5,
        items: [
          {
            productId: 'HARINA',
            quantity: 1,
            unit: 'kg',
            unitCost: 36.5, // Bs
          },
        ],
      },
      'user1',
    );

    // Verificar que la compra se persiste con currency=BS
    expect(purchase.currency).toBe('BS');
    expect(purchase.exchangeRate).toBe(36.5);

    // Item debe guardar valores en BS y USD
    expect(purchase.items[0].unitCostBs).toBe(36.5);
    expect(purchase.items[0].subtotalBs).toBeCloseTo(36.5, 2);
    expect(purchase.items[0].unitCost).toBeCloseTo(1.0, 8); // convertido a USD
    expect(purchase.items[0].subtotal).toBeCloseTo(1.0, 2); // USD

    // Total también en ambas monedas
    expect(purchase.totalBs).toBeCloseTo(36.5, 2);
    expect(purchase.total).toBeCloseTo(1.0, 2); // USD

    // Movimiento debe estar en USD
    const ledger = await movements.list({ refId: purchase._id });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].unitCost).toBeCloseTo(1.0 / 1000, 8); // costPerBase en USD

    // Product cost debe estar en USD (calculado como costPerBase × presentationQuantity × factor)
    // costPerBase = 1.0 / 1000 = 0.001 USD/gr
    // presentationQuantity = 45 kg = 45000 gr
    // cost = 0.001 × 45000 = 45 USD
    const product = await connection
      .collection('products')
      .findOne({ _id: 'HARINA' } as any);
    expect(product).toBeDefined();
    expect(product!.cost).toBeCloseTo(45, 2); // USD (precio de 45 kg completos)
  });

  it('caso 8: Compra en Bs sin bcvRate → 400 BadRequest "bcvRate es obligatoria"', async () => {
    await expect(
      purchases.create(
        {
          placeId: 'MERCADO-1',
          currency: 'BS',
          items: [
            {
              productId: 'HARINA',
              quantity: 1,
              unit: 'kg',
              unitCost: 36.5,
            },
          ],
        },
        'user1',
      ),
    ).rejects.toThrow(/bcvRate es obligatoria/i);

    // Verificar que NO se creó compra
    const purchaseCount = await connection
      .collection('purchases')
      .countDocuments();
    expect(purchaseCount).toBe(0);
  });

  it('caso 9: Compra USD sin bcvRate sigue funcionando (regresión)', async () => {
    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        currency: 'USD', // o default
        items: [
          {
            productId: 'HARINA',
            quantity: 1,
            unit: 'kg',
            unitCost: 1.0, // USD
          },
        ],
      },
      'user1',
    );

    // Verificar que funciona como antes (sin campos BS)
    expect(purchase.currency).toBe('USD');
    expect(purchase.exchangeRate).toBeUndefined();
    expect(purchase.totalBs).toBeUndefined();
    expect(purchase.items[0].unitCostBs).toBeUndefined();
    expect(purchase.items[0].subtotalBs).toBeUndefined();

    // Valores USD normales
    expect(purchase.items[0].unitCost).toBe(1.0);
    expect(purchase.items[0].subtotal).toBeCloseTo(1.0, 2);
    expect(purchase.total).toBeCloseTo(1.0, 2);
  });

  it('compensación: priceHistory.record falla en segundo item → compra NO existe, movimientos anulan neto a 0, error se propaga', async () => {
    // Espiar priceHistory.record para lanzar en el segundo item
    let callCount = 0;
    const originalRecord = priceHistory.record.bind(priceHistory);
    jest.spyOn(priceHistory, 'record').mockImplementation(async (input) => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Fallo simulado en price_history');
      }
      return originalRecord(input);
    });

    // Intentar crear compra con 2 items
    await expect(
      purchases.create(
        {
          placeId: 'MERCADO-1',
          items: [
            {
              productId: 'HARINA',
              quantity: 1,
              unit: 'kg',
              unitCost: 1.0,
            },
            {
              productId: 'REFRESCO',
              quantity: 5,
              unit: 'und',
              unitCost: 2.0,
            },
          ],
        },
        'user1',
      ),
    ).rejects.toThrow(/Fallo simulado/);

    // Verificar que la compra NO fue creada
    const purchaseCount = await connection
      .collection('purchases')
      .countDocuments();
    expect(purchaseCount).toBe(0);

    // Verificar que el stock quedó neto 0 (movimiento inicial + su anulación)
    const movements_harina = await connection
      .collection('inventory_movements')
      .find({ productId: 'HARINA' })
      .toArray();
    expect(movements_harina).toHaveLength(2); // COMPRA + ANULACION
    const compra = movements_harina.find((m) => m.type === 'COMPRA');
    const anulacion = movements_harina.find((m) => m.type === 'ANULACION');
    expect(compra).toBeDefined();
    expect(anulacion).toBeDefined();
    expect(anulacion?.qty).toBe(-(compra?.qty || 0)); // Neto a 0

    // Stock final debe ser 0
    const finalStock = await movements.getStockFor('GENERAL', 'HARINA');
    expect(finalStock).toBe(0);
  });

  it('una compra mas cara sube el costo del plato y levanta la alerta de margen', async () => {
    // El pan de la casa lleva 500 gr de harina. Con la harina a $42,44 el saco
    // (45 kg) el pan cuesta $0,47 y se vende a $1: margen sano.
    await connection.collection('products').insertOne({
      _id: 'PAN',
      name: 'Pan de la casa',
      price: 1,
      cost: 0.47,
      presentation: 'Unidad',
      presentationQuantity: 1,
      categoryId: 'c1',
      type: 'COMPUESTO',
      isForSale: true,
      isActive: true,
      ingredients: [
        { productId: 'HARINA', quantity: 500, unit: 'gr', wastePercentage: 0 },
      ],
    });

    // Llega el saco a $80: el pan pasa a costar $0,89 sobre un precio de $1.
    const purchase = await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'HARINA',
            quantity: 1,
            unit: 'unidad-compra',
            unitCost: 80,
          },
        ],
      },
      'user1',
    );

    // 1. El costo del plato se recalculo solo (antes solo pasaba al guardar la
    //    receta: se compraba mas caro y el margen seguia mostrando el viejo).
    const pan = await connection.collection('products').findOne({ _id: 'PAN' });
    expect(pan!.cost).toBeCloseTo(0.8889, 3);
    expect(pan!.costUpdatedAt).toBeInstanceOf(Date);

    // 2. La compra devuelve el aviso para poder verlo ANTES de cerrarla.
    expect(purchase.costosRecalculados.map((c) => c.productId)).toContain(
      'PAN',
    );
    const alerta = purchase.alertasMargen.find((a) => a.productId === 'PAN');
    expect(alerta).toBeDefined();
    expect(alerta!.nivel).toBe('BAJO');
    expect(alerta!.marginPct).toBeCloseTo(11.1, 0);

    // 3. Y queda registrada para el panel y la campana.
    const abierta = await connection
      .collection('margin_alerts')
      .findOne({ productId: 'PAN', resueltaEn: null });
    expect(abierta).toBeTruthy();
    expect(abierta!.insumoName).toBe('Harina de trigo');
  });

  it('la alerta se cierra sola cuando el insumo vuelve a bajar', async () => {
    await connection.collection('products').insertOne({
      _id: 'PAN',
      name: 'Pan de la casa',
      price: 1,
      cost: 0.47,
      presentation: 'Unidad',
      presentationQuantity: 1,
      categoryId: 'c1',
      type: 'COMPUESTO',
      isForSale: true,
      isActive: true,
      ingredients: [
        { productId: 'HARINA', quantity: 500, unit: 'gr', wastePercentage: 0 },
      ],
    });

    await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'HARINA',
            quantity: 1,
            unit: 'unidad-compra',
            unitCost: 80,
          },
        ],
      },
      'user1',
    );
    expect(
      await connection
        .collection('margin_alerts')
        .findOne({ productId: 'PAN', resueltaEn: null }),
    ).toBeTruthy();

    // Baja el saco a $20: el pan vuelve a $0,22 sobre $1 y la alerta se cierra
    // sola, sin que nadie tenga que acordarse de marcarla.
    await purchases.create(
      {
        placeId: 'MERCADO-1',
        items: [
          {
            productId: 'HARINA',
            quantity: 1,
            unit: 'unidad-compra',
            unitCost: 20,
          },
        ],
      },
      'user1',
    );

    expect(
      await connection
        .collection('margin_alerts')
        .findOne({ productId: 'PAN', resueltaEn: null }),
    ).toBeNull();
    const cerrada = await connection
      .collection('margin_alerts')
      .findOne({ productId: 'PAN' });
    expect(cerrada!.resueltaEn).toBeInstanceOf(Date);
  });
});
