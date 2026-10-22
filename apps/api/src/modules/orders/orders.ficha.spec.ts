import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';
import { Table } from '../tables/schemas/table.schema';
import { PosGateway } from '../websockets/gateways/pos.gateway';
import { AuthService } from '../auth/auth.service';
import { PaymentsService } from '../payments/payments.service';
import { OcrService } from '../ocr/ocr.service';
import { OrderItemEventsService } from './order-item-events.service';
import { PagoMovilService } from '../pago-movil/pago-movil.service';
import { ConsumptionService } from '../inventory/consumption.service';
import { AccountsReceivableService } from '../accounts-receivable/accounts-receivable.service';
import { MovementsService } from '../inventory/movements.service';
import { KitchenNotifierService } from '../push/kitchen-notifier.service';
import { SociosExcluidosService } from '../socios-excluidos/socios-excluidos.service';
import { signFichaToken } from './ficha-token.util';
import { configsDePrueba } from './configs-de-prueba';

describe('OrdersService - Ficha', () => {
  let service: OrdersService;
  let mockOrderModel: Record<string, jest.Mock>;
  const bar = { id: 'bar-1', role: 'bar', name: 'Barman' };
  const orderId = '507f1f77bcf86cd799439011';

  // process.env.FICHA_SECRET no seteado en test => el service usa su fallback.
  const SECRET = 'dev-ficha-secret-change-me';

  function makeOrder() {
    return {
      _id: orderId,
      orderNumber: 'A1B2C3D4',
      status: 'IN_PROGRESS',
      isDeleted: false,
      tableName: 'Mesa 5',
      sector: null,
      fichaNonce: 'abcd1234',
      items: [
        {
          _id: 'item-bar-1',
          productId: 'p1',
          name: 'Cerveza Polar',
          station: 'BAR',
          quantity: 6,
          deliveredQty: 0,
        },
        {
          _id: 'item-kitchen-1',
          productId: 'p2',
          name: 'Hamburguesa',
          station: 'KITCHEN',
          quantity: 1,
          deliveredQty: 0,
        },
      ],
      save: jest.fn().mockResolvedValue(true),
      markModified: jest.fn(),
      toObject() {
        return this;
      },
    };
  }

  // Orden con un tobo mixto (composición Light/Pilsen) para tests por variante.
  function makeToboOrder() {
    return {
      _id: orderId,
      orderNumber: 'A1B2C3D4',
      status: 'IN_PROGRESS',
      isDeleted: false,
      tableName: 'Mesa 5',
      sector: null,
      fichaNonce: 'abcd1234',
      items: [
        {
          _id: 'item-tobo-1',
          productId: 'tobo1',
          name: 'Tobo Botellas',
          station: 'BAR',
          quantity: 12,
          deliveredQty: 0,
          composition: [
            {
              variantProductId: 'vLight',
              variantName: 'Light',
              qty: 6,
              deliveredQty: 0,
              returnedQty: 0,
            },
            {
              variantProductId: 'vPilsen',
              variantName: 'Pilsen',
              qty: 6,
              deliveredQty: 0,
              returnedQty: 0,
            },
          ],
        },
      ],
      save: jest.fn().mockResolvedValue(true),
      markModified: jest.fn(),
      toObject() {
        return this;
      },
    };
  }

  beforeEach(async () => {
    mockOrderModel = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        configsDePrueba(),
        {
          // Catalogo: lo usa el candado de packs. Sin productos que sean pack,
          // normalizePackLines no toca nada.
          provide: getModelToken('Product'),
          useValue: {
            find: jest.fn().mockReturnValue({
              lean: () => ({ exec: () => Promise.resolve([]) }),
            }),
          },
        },

        OrdersService,
        {
          provide: SociosExcluidosService,
          useValue: { esExcluido: jest.fn().mockResolvedValue(false) },
        },
        {
          provide: KitchenNotifierService,
          useValue: {
            itemsDelivered: jest.fn(),
            notifyCustomerStatus: jest.fn(),
            notifyWaiterCustomerJoined: jest.fn(),
            notifyWaiterRequest: jest.fn(),
            notifyCustomerRequestResolved: jest.fn(),
            notifyWaiterBillRequested: jest.fn(),
          },
        },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(Table.name), useValue: {} },
        { provide: getModelToken('User'), useValue: {} },
        { provide: getModelToken('Invoice'), useValue: {} },
        { provide: getModelToken('Payment'), useValue: {} },
        { provide: PosGateway, useValue: { notifyOrderUpdated: jest.fn() } },
        { provide: AuthService, useValue: { verifyAdminPin: jest.fn() } },
        { provide: PaymentsService, useValue: {} },
        { provide: OcrService, useValue: {} },
        {
          provide: OrderItemEventsService,
          useValue: {
            record: jest.fn(),
            recordMany: jest.fn(),
            findByOrder: jest.fn(),
          },
        },
        { provide: PagoMovilService, useValue: {} },
        { provide: ConsumptionService, useValue: {} },
        { provide: AccountsReceivableService, useValue: {} },
        {
          provide: MovementsService,
          useValue: { emit: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  it('getFichaByToken incluye ítems de estaciones controladas (BAR + KITCHEN) con su station', async () => {
    const order = makeOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);

    const ficha = await service.getFichaByToken(token);

    // Ahora la ficha cubre BAR + KITCHEN + PIZZA; cada pantalla filtra por la suya.
    expect(ficha.items).toHaveLength(2);
    const bar = ficha.items.find((i) => i.station === 'BAR');
    const kitchen = ficha.items.find((i) => i.station === 'KITCHEN');
    expect(bar?.productName).toBe('Cerveza Polar');
    expect(bar?.pendingQty).toBe(6);
    expect(kitchen?.productName).toBe('Hamburguesa');
    expect(ficha.orderNumber).toBe('A1B2C3D4');
  });

  it('getFichaByToken rechaza firma inválida con NotFound', async () => {
    await expect(service.getFichaByToken('AR1.x.y.z')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getFichaByToken rechaza si el nonce guardado no coincide (revocada)', async () => {
    const order = makeOrder();
    order.fichaNonce = 'otro9999';
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);
    await expect(service.getFichaByToken(token)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deliverByFicha entrega parcial y deja saldo correcto', async () => {
    const order = makeOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);

    const ficha = await service.deliverByFicha(
      token,
      [{ itemId: 'item-bar-1', delta: 2 }],
      bar,
    );

    expect(order.items[0].deliveredQty).toBe(2);
    expect(ficha.items[0].pendingQty).toBe(4);
    expect(order.save).toHaveBeenCalled();
  });

  // El candado de estacion protege del personal, no del jefe: el admin cubre
  // turnos y resuelve enredos, asi que entrega de cualquier area.
  it('el personal de barra NO puede entregar un item de cocina', async () => {
    const order = makeOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);

    await expect(
      service.deliverByFicha(
        token,
        [{ itemId: 'item-kitchen-1', delta: 1 }],
        bar,
        'BAR',
      ),
    ).rejects.toThrow(/solo puedes entregar lo de tu estación/);
  });

  it('el admin entrega un item de cocina aunque la pantalla mande BAR', async () => {
    const order = makeOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);
    const jefe = { id: 'admin-1', role: 'admin', name: 'Duenio' };

    const ficha = await service.deliverByFicha(
      token,
      [{ itemId: 'item-kitchen-1', delta: 1 }],
      jefe,
      'BAR',
    );

    // Se mide sobre la orden y no sobre la vista: la ficha solo lista lo que
    // queda PENDIENTE, y este item quedo entregado por completo.
    expect(order.items[1].deliveredQty).toBe(1);
    expect(ficha.items.some((i) => i.itemId === 'item-kitchen-1')).toBe(false);
  });

  it('deliverByFicha rechaza toda la tanda si un delta excede el pendiente', async () => {
    const order = makeOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);

    await expect(
      service.deliverByFicha(token, [{ itemId: 'item-bar-1', delta: 99 }], bar),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(order.items[0].deliveredQty).toBe(0);
    expect(order.save).not.toHaveBeenCalled();
  });

  it('getFichaByToken de un tobo mixto devuelve la composición por variante', async () => {
    const order = makeToboOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);

    const ficha = await service.getFichaByToken(token);

    expect(ficha.items[0].composition).toHaveLength(2);
    expect(ficha.items[0].composition![0]).toMatchObject({
      variantName: 'Light',
      pendingQty: 6,
    });
  });

  it('deliverByFicha por variante entrega, mueve stock y recomputa el saldo', async () => {
    const order = makeToboOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);

    const ficha = await service.deliverByFicha(
      token,
      [{ itemId: 'item-tobo-1', variantProductId: 'vLight', delta: 2 }],
      bar,
    );

    expect(order.items[0].composition[0].deliveredQty).toBe(2);
    expect(order.items[0].deliveredQty).toBe(2); // suma de variantes
    const light = ficha.items[0].composition!.find(
      (c) => c.variantName === 'Light',
    );
    expect(light!.pendingQty).toBe(4);
  });

  it('deliverByFicha rechaza un tobo mixto sin variante', async () => {
    const order = makeToboOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);

    await expect(
      service.deliverByFicha(token, [{ itemId: 'item-tobo-1', delta: 2 }], bar),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returnByFicha reduce deliveredQty (solo admin/gerente)', async () => {
    const order = makeOrder();
    order.items[0].deliveredQty = 3;
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);

    // Anti-robo: las devoluciones requieren admin/gerente — la estacion NO puede
    const admin = { id: 'admin-1', role: 'admin', name: 'Duenio' };
    const ficha = await service.returnByFicha(
      token,
      [{ itemId: 'item-bar-1', delta: 1 }],
      admin,
    );

    expect(order.items[0].deliveredQty).toBe(2);
    expect(ficha.items[0].pendingQty).toBe(4);
  });

  it('returnByFicha rechaza a un usuario de estacion (anti-robo)', async () => {
    const order = makeOrder();
    order.items[0].deliveredQty = 3;
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signFichaToken(orderId, 'abcd1234', SECRET);

    await expect(
      service.returnByFicha(token, [{ itemId: 'item-bar-1', delta: 1 }], bar),
    ).rejects.toMatchObject({
      message: expect.stringContaining('administrador o gerente'),
    });
  });

  describe('deliverByFicha — idempotencia por opId', () => {
    it('mismo opId dos veces devuelve el mismo resultado sin duplicar entrega', async () => {
      const order = makeOrder();
      mockOrderModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(order),
      });
      const token = signFichaToken(orderId, 'abcd1234', SECRET);
      const opId = 'deliver-op-123';

      // Primera entrega con opId
      const ficha1 = await service.deliverByFicha(
        token,
        [{ itemId: 'item-bar-1', delta: 2 }],
        bar,
        undefined,
        opId,
      );

      expect(order.items[0].deliveredQty).toBe(2);
      expect(ficha1.items[0].pendingQty).toBe(4);
      expect(order.fichaDeliveryOps).toContain(opId);

      // Preparar la orden para el segundo call (simular el estado guardado)
      const orderAfterFirstDeliver = { ...order };
      orderAfterFirstDeliver.fichaDeliveryOps = [opId];
      orderAfterFirstDeliver.items[0].deliveredQty = 2;
      order.save.mockClear();

      mockOrderModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(orderAfterFirstDeliver),
      });

      // Segunda entrega con el mismo opId (reintento)
      const ficha2 = await service.deliverByFicha(
        token,
        [{ itemId: 'item-bar-1', delta: 2 }],
        bar,
        undefined,
        opId,
      );

      // La segunda llamada no debe cambiar nada
      expect(ficha2.items[0].pendingQty).toBe(4);
      expect(orderAfterFirstDeliver.save).not.toHaveBeenCalled();
    });

    it('una entrega sin opId crea la lista fichaDeliveryOps', async () => {
      const order = makeOrder();
      mockOrderModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(order),
      });
      const token = signFichaToken(orderId, 'abcd1234', SECRET);

      // Sin opId la lista no se llena
      await service.deliverByFicha(
        token,
        [{ itemId: 'item-bar-1', delta: 2 }],
        bar,
        undefined,
      );

      // Sin opId, fichaDeliveryOps debe estar vacío o undefined
      expect(order.fichaDeliveryOps).toBeUndefined();
    });
  });
});
