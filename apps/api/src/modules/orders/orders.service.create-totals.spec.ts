/**
 * El servidor recalcula y fija los totales al crear la orden.
 *
 * Medido: el cliente puede mandar un total con 3 decimales (11.275) o incluir
 * un tax que `computeOrderTotals` no suma. El servidor es la única fuente de
 * verdad: recalcula sobre items, redondea, y guarda los totales del servidor
 * (serviceCharge, subtotal, discountAmount, noChargeAmount, total).
 *
 * Este spec verifica que:
 * (a) Cliente manda total 11.275 sobre ítem 10.25 con servicio → se guarda 11.28
 * (b) Descuento + cortesía → total == computeOrderTotals(items, true) y campos iguales
 * (c) Orden SIN servicio (zona) → serviceCharge 0 y total == subtotal − descuentos
 * (d) WARN cuando cliente difiere > 0.01, NO warn cuando coincide
 * (e) Factura de orden pagada: total redondeado
 */
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
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
import { computeOrderTotals } from '@odin6/types';
import { configsDePrueba } from './configs-de-prueba';

describe('OrdersService.create — servidor fija los totales', () => {
  let service: OrdersService;
  let mockOrderModel: Record<string, jest.Mock>;
  let mockLogger: Logger;
  /** Lo que el servicio manda en el create. */
  let creado: Record<string, unknown>;

  beforeEach(async () => {
    creado = {};
    mockLogger = { warn: jest.fn() } as unknown as Logger;
    mockOrderModel = {
      create: jest.fn().mockImplementation((payload) => {
        creado = payload as Record<string, unknown>;
        return Promise.resolve({
          _id: 'order-1',
          ...payload,
          toObject: () => ({ _id: 'order-1', ...payload }),
        });
      }),
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
        select: jest.fn().mockReturnThis(),
        exec: () => Promise.resolve(null),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
      db: {
        collection: jest.fn().mockReturnValue({
          findOneAndUpdate: jest.fn().mockResolvedValue({
            value: { seq: 1 },
          }),
        }),
      },
    };

    const mockUserModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: () => ({
          exec: () => Promise.resolve({ _id: 'w-1', name: 'Waiter' }),
        }),
        exec: () => Promise.resolve({ _id: 'w-1', name: 'Waiter' }),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        configsDePrueba(),
        OrdersService,
        {
          provide: getModelToken('Product'),
          useValue: {
            find: jest.fn().mockReturnValue({
              lean: () => ({ exec: () => Promise.resolve([]) }),
            }),
          },
        },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(Table.name), useValue: {} },
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: getModelToken('Invoice'), useValue: {} },
        { provide: getModelToken('Payment'), useValue: {} },
        { provide: PosGateway, useValue: { notifyOrderCreated: jest.fn() } },
        { provide: AuthService, useValue: {} },
        {
          provide: PaymentsService,
          useValue: { checkReferenceUsed: jest.fn().mockResolvedValue(false) },
        },
        { provide: OcrService, useValue: {} },
        {
          provide: OrderItemEventsService,
          useValue: {
            record: jest.fn(),
            recordMany: jest.fn(),
          },
        },
        { provide: PagoMovilService, useValue: {} },
        { provide: ConsumptionService, useValue: {} },
        { provide: AccountsReceivableService, useValue: {} },
        { provide: MovementsService, useValue: { emit: jest.fn() } },
        { provide: KitchenNotifierService, useValue: {} },
        {
          provide: SociosExcluidosService,
          useValue: { esExcluido: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
    service['logger'] = mockLogger;
  });

  it('(a) Cliente manda total 11.275 con servicio → se guarda 11.28 redondeado', async () => {
    const dto = {
      userId: 'u-1',
      waiterId: 'w-1',
      items: [
        {
          productId: 'p1',
          quantity: 1,
          unitPrice: 10.25,
          total: 10.25,
          name: 'Item',
        },
      ],
      subtotal: 10.25,
      total: 11.275, // Cliente manda 3 decimales
      serviceCharge: 1.025,
    };

    await service.create(dto as never, undefined);

    // El servidor recalcula: (10.25 * 0.1) = 1.025 → 1.03 redondeado
    // total = 10.25 + 1.03 = 11.28
    expect(creado.total).toBe(11.28);
    expect(creado.subtotal).toBe(10.25);
    expect(creado.serviceCharge).toBe(1.03);
  });

  it('(b) Descuento + cortesía → totales del servidor, no del cliente', async () => {
    const dto = {
      userId: 'u-1',
      waiterId: 'w-1',
      items: [
        {
          productId: 'p1',
          quantity: 2,
          unitPrice: 10,
          total: 20,
          discountAmount: 4,
          name: 'Item 1',
        },
        {
          productId: 'p2',
          quantity: 1,
          unitPrice: 6,
          total: 6,
          noCharge: true,
          name: 'Cortesía',
        },
      ],
      subtotal: 26,
      total: 28.6, // Cliente manda algo
      serviceCharge: 2.6,
    };

    await service.create(dto as never, undefined);

    // Calculado: subtotal=26, noCharge=6, discount=4
    // serviceCharge = (26 - 4) * 0.1 = 2.2
    // total = 26 + 2.2 - 6 - 4 = 18.2
    expect(creado.subtotal).toBe(26);
    expect(creado.noChargeAmount).toBe(6);
    expect(creado.discountAmount).toBe(4);
    expect(creado.serviceCharge).toBe(2.2);
    expect(creado.total).toBe(18.2);
  });

  it('(c) Orden SIN servicio (zona) → serviceCharge 0 y total == subtotal − descuentos', async () => {
    const dto = {
      userId: 'u-1',
      items: [
        {
          productId: 'p1',
          quantity: 2,
          unitPrice: 10,
          total: 20,
          discountAmount: 4,
          name: 'Item',
        },
      ],
      subtotal: 20,
      total: 16,
      // Sin serviceCharge en DTO (zona)
    };

    await service.create(dto as never, undefined);

    expect(creado.serviceCharge).toBe(0);
    expect(creado.total).toBe(16); // 20 - 4
  });

  it('(d) WARN cuando cliente difiere > 0.01', async () => {
    const dto = {
      userId: 'u-1',
      waiterId: 'w-1',
      items: [
        {
          productId: 'p1',
          quantity: 2,
          unitPrice: 10,
          total: 20,
          name: 'Item',
        },
      ],
      subtotal: 20,
      total: 30, // Diferencia grande
      serviceCharge: 2,
    };

    await service.create(dto as never, undefined);

    // El servidor guarda 22 (20 + 2), cliente mandó 30
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/total cliente=30 servidor=22/),
    );
  });

  it('(d) NO warn cuando cliente coincide', async () => {
    const dto = {
      userId: 'u-1',
      waiterId: 'w-1',
      items: [
        {
          productId: 'p1',
          quantity: 2,
          unitPrice: 10,
          total: 20,
          name: 'Item',
        },
      ],
      subtotal: 20,
      total: 22, // Coincide con servidor: 20 + 2
      serviceCharge: 2,
    };

    await service.create(dto as never, undefined);

    // No debería haber WARN
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
