import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';
import { Table } from '../tables/schemas/table.schema';
import { PosGateway } from '../websockets/gateways/pos.gateway';
import { KitchenNotifierService } from '../push/kitchen-notifier.service';
import { SociosExcluidosService } from '../socios-excluidos/socios-excluidos.service';
import { AuthService } from '../auth/auth.service';
import { PaymentsService } from '../payments/payments.service';
import { OcrService } from '../ocr/ocr.service';
import { OrderItemEventsService } from './order-item-events.service';
import { PagoMovilService } from '../pago-movil/pago-movil.service';
import { ConsumptionService } from '../inventory/consumption.service';
import { AccountsReceivableService } from '../accounts-receivable/accounts-receivable.service';
import { MovementsService } from '../inventory/movements.service';
import { signLinkToken } from './link-token.util';
import { configsDePrueba } from './configs-de-prueba';

describe('OrdersService - Vinculo por QR', () => {
  let service: OrdersService;
  let mockOrderModel: Record<string, jest.Mock>;
  const notifier = {
    itemsDelivered: jest.fn(),
    notifyCustomerStatus: jest.fn(),
    notifyWaiterCustomerJoined: jest.fn(),
  };
  const orderId = '507f1f77bcf86cd799439011';
  const SECRET = 'dev-link-secret-change-me'; // fallback del service en test

  function makeOrder(overrides: Record<string, unknown> = {}) {
    const order: Record<string, unknown> = {
      _id: orderId,
      status: 'IN_PROGRESS',
      isDeleted: false,
      linkNonce: 'abcd1234',
      waiterId: 'waiter-1',
      sector: null,
      customerName: undefined,
      save: jest.fn().mockResolvedValue(true),
      toObject() {
        return { ...order };
      },
      ...overrides,
    };
    return order;
  }

  beforeEach(async () => {
    mockOrderModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOne: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        configsDePrueba(),
        {
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
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(Table.name), useValue: {} },
        { provide: getModelToken('User'), useValue: {} },
        { provide: getModelToken('Invoice'), useValue: {} },
        { provide: getModelToken('Payment'), useValue: {} },
        { provide: PosGateway, useValue: { notifyOrderUpdated: jest.fn() } },
        { provide: KitchenNotifierService, useValue: notifier },
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

  it('linkCustomer setea customerId en orden activa y avisa al mesonero', async () => {
    const order = makeOrder();
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signLinkToken(orderId, 'abcd1234', SECRET);

    const linked = await service.linkCustomer(token, 'cust-123', 'Ana');

    expect(linked.customerId).toBe('cust-123');
    expect(linked.customerName).toBe('Ana');
    expect(order.save).toHaveBeenCalled();
    expect(notifier.notifyWaiterCustomerJoined).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        waiterId: 'waiter-1',
        customerName: 'Ana',
      }),
    );
  });

  it('rechaza token invalido', async () => {
    await expect(
      service.linkCustomer('ARL1.x.y.bad', 'c', 'x'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza QR vencido (nonce no coincide)', async () => {
    const order = makeOrder({ linkNonce: 'otro9999' });
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signLinkToken(orderId, 'abcd1234', SECRET);
    await expect(service.linkCustomer(token, 'c', 'x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza vincular orden pagada', async () => {
    const order = makeOrder({ status: 'PAID' });
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const token = signLinkToken(orderId, 'abcd1234', SECRET);
    await expect(service.linkCustomer(token, 'c', 'x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('getOrCreateLinkToken genera nonce si falta y devuelve token ARL1', async () => {
    const order = makeOrder({ linkNonce: undefined });
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const { token } = await service.getOrCreateLinkToken(orderId);
    expect(token.startsWith('ARL1.')).toBe(true);
    expect(order.save).toHaveBeenCalled();
  });

  it('getOrCreateLinkToken 404 si la orden no existe', async () => {
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(null),
    });
    await expect(service.getOrCreateLinkToken(orderId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
