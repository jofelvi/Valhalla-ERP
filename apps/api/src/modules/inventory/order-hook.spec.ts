import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';

// El hook usa este claim atómico: solo UN caller procesa la orden.
async function claimInventoryProcessing(
  connection: Connection,
  orderId: string,
): Promise<boolean> {
  const res = await connection
    .collection('orders')
    .updateOne(
      { _id: orderId as never, inventoryProcessed: { $ne: true } },
      { $set: { inventoryProcessed: true } },
    );
  return res.modifiedCount === 1;
}

describe('claim idempotente de inventario', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const m = await mongoose.connect(mongod.getUri());
    connection = m.connection;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('solo el primer claim gana; los reintentos no reprocesan', async () => {
    await connection
      .collection('orders')
      .insertOne({ _id: 'O1' as never, paymentStatus: 'paid' });
    const first = await claimInventoryProcessing(connection, 'O1');
    const second = await claimInventoryProcessing(connection, 'O1');
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
