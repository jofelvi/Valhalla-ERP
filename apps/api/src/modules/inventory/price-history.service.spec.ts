import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { PriceHistoryService } from './price-history.service';
import {
  PriceHistory,
  PriceHistorySchema,
} from './schemas/price-history.schema';

describe('PriceHistoryService', () => {
  let mongod: MongoMemoryServer;
  let service: PriceHistoryService;
  let connection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: PriceHistory.name, schema: PriceHistorySchema },
        ]),
      ],
      providers: [PriceHistoryService],
    }).compile();
    service = module.get(PriceHistoryService);
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  afterEach(async () => {
    await connection.collection('price_history').deleteMany({});
  });

  it('record: persiste con roundUnitCost (8 decimales)', async () => {
    await service.record({
      productId: 'p1',
      unitCost: 0.00123456789,
      placeId: 'lugar1',
      purchaseId: 'c1',
      date: new Date('2026-07-01'),
    });
    const last = await service.lastCost('p1');
    expect(last).not.toBeNull();
    expect(last?.unitCost).toBe(0.00123457); // redondeado a 8 decimales
  });

  it('lastCost: devuelve null sin datos', async () => {
    const last = await service.lastCost('p-noexiste');
    expect(last).toBeNull();
  });

  it('lastCost: devuelve el mas reciente por fecha', async () => {
    await service.record({
      productId: 'p2',
      unitCost: 0.001,
      placeId: 'lugar1',
      purchaseId: 'c1',
      date: new Date('2026-07-01'),
    });
    await service.record({
      productId: 'p2',
      unitCost: 0.0015,
      placeId: 'lugar2',
      purchaseId: 'c2',
      date: new Date('2026-07-05'),
    });
    const last = await service.lastCost('p2');
    expect(last?.unitCost).toBe(0.0015);
    expect(last?.placeId).toBe('lugar2');
    expect(last?.date).toEqual(new Date('2026-07-05'));
  });

  it('bestPlaces: devuelve [] sin datos', async () => {
    const hints = await service.bestPlaces(['p-noexiste']);
    expect(hints).toHaveLength(0);
  });

  it('bestPlaces: no sugiere con <2 lugares', async () => {
    await service.record({
      productId: 'p3',
      unitCost: 0.001,
      placeId: 'lugar1',
      purchaseId: 'c1',
      date: new Date('2026-07-01'),
    });
    await service.record({
      productId: 'p3',
      unitCost: 0.0008,
      placeId: 'lugar1',
      purchaseId: 'c2',
      date: new Date('2026-07-05'),
    });
    const hints = await service.bestPlaces(['p3']);
    expect(hints).toHaveLength(0);
  });

  it('bestPlaces: sugiere el lugar mas barato solo con >=2 lugares', async () => {
    await service.record({
      productId: 'p1',
      unitCost: 0.001,
      placeId: 'sigo',
      purchaseId: 'c1',
      date: new Date('2026-07-01'),
    });
    await service.record({
      productId: 'p1',
      unitCost: 0.0008,
      placeId: 'mayorista',
      purchaseId: 'c2',
      date: new Date('2026-07-05'),
    });
    await service.record({
      productId: 'p1',
      unitCost: 0.0011,
      placeId: 'sigo',
      purchaseId: 'c3',
      date: new Date('2026-07-10'),
    });
    const hints = await service.bestPlaces(['p1', 'p2']);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      productId: 'p1',
      bestPlaceId: 'mayorista',
      bestCost: 0.0008,
      lastCost: 0.0011,
      lastPlaceId: 'sigo',
    });
    expect(hints[0].savingPct).toBeCloseTo(27.3, 1);
  });

  it('bestPlaces: no sugiere si el mejor es el ultimo lugar', async () => {
    await service.record({
      productId: 'p4',
      unitCost: 0.0008,
      placeId: 'mayorista',
      purchaseId: 'c1',
      date: new Date('2026-07-01'),
    });
    await service.record({
      productId: 'p4',
      unitCost: 0.001,
      placeId: 'sigo',
      purchaseId: 'c2',
      date: new Date('2026-07-05'),
    });
    await service.record({
      productId: 'p4',
      unitCost: 0.0008,
      placeId: 'mayorista',
      purchaseId: 'c3',
      date: new Date('2026-07-10'),
    });
    const hints = await service.bestPlaces(['p4']);
    expect(hints).toHaveLength(0); // no sugerencia porque mayorista es el ultimo y el mejor
  });

  it('listByProduct: retorna ultimos registros ordenados por fecha desc', async () => {
    await service.record({
      productId: 'p5',
      unitCost: 0.001,
      placeId: 'lugar1',
      purchaseId: 'c1',
      date: new Date('2026-07-01'),
    });
    await service.record({
      productId: 'p5',
      unitCost: 0.0012,
      placeId: 'lugar2',
      purchaseId: 'c2',
      date: new Date('2026-07-05'),
    });
    const list = await service.listByProduct('p5', 50);
    expect(list).toHaveLength(2);
    expect(list[0].unitCost).toBe(0.0012); // mas reciente primero
    expect(list[1].unitCost).toBe(0.001);
  });

  it('bestPlaces: no devuelve NaN ni hint si unitCost mas reciente es 0', async () => {
    await service.record({
      productId: 'p-cero',
      unitCost: 0.001,
      placeId: 'lugar1',
      purchaseId: 'c1',
      date: new Date('2026-07-01'),
    });
    await service.record({
      productId: 'p-cero',
      unitCost: 0.002,
      placeId: 'lugar2',
      purchaseId: 'c2',
      date: new Date('2026-07-05'),
    });
    // El punto mas reciente tiene unitCost 0 - debe saltarse sin NaN
    await service.record({
      productId: 'p-cero',
      unitCost: 0,
      placeId: 'lugar2',
      purchaseId: 'c3',
      date: new Date('2026-07-10'),
    });
    const hints = await service.bestPlaces(['p-cero']);
    expect(hints).toHaveLength(0); // no hint porque el unitCost mas reciente es 0
    // verificar que no hay NaN en los hints (si hubiera, fallaría)
    hints.forEach((h) => {
      expect(isNaN(h.savingPct)).toBe(false);
    });
  });
});
