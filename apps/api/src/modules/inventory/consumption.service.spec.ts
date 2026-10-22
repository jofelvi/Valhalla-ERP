import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { ConsumptionService } from './consumption.service';
import { MovementsService } from './movements.service';
import { WarehousesService } from './warehouses.service';
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

describe('ConsumptionService — motor de consumo', () => {
  let mongod: MongoMemoryServer;
  let consumption: ConsumptionService;
  let movements: MovementsService;
  let warehouses: WarehousesService;
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
        ]),
      ],
      providers: [MovementsService, WarehousesService, ConsumptionService],
    }).compile();
    consumption = module.get(ConsumptionService);
    movements = module.get(MovementsService);
    warehouses = module.get(WarehousesService);
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  let cocinaId: string;
  let barraId: string;

  beforeEach(async () => {
    cocinaId = (await warehouses.create({ name: 'Cocina', area: 'COCINA' })).id;
    barraId = (await warehouses.create({ name: 'Barra', area: 'BARRA' })).id;
    // Insumos (réplica de la Pizza Guardiana de Test)
    await connection.collection('products').insertMany([
      {
        _id: 'MASA',
        name: 'Masa',
        price: 0,
        cost: 3.19,
        presentation: 'Gramo',
        presentationQuantity: 4112,
        categoryId: 'c',
        stock: 0,
      },
      {
        _id: 'MOZZA',
        name: 'Mozzarella',
        price: 0,
        cost: 7.83,
        presentation: 'Kilogramo',
        presentationQuantity: 1,
        categoryId: 'c',
        stock: 0,
      },
      {
        _id: 'ACEITE',
        name: 'Aceite',
        price: 0,
        cost: 4.3,
        presentation: 'Litro',
        presentationQuantity: 1,
        categoryId: 'c',
        stock: 0,
      },
      {
        _id: 'REFRESCO',
        name: 'Refresco lata',
        price: 1.25,
        cost: 0.8,
        presentation: 'Unidad',
        presentationQuantity: 24, // se compra por caja de 24
        categoryId: 'c',
        stock: 0,
        isForInventory: true,
      },
      {
        _id: 'PIZZA',
        name: 'Pizza Test',
        price: 13,
        cost: 0,
        presentation: 'Unidad',
        presentationQuantity: 1,
        categoryId: 'c',
        stock: 0,
        ingredients: [
          {
            productId: 'MASA',
            quantity: 400,
            unit: 'Gramo',
            wastePercentage: 0,
          },
          {
            productId: 'MOZZA',
            quantity: 200,
            unit: 'Gramo',
            wastePercentage: 5,
          },
        ],
      },
      {
        _id: 'SINRECETA',
        name: 'Plato sin receta',
        price: 10,
        cost: 0,
        presentation: 'Unidad',
        presentationQuantity: 1,
        categoryId: 'c',
        stock: 0,
      },
      {
        _id: 'PIZZAROTA',
        name: 'Pizza receta rota',
        price: 10,
        cost: 0,
        presentation: 'Unidad',
        presentationQuantity: 1,
        categoryId: 'c',
        stock: 0,
        ingredients: [
          // gramos de un insumo cuya base es ML → incompatible
          {
            productId: 'ACEITE',
            quantity: 40,
            unit: 'Gramo',
            wastePercentage: 0,
          },
        ],
      },
    ]);
  });

  afterEach(async () => {
    for (const c of [
      'products',
      'inventory_movements',
      'warehouse_stocks',
      'warehouses',
    ]) {
      await connection.collection(c).deleteMany({});
    }
  });

  it('explota receta con conversión de unidades y waste% (bug kg/gr resuelto)', async () => {
    const result = await consumption.processOrderPaid({
      id: 'ORD1',
      items: [{ productId: 'PIZZA', quantity: 2, station: 'KITCHEN' }],
    });
    expect(result.movements).toBe(2);
    // masa: 400gr × 2 = 800 GR (sin waste)
    expect(await movements.getStockFor(cocinaId, 'MASA')).toBe(-800);
    // mozza: 200gr × 2 × 1.05 = 420 GR — el insumo vive en KG y NO se restó crudo
    expect(await movements.getStockFor(cocinaId, 'MOZZA')).toBe(-420);
    const ledger = await movements.list({ refId: 'ORD1' });
    expect(ledger.every((m) => m.type === 'CONSUMO_VENTA')).toBe(true);
  });

  it('insumo directo (isForInventory) descuenta 1:1 en UND en el área de su station', async () => {
    await consumption.processOrderPaid({
      id: 'ORD2',
      items: [{ productId: 'REFRESCO', quantity: 3, station: 'BAR' }],
    });
    // 3 latas = 3 UND (NO ×24: presentationQuantity es contenido de compra, no de venta)
    expect(await movements.getStockFor(barraId, 'REFRESCO')).toBe(-3);
  });

  it('producto sin receta ni isForInventory va a unmapped sin bloquear', async () => {
    const r = await consumption.processOrderPaid({
      id: 'ORD3',
      items: [{ productId: 'SINRECETA', quantity: 1, station: 'KITCHEN' }],
    });
    expect(r.movements).toBe(0);
    // El motivo viaja en el string: antes era un id pelado en una lista que
    // nadie leía, y por ahí se fueron 62 productos sin descontar en 30 días.
    expect(r.unmapped).toContain('sin-naturaleza:SINRECETA');
  });

  it('ingrediente con unidad incompatible se OMITE y se reporta (no inventa números)', async () => {
    const r = await consumption.processOrderPaid({
      id: 'ORD4',
      items: [{ productId: 'PIZZAROTA', quantity: 1, station: 'KITCHEN' }],
    });
    expect(await movements.getStockFor(cocinaId, 'ACEITE')).toBe(0);
    expect(r.unmapped.some((u) => u.startsWith('unidad-incompatible:'))).toBe(
      true,
    );
  });

  it('items cancelados no consumen', async () => {
    const r = await consumption.processOrderPaid({
      id: 'ORD5',
      items: [
        {
          productId: 'PIZZA',
          quantity: 1,
          station: 'KITCHEN',
          cancelledAt: new Date(),
        },
      ],
    });
    expect(r.movements).toBe(0);
  });

  it('reverseOrder anula los consumos de la orden', async () => {
    await consumption.processOrderPaid({
      id: 'ORD6',
      items: [{ productId: 'PIZZA', quantity: 1, station: 'KITCHEN' }],
    });
    expect(await movements.getStockFor(cocinaId, 'MASA')).toBe(-400);
    await consumption.reverseOrder('ORD6', 'admin');
    expect(await movements.getStockFor(cocinaId, 'MASA')).toBe(0);
  });

  it('stock unificado: la leche de un trago de la barra sale de la Cocina', async () => {
    // _id de texto como en la API (el driver lo tipa como ObjectId).
    await connection
      .collection<Record<string, unknown> & { _id: string }>('products')
      .insertMany([
        {
          _id: 'LECHE',
          name: 'Leche',
          price: 0,
          cost: 2,
          presentation: 'Litro',
          presentationQuantity: 1,
          categoryId: 'c',
          stock: 0,
          station: 'KITCHEN',
        },
        {
          _id: 'MERENGADA',
          name: 'Merengada',
          price: 4,
          cost: 0,
          presentation: 'Unidad',
          presentationQuantity: 1,
          categoryId: 'c',
          stock: 0,
          station: 'BAR',
          ingredients: [
            {
              productId: 'LECHE',
              quantity: 0.2,
              unit: 'Litro',
              wastePercentage: 0,
            },
          ],
        },
      ]);
    movements.resetHomeCache();
    await consumption.processOrderPaid({
      id: 'ORD8',
      items: [{ productId: 'MERENGADA', quantity: 1, station: 'BAR' }],
    });
    expect(await movements.getStockFor(cocinaId, 'LECHE')).toBe(-200);
    expect(await movements.getStockFor(barraId, 'LECHE')).toBe(0);
  });

  it('omite ingredientes removidos por personalización (customizations.removedIngredients)', async () => {
    const result = await consumption.processOrderPaid({
      id: 'ORD-CUSTOM-1',
      items: [
        {
          productId: 'PIZZA',
          quantity: 1,
          station: 'KITCHEN',
          customizations: {
            removedIngredients: ['MOZZA'],
          },
        },
      ],
    });
    // Solo debe emitir consumo de MASA (400gr), omitiendo MOZZA
    expect(result.movements).toBe(1);
    expect(await movements.getStockFor(cocinaId, 'MASA')).toBe(-400);
    expect(await movements.getStockFor(cocinaId, 'MOZZA')).toBe(0);
  });

  it('quitar un ingrediente que NO existe en la receta no rompe', async () => {
    movements.resetHomeCache();
    const result = await consumption.processOrderPaid({
      id: 'ORD-CUSTOM-2',
      items: [
        {
          productId: 'PIZZA',
          quantity: 1,
          station: 'KITCHEN',
          customizations: {
            removedIngredients: ['INEXISTENTE'],
          },
        },
      ],
    });
    // No debe fallar, debe consumir normalmente (MASA + MOZZA con waste 5%)
    // MOZZA: 200gr × 1.05 waste = 210 gr
    expect(result.movements).toBe(2);
    expect(await movements.getStockFor(cocinaId, 'MASA')).toBe(-400);
    expect(await movements.getStockFor(cocinaId, 'MOZZA')).toBe(-210);
  });

  it('ítem sin customizations descuenta exactamente lo normal (regresión)', async () => {
    movements.resetHomeCache();
    const result = await consumption.processOrderPaid({
      id: 'ORD-CUSTOM-3',
      items: [{ productId: 'PIZZA', quantity: 1, station: 'KITCHEN' }],
    });
    // Debe consumir normalmente (sin filtro) = MASA + MOZZA
    // MOZZA: 200gr × 1.05 waste = 210 gr
    expect(result.movements).toBe(2);
    expect(await movements.getStockFor(cocinaId, 'MASA')).toBe(-400);
    expect(await movements.getStockFor(cocinaId, 'MOZZA')).toBe(-210);
  });

  it('dos ítems con customizations diferentes en la misma orden se procesan bien', async () => {
    movements.resetHomeCache();
    const result = await consumption.processOrderPaid({
      id: 'ORD-CUSTOM-MULTI',
      items: [
        {
          productId: 'PIZZA',
          quantity: 1,
          station: 'KITCHEN',
          customizations: { removedIngredients: ['MOZZA'] },
        },
        {
          productId: 'PIZZA',
          quantity: 1,
          station: 'KITCHEN',
          customizations: { removedIngredients: ['MASA'] },
        },
      ],
    });
    // Primer pizza: emite MASA (400) + omite MOZZA
    // Segunda pizza: omite MASA + emite MOZZA (210)
    // Total: 2 movimientos (MASA + MOZZA)
    expect(result.movements).toBe(2);
    expect(await movements.getStockFor(cocinaId, 'MASA')).toBe(-400); // Solo de la primera
    expect(await movements.getStockFor(cocinaId, 'MOZZA')).toBe(-210); // Solo de la segunda
  });

  it('sin almacenes configurados reporta sin-almacen y no bloquea', async () => {
    await connection.collection('warehouses').deleteMany({});
    const r = await consumption.processOrderPaid({
      id: 'ORD7',
      items: [{ productId: 'PIZZA', quantity: 1, station: 'KITCHEN' }],
    });
    expect(r.movements).toBe(0);
    expect(r.unmapped.some((u) => u.startsWith('sin-almacen:'))).toBe(true);
  });
});
