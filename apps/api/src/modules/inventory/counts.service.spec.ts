import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { CountsService } from './counts.service';
import { MovementsService } from './movements.service';
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
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';

describe('CountsService', () => {
  let mongod: MongoMemoryServer;
  let counts: CountsService;
  let movements: MovementsService;
  let connection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: InventoryMovement.name, schema: InventoryMovementSchema },
          { name: WarehouseStock.name, schema: WarehouseStockSchema },
          { name: InventoryCount.name, schema: InventoryCountSchema },
          { name: Warehouse.name, schema: WarehouseSchema },
          { name: Product.name, schema: ProductSchema },
        ]),
      ],
      providers: [MovementsService, CountsService],
    }).compile();
    counts = module.get(CountsService);
    movements = module.get(MovementsService);
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await connection.collection('products').insertOne({
      _id: 'MOZZA',
      name: 'Mozzarella',
      price: 0,
      cost: 7.83,
      presentation: 'Kilogramo',
      presentationQuantity: 1,
      categoryId: 'c',
      stock: 0,
    });
  });

  afterEach(async () => {
    for (const c of [
      'products',
      'inventory_movements',
      'warehouse_stocks',
      'inventory_counts',
      'warehouses',
    ]) {
      await connection.collection(c).deleteMany({});
    }
  });

  it('conteo INICIAL fija el punto cero (CONTEO_INICIAL entrante)', async () => {
    const count = await counts.createAndConfirm(
      {
        warehouseId: 'W1',
        type: 'INICIAL',
        items: [{ productId: 'MOZZA', quantity: 5, unit: 'kg' }],
      },
      'admin',
    );
    expect(count.items[0].countedQty).toBe(5000);
    expect(count.items[0].diff).toBe(5000);
    expect(count.items[0].baseUnit).toBe('GR'); // Kilogramo -> GR
    expect(await movements.getStockFor('W1', 'MOZZA')).toBe(5000);
    const ledger = await movements.list({ warehouseId: 'W1' });
    expect(ledger[0].type).toBe('CONTEO_INICIAL');
  });

  it('conteo DIARIO emite CONTEO_AJUSTE por la diferencia y la valoriza', async () => {
    await movements.emit({
      type: 'COMPRA',
      warehouseId: 'W1',
      productId: 'MOZZA',
      qty: 5000,
      baseUnit: 'GR',
      unitCost: 0.00783,
      userId: 't',
    });
    // Se consumieron teóricamente 200gr pero físicamente faltan 300gr
    const count = await counts.createAndConfirm(
      {
        warehouseId: 'W1',
        type: 'DIARIO',
        items: [{ productId: 'MOZZA', quantity: 4.7, unit: 'kg' }],
      },
      'encargado',
    );
    expect(count.items[0].systemQty).toBe(5000);
    expect(count.items[0].countedQty).toBe(4700);
    expect(count.items[0].diff).toBe(-300);
    expect(count.items[0].baseUnit).toBe('GR');
    expect(count.items[0].diffCost).toBeCloseTo(-2.349, 2);
    expect(count.totalDiffCost).toBeCloseTo(-2.349, 2);
    expect(await movements.getStockFor('W1', 'MOZZA')).toBe(4700);
  });

  it('diferencia sin cambio no emite movimiento', async () => {
    await movements.emit({
      type: 'COMPRA',
      warehouseId: 'W1',
      productId: 'MOZZA',
      qty: 1000,
      baseUnit: 'GR',
      unitCost: 0.00783,
      userId: 't',
    });
    await counts.createAndConfirm(
      {
        warehouseId: 'W1',
        type: 'DIARIO',
        items: [{ productId: 'MOZZA', quantity: 1, unit: 'kg' }],
      },
      'x',
    );
    const ajustes = await movements.list({
      warehouseId: 'W1',
      type: 'CONTEO_AJUSTE',
    });
    expect(ajustes).toHaveLength(0);
  });

  it('diferencia >50% del stock exige confirmLargeDiffs (spec §13)', async () => {
    await movements.emit({
      type: 'COMPRA',
      warehouseId: 'W1',
      productId: 'MOZZA',
      qty: 10000,
      baseUnit: 'GR',
      unitCost: 0.00783,
      userId: 't',
    });
    await expect(
      counts.createAndConfirm(
        {
          warehouseId: 'W1',
          type: 'DIARIO',
          items: [{ productId: 'MOZZA', quantity: 2, unit: 'kg' }], // −80%
        },
        'x',
      ),
    ).rejects.toThrow('50%');
    // con confirmación pasa
    const ok = await counts.createAndConfirm(
      {
        warehouseId: 'W1',
        type: 'DIARIO',
        items: [{ productId: 'MOZZA', quantity: 2, unit: 'kg' }],
        confirmLargeDiffs: true,
      },
      'x',
    );
    expect(ok.items[0].diff).toBe(-8000);
  });
});
