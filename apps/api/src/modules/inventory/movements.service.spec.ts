import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { MovementsService } from './movements.service';
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

// Las colecciones de la API usan _id de texto; el driver lo tipa como ObjectId.
type ConIdTexto = Record<string, unknown> & { _id: string };

describe('MovementsService — ledger', () => {
  let mongod: MongoMemoryServer;
  let service: MovementsService;
  let connection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: InventoryMovement.name, schema: InventoryMovementSchema },
          { name: WarehouseStock.name, schema: WarehouseStockSchema },
          { name: Product.name, schema: ProductSchema },
          { name: Warehouse.name, schema: WarehouseSchema },
        ]),
      ],
      providers: [MovementsService],
    }).compile();
    service = module.get(MovementsService);
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  afterEach(async () => {
    await connection.collection('inventory_movements').deleteMany({});
    await connection.collection('warehouse_stocks').deleteMany({});
    await connection.collection('products').deleteMany({});
  });

  const base = {
    warehouseId: 'W1',
    productId: 'HARINA',
    baseUnit: 'GR' as const,
    unitCost: 0.000943,
    userId: 'test',
  };

  it('emit acumula stock en el snapshot', async () => {
    await service.emit({ ...base, type: 'COMPRA', qty: 45000 });
    await service.emit({ ...base, type: 'CONSUMO_VENTA', qty: -400 });
    expect(await service.getStockFor('W1', 'HARINA')).toBe(44600);
  });

  it('emit calcula totalCost = qty * unitCost', async () => {
    const m = await service.emit({ ...base, type: 'COMPRA', qty: 45000 });
    expect(m.totalCost).toBeCloseTo(42.435, 2);
  });

  it('el ledger es auto-verificable: qty × unitCost almacenados ≈ totalCost', async () => {
    const m = await service.emit({ ...base, type: 'COMPRA', qty: 45000 });
    expect(m.qty * m.unitCost).toBeCloseTo(m.totalCost, 2);
  });

  it('auto-verificable también con cantidades fraccionarias', async () => {
    const m = await service.emit({
      ...base,
      type: 'COMPRA',
      qty: 45.123,
      unitCost: 0.000943111,
    });
    expect(m.qty * m.unitCost).toBeCloseTo(m.totalCost, 4);
  });

  it('getStock lista todos los insumos del almacén', async () => {
    await service.emit({ ...base, type: 'COMPRA', qty: 1000 });
    await service.emit({
      ...base,
      productId: 'QUESO',
      type: 'COMPRA',
      qty: 5000,
    });
    const stock = await service.getStock('W1');
    expect(stock).toHaveLength(2);
    expect(stock.find((s) => s.productId === 'QUESO')?.qty).toBe(5000);
  });

  it('getStock enriquece con productName y isActive (sin N+1)', async () => {
    // Setup: crear productos y stock
    await connection.collection('products').insertMany([
      { _id: 'HARINA', name: 'Harina Premium', isActive: true },
      { _id: 'QUESO', name: 'Queso Fresco', isActive: false }, // producto inactivo
    ]);
    await service.emit({ ...base, type: 'COMPRA', qty: 1000 });
    await service.emit({
      ...base,
      productId: 'QUESO',
      type: 'COMPRA',
      qty: 5000,
    });
    const stock = await service.getStock('W1');
    expect(stock).toHaveLength(2);

    const harina = stock.find((s) => s.productId === 'HARINA');
    expect(harina?.productName).toBe('Harina Premium');
    expect(harina?.isActive).toBe(true);

    const queso = stock.find((s) => s.productId === 'QUESO');
    expect(queso?.productName).toBe('Queso Fresco');
    expect(queso?.isActive).toBe(false);
  });

  it('getStock maneja productos eliminados (sin productName, sin isActive)', async () => {
    // Emitir movimiento de un producto que luego se elimina
    await service.emit({
      type: 'COMPRA',
      warehouseId: 'W2',
      productId: 'FANTASMA',
      qty: 100,
      baseUnit: 'UND' as const,
      unitCost: 5,
      userId: 'test',
    });
    const stock = await service.getStock('W2');
    expect(stock).toHaveLength(1);
    const item = stock[0];
    expect(item.productId).toBe('FANTASMA');
    expect(item.productName).toBeUndefined();
    expect(item.isActive).toBeUndefined();
  });

  it('rechaza qty 0 o no finita', async () => {
    await expect(
      service.emit({ ...base, type: 'COMPRA', qty: 0 }),
    ).rejects.toThrow('cantidad');
    await expect(
      service.emit({ ...base, type: 'COMPRA', qty: NaN }),
    ).rejects.toThrow('cantidad');
  });

  it('annul crea contra-movimiento y restaura stock; no permite anular dos veces', async () => {
    const m = await service.emit({ ...base, type: 'COMPRA', qty: 1000 });
    const a = await service.annul(m.id, 'admin', 'error de registro');
    expect(a.type).toBe('ANULACION');
    expect(a.qty).toBe(-1000);
    expect(a.refId).toBe(m.id);
    expect(await service.getStockFor('W1', 'HARINA')).toBe(0);
    await expect(service.annul(m.id, 'admin', 'otra vez')).rejects.toThrow(
      'ya fue anulado',
    );
  });

  it('reconcile corrige un snapshot desincronizado', async () => {
    await service.emit({ ...base, type: 'COMPRA', qty: 1000 });
    // Simular corrupción del snapshot
    await connection
      .collection('warehouse_stocks')
      .updateOne(
        { warehouseId: 'W1', productId: 'HARINA' },
        { $set: { qty: 999999 } },
      );
    const result = await service.reconcile('W1');
    expect(result.fixed).toBe(1);
    expect(await service.getStockFor('W1', 'HARINA')).toBe(1000);
  });

  it('reconcile elimina snapshots huérfanos sin movimientos en el ledger', async () => {
    await service.emit({ ...base, type: 'COMPRA', qty: 100 });
    await connection.collection('warehouse_stocks').insertOne({
      _id: 'orphan1',
      warehouseId: 'W1',
      productId: 'FANTASMA',
      qty: 50,
      baseUnit: 'GR',
    });
    const r = await service.reconcile('W1');
    expect(r.fixed).toBeGreaterThanOrEqual(1);
    expect(await service.getStockFor('W1', 'FANTASMA')).toBe(0);
  });

  it('list filtra por almacén, producto y tipo', async () => {
    await service.emit({ ...base, type: 'COMPRA', qty: 100 });
    await service.emit({ ...base, type: 'CONSUMO_VENTA', qty: -10 });
    const compras = await service.list({ warehouseId: 'W1', type: 'COMPRA' });
    expect(compras).toHaveLength(1);
    expect(compras[0].type).toBe('COMPRA');
  });

  describe('transfer y merma', () => {
    beforeEach(async () => {
      await connection.collection('warehouses').insertMany([
        {
          _id: 'W1',
          name: 'Origen',
          area: 'GENERAL',
          isDefault: true,
          isActive: true,
        },
        {
          _id: 'W2',
          name: 'Destino',
          area: 'COCINA',
          isDefault: true,
          isActive: true,
        },
      ]);
      await connection.collection('products').insertOne({
        _id: 'HARINA',
        name: 'Harina',
        price: 0,
        cost: 42.44,
        presentation: 'Kilogramo',
        presentationQuantity: 45,
        categoryId: 'c',
        stock: 0,
      });
      await service.emit({ ...base, type: 'COMPRA', qty: 45000 });
    });

    afterEach(async () => {
      await connection.collection('products').deleteMany({});
      await connection.collection('warehouses').deleteMany({});
    });

    it('transfer emite 2 movimientos espejo convertidos a unidad base', async () => {
      const r = await service.transfer(
        {
          fromWarehouseId: 'W1',
          toWarehouseId: 'W2',
          productId: 'HARINA',
          quantity: 3,
          unit: 'kg',
        },
        'encargado',
      );
      if (r.unified) throw new Error('HARINA no tiene estación: no se unifica');
      expect(r.out.qty).toBe(-3000);
      expect(r.in.qty).toBe(3000);
      expect(r.out.counterpartWarehouseId).toBe('W2');
      expect(r.in.counterpartWarehouseId).toBe('W1');
      expect(await service.getStockFor('W1', 'HARINA')).toBe(42000);
      expect(await service.getStockFor('W2', 'HARINA')).toBe(3000);
    });

    it('transfer rechaza unidad incompatible con el insumo', async () => {
      await expect(
        service.transfer(
          {
            fromWarehouseId: 'W1',
            toWarehouseId: 'W2',
            productId: 'HARINA',
            quantity: 2,
            unit: 'Litro',
          },
          'x',
        ),
      ).rejects.toThrow('incompatible');
    });

    it('transfer rechaza almacén inexistente', async () => {
      await expect(
        service.transfer(
          {
            fromWarehouseId: 'W1',
            toWarehouseId: 'NO-EXISTE',
            productId: 'HARINA',
            quantity: 1,
            unit: 'kg',
          },
          'x',
        ),
      ).rejects.toThrow('no existe');
    });

    it('transfer permite dejar stock negativo pero lo registra como advertencia', async () => {
      const r = await service.transfer(
        {
          fromWarehouseId: 'W1',
          toWarehouseId: 'W2',
          productId: 'HARINA',
          quantity: 50,
          unit: 'kg',
        },
        'x',
      );
      expect(await service.getStockFor('W1', 'HARINA')).toBe(-5000);
      if (r.unified) throw new Error('HARINA no tiene estación: no se unifica');
      expect(r.out.notes).toContain('ADVERTENCIA');
      expect(r.in.notes).toContain('ADVERTENCIA');
    });

    it('declareWaste emite MERMA_DECLARADA negativa con la foto en notes', async () => {
      const m = await service.declareWaste(
        {
          warehouseId: 'W1',
          productId: 'HARINA',
          quantity: 500,
          unit: 'gr',
          reason: 'se mojó el saco',
          photoUrl: 'https://api.ejemplo.com/uploads/waste/x.jpg',
        },
        'encargado',
      );
      expect(m.type).toBe('MERMA_DECLARADA');
      expect(m.qty).toBe(-500);
      expect(m.notes).toContain('se mojó el saco');
      expect(m.notes).toContain('/uploads/waste/x.jpg');
      expect(await service.getStockFor('W1', 'HARINA')).toBe(44500);
    });
  });

  describe('stock unificado: cada producto en el almacén de su estación', () => {
    const mov = { baseUnit: 'UND' as const, unitCost: 1, userId: 'test' };

    beforeEach(async () => {
      service.resetHomeCache();
      await connection.collection<ConIdTexto>('warehouses').insertMany([
        {
          _id: 'DEP',
          name: 'Depósito General',
          area: 'GENERAL',
          isDefault: true,
          isActive: true,
        },
        {
          _id: 'COC',
          name: 'Cocina',
          area: 'COCINA',
          isDefault: true,
          isActive: true,
        },
        {
          _id: 'BAR',
          name: 'Barra',
          area: 'BARRA',
          isDefault: true,
          isActive: true,
        },
      ]);
      await connection.collection<ConIdTexto>('products').insertMany([
        {
          _id: 'PILSEN',
          name: 'Pilsen lata',
          price: 1.5,
          cost: 0.7,
          presentation: 'Unidad',
          presentationQuantity: 1,
          categoryId: 'c',
          stock: 0,
          station: 'BAR',
        },
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
          _id: 'VASOS',
          name: 'Vasos',
          price: 0,
          cost: 1,
          presentation: 'Unidad',
          presentationQuantity: 50,
          categoryId: 'c',
          stock: 0,
        },
      ]);
    });

    afterEach(async () => {
      delete process.env.STOCK_UNIFICADO;
      await connection.collection('products').deleteMany({});
      await connection.collection('warehouses').deleteMany({});
    });

    it('una compra que llega al Depósito entra a la Barra, la casa de la cerveza', async () => {
      const m = await service.emit({
        ...mov,
        type: 'COMPRA',
        warehouseId: 'DEP',
        productId: 'PILSEN',
        qty: 36,
      });
      expect(m.warehouseId).toBe('BAR');
      expect(await service.getStockFor('BAR', 'PILSEN')).toBe(36);
      expect(await service.getStockFor('DEP', 'PILSEN')).toBe(0);
    });

    it('la leche que consume un trago de la barra sale de la Cocina', async () => {
      await service.emit({
        ...mov,
        baseUnit: 'ML',
        type: 'CONSUMO_VENTA',
        warehouseId: 'BAR',
        productId: 'LECHE',
        qty: -200,
      });
      expect(await service.getStockFor('COC', 'LECHE')).toBe(-200);
      expect(await service.getStockFor('BAR', 'LECHE')).toBe(0);
    });

    it('sin estación se respeta el almacén pedido (no se adivina)', async () => {
      await service.emit({
        ...mov,
        type: 'COMPRA',
        warehouseId: 'DEP',
        productId: 'VASOS',
        qty: 50,
      });
      expect(await service.getStockFor('DEP', 'VASOS')).toBe(50);
    });

    it('traspasar un producto que ya vive en su casa no mueve nada ni da error', async () => {
      await service.emit({
        ...mov,
        type: 'COMPRA',
        warehouseId: 'DEP',
        productId: 'PILSEN',
        qty: 36,
      });
      const r = await service.transfer(
        {
          fromWarehouseId: 'DEP',
          toWarehouseId: 'BAR',
          productId: 'PILSEN',
          quantity: 10,
          unit: 'und',
        },
        'encargado',
      );
      expect(r.unified).toBe(true);
      expect(await service.list({ productId: 'PILSEN' })).toHaveLength(1);
      expect(await service.getStockFor('BAR', 'PILSEN')).toBe(36);
    });

    it('con STOCK_UNIFICADO=0 vuelve al comportamiento de antes', async () => {
      process.env.STOCK_UNIFICADO = '0';
      await service.emit({
        ...mov,
        type: 'COMPRA',
        warehouseId: 'DEP',
        productId: 'PILSEN',
        qty: 36,
      });
      expect(await service.getStockFor('DEP', 'PILSEN')).toBe(36);
      expect(await service.getStockFor('BAR', 'PILSEN')).toBe(0);
    });
  });
});
