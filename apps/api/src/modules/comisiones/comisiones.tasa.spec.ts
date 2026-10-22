import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigMap, NOMINA_DEFAULT, TARIFAS_DEFAULT } from '@odin6/types';
import { ComisionesService } from './comisiones.service';
import { PagoComision } from './schemas/pago-comision.schema';
import { Order } from '../orders/schemas/order.schema';
import { configsDePrueba } from '../orders/configs-de-prueba';

/** Servicio con las ordenes dadas y la nomina `vigentes` (Ajustes) que el pago lee. */
async function servicioCon(
  ordenes: Record<string, unknown>[],
  vigentes: Partial<ConfigMap> = {},
) {
  const pagoModel = {
    find: jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve([]) }),
    }),
    create: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
      const doc = { ...payload, _id: 'pago-1' };
      return Promise.resolve({ ...doc, toObject: () => doc });
    }),
  };
  const orderModel = {
    find: jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(ordenes) }),
    }),
    findOne: jest.fn().mockImplementation((f: { _id: string }) => ({
      exec: () => Promise.resolve(ordenes.find((o) => o._id === f._id) ?? null),
    })),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      configsDePrueba(vigentes),
      ComisionesService,
      { provide: getModelToken(PagoComision.name), useValue: pagoModel },
      { provide: getModelToken(Order.name), useValue: orderModel },
    ],
  }).compile();
  return { service: moduleRef.get(ComisionesService), pagoModel };
}

/** Orden pagada con su base de comision y la nomina con la que nacio. */
const orden = (
  id: string,
  comisionBase: number,
  nomina = NOMINA_DEFAULT,
): Record<string, unknown> => ({
  _id: id,
  comisionBase,
  tipAmount: 0,
  createdAt: new Date('2026-10-01'),
  configAplicada: { tarifas: TARIFAS_DEFAULT, nomina },
});

const pedirPago = (orderIds: string[], comisionPct?: number) => ({
  waiterId: 'w-1',
  waiterName: 'Mesonero',
  orderIds,
  ...(comisionPct !== undefined ? { comisionPct } : {}),
});

describe('ComisionesService — tasa de comision', () => {
  it('sobre ventas: la comision es la base de la orden x su tasa (7 %)', async () => {
    const { service, pagoModel } = await servicioCon([orden('o1', 100)]);

    await service.pagarComision(pedirPago(['o1']));

    expect(pagoModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        montoTotal: 7,
        commissionRate: 0.07,
        commissionBasis: 'sales',
        comisionPct: 7,
      }),
    );
  });

  it('sobre servicio: la base ya viene en servicio, la tasa se aplica igual', async () => {
    const nomina = {
      ...NOMINA_DEFAULT,
      commissionRate: 0.5,
      commissionBasis: 'service' as const,
    };
    const { service, pagoModel } = await servicioCon([orden('o1', 10, nomina)]);

    await service.pagarComision(pedirPago(['o1']));

    expect(pagoModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ montoTotal: 5, commissionBasis: 'service' }),
    );
  });

  it('la orden conserva la tasa con que nacio: cambiar la nomina no mueve su comision', async () => {
    const vigentes = { nomina: { ...NOMINA_DEFAULT, commissionRate: 0.2 } };
    const { service, pagoModel } = await servicioCon(
      [orden('o1', 100)],
      vigentes,
    );

    await service.pagarComision(pedirPago(['o1']));

    expect(pagoModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ montoTotal: 7, commissionRate: 0.07 }),
    );
  });

  it('un comisionPct explicito del pago reemplaza la tasa de las ordenes', async () => {
    const { service, pagoModel } = await servicioCon([orden('o1', 100)]);

    await service.pagarComision(pedirPago(['o1'], 12));

    expect(pagoModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        montoTotal: 12,
        commissionRate: 0.12,
        comisionPct: 12,
      }),
    );
  });
});
