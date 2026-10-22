import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
import { configsDePrueba } from './configs-de-prueba';

describe('OrdersService - Solicitudes del cliente', () => {
  let service: OrdersService;
  let mockOrderModel: Record<string, jest.Mock>;
  let productDoc: Record<string, unknown> | null;
  const notifier = {
    itemsDelivered: jest.fn(),
    notifyWaiterRequest: jest.fn(),
    notifyCustomerRequestResolved: jest.fn(),
    notifyWaiterBillRequested: jest.fn(),
  };
  const orderId = '507f1f77bcf86cd799439011';

  function makeOrder(overrides: Record<string, unknown> = {}) {
    const order: Record<string, unknown> = {
      _id: orderId,
      status: 'IN_PROGRESS',
      isDeleted: false,
      customerId: 'cust-1',
      customerName: 'Ana',
      waiterId: 'waiter-1',
      sector: null,
      items: [],
      customerRequests: [],
      billRequested: false,
      save: jest.fn().mockResolvedValue(true),
      markModified: jest.fn(),
      toObject() {
        return { ...order };
      },
      ...overrides,
    };
    return order;
  }

  beforeEach(async () => {
    productDoc = {
      _id: 'p1',
      name: 'Cerveza',
      price: 5,
      station: 'BAR',
      isForSale: true,
    };
    const productModel = {
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([]) }),
      }),
      findById: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(productDoc) }),
      }),
    };
    mockOrderModel = { findById: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        configsDePrueba(),
        { provide: getModelToken('Product'), useValue: productModel },
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

  it('createCustomerRequest PRODUCT queda PENDING y avisa al mesonero', async () => {
    const order = makeOrder();
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(order),
    });

    const res = await service.createCustomerRequest(orderId, 'cust-1', {
      type: 'PRODUCT',
      productId: 'p1',
      quantity: 2,
    });

    const reqs = res.customerRequests as Array<{
      status: string;
      quantity?: number;
      productName?: string;
    }>;
    expect(reqs).toHaveLength(1);
    expect(reqs[0].status).toBe('PENDING');
    expect(reqs[0].quantity).toBe(2);
    expect(reqs[0].productName).toBe('Cerveza');
    expect(notifier.notifyWaiterRequest).toHaveBeenCalled();
  });

  it('rechaza si el que solicita no es el cliente vinculado', async () => {
    const order = makeOrder();
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    await expect(
      service.createCustomerRequest(orderId, 'otro', { type: 'CALL_WAITER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza producto no en venta', async () => {
    productDoc = { _id: 'p1', name: 'X', price: 5, isForSale: false };
    const order = makeOrder();
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    await expect(
      service.createCustomerRequest(orderId, 'cust-1', {
        type: 'PRODUCT',
        productId: 'p1',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolver ACCEPT agrega el item a la orden y marca ACCEPTED', async () => {
    const order = makeOrder({
      customerRequests: [
        {
          id: 'r1',
          type: 'PRODUCT',
          productId: 'p1',
          quantity: 1,
          status: 'PENDING',
          createdByCustomerId: 'cust-1',
          createdAt: new Date(),
        },
      ],
    });
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(order),
    });

    const res = await service.resolveCustomerRequest(
      orderId,
      'r1',
      'waiter-1',
      'ACCEPT',
    );
    const items = res.items as Array<{ productId?: string }>;
    expect(items.some((i) => i.productId === 'p1')).toBe(true);
    const reqs = res.customerRequests as Array<{ status: string }>;
    expect(reqs[0].status).toBe('ACCEPTED');
    expect(notifier.notifyCustomerRequestResolved).toHaveBeenCalled();
  });

  it('requestBill marca billRequested y avisa al mesonero', async () => {
    const order = makeOrder();
    mockOrderModel.findById.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    const res = await service.requestBill(orderId, 'cust-1');
    expect(res.billRequested).toBe(true);
    expect(notifier.notifyWaiterBillRequested).toHaveBeenCalled();
  });
});
