import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { WarehousesService } from './warehouses.service';
import { Warehouse, WarehouseSchema } from './schemas/warehouse.schema';

describe('WarehousesService', () => {
  let mongod: MongoMemoryServer;
  let service: WarehousesService;
  let connection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Warehouse.name, schema: WarehouseSchema },
        ]),
      ],
      providers: [WarehousesService],
    }).compile();
    service = module.get(WarehousesService);
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  afterEach(async () => {
    await connection.collection('warehouses').deleteMany({});
  });

  it('crea un almacén y lo lista', async () => {
    await service.create({ name: 'Nevera Cocina 1', area: 'COCINA' });
    const all = await service.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Nevera Cocina 1');
    expect(all[0].isActive).toBe(true);
  });

  it('el primer almacén de un área queda como default automáticamente', async () => {
    const w = await service.create({ name: 'Depósito', area: 'GENERAL' });
    expect(w.isDefault).toBe(true);
  });

  it('marcar isDefault desmarca el default anterior del área', async () => {
    const a = await service.create({ name: 'Nevera 1', area: 'COCINA' });
    const b = await service.create({ name: 'Nevera 2', area: 'COCINA' });
    expect(b.isDefault).toBe(false);
    await service.update(b.id, { isDefault: true });
    const updatedA = await service.findById(a.id);
    const updatedB = await service.findById(b.id);
    expect(updatedA.isDefault).toBe(false);
    expect(updatedB.isDefault).toBe(true);
  });

  it('findDefaultForArea devuelve el default activo del área', async () => {
    await service.create({ name: 'Barra fría', area: 'BARRA' });
    const def = await service.findDefaultForArea('BARRA');
    expect(def?.name).toBe('Barra fría');
    expect(await service.findDefaultForArea('PIZZERIA')).toBeNull();
  });

  it('no permite desactivar el único default activo de un área', async () => {
    const w = await service.create({ name: 'Depósito', area: 'GENERAL' });
    await expect(service.update(w.id, { isActive: false })).rejects.toThrow(
      'default',
    );
  });
});
