/**
 * Descuento por producto autorizado con PIN de administrador.
 *
 * Es plata que sale de la caja por decision de una persona, asi que cada
 * rebaja exige PIN + motivo y queda con nombre y apellido en la auditoria.
 * A diferencia de la cortesia, el descuento SI baja la base del 10% de
 * servicio (y con ella la comision del mesonero).
 */
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
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
import { configsDePrueba } from './configs-de-prueba';

describe('OrdersService - descuento por producto', () => {
  let service: OrdersService;
  let mockOrderModel: Record<string, jest.Mock>;
  let verifyAdminPin: jest.Mock;
  let record: jest.Mock;

  const orderId = '507f1f77bcf86cd799439011';
  const admin = { id: 'u-cajero', role: 'admin', name: 'Cajero' };

  function makeOrder(over: Record<string, unknown> = {}) {
    return {
      _id: orderId,
      orderNumber: 'A1B2C3D4',
      paymentStatus: 'pending',
      isDeleted: false,
      subtotal: 100,
      serviceCharge: 10,
      total: 110,
      waiterId: 'w-1',
      items: [
        {
          _id: 'item-1',
          productId: 'p1',
          name: 'Pizza Margarita',
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
      save: jest.fn().mockResolvedValue(true),
      markModified: jest.fn(),
      toObject() {
        return this;
      },
      ...over,
    };
  }

  beforeEach(async () => {
    mockOrderModel = { findOne: jest.fn(), updateOne: jest.fn() };
    verifyAdminPin = jest
      .fn()
      .mockResolvedValue({ valid: true, adminId: 'admin-9' });
    record = jest.fn();
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
        { provide: AuthService, useValue: { verifyAdminPin } },
        { provide: PaymentsService, useValue: {} },
        { provide: OcrService, useValue: {} },
        {
          provide: OrderItemEventsService,
          useValue: { record, recordMany: jest.fn(), findByOrder: jest.fn() },
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

  const apply = (body: Record<string, unknown> = {}) =>
    service.discountItem(
      orderId,
      'item-1',
      {
        type: 'PCT',
        value: 25,
        reason: 'demora de 40 minutos',
        adminPin: '1234',
        ...body,
      } as never,
      admin as never,
    );

  it('aplica un 25% y recalcula el servicio sobre lo que se cobra', async () => {
    const order = makeOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });

    await apply();

    expect(order.items[0].discountAmount).toBe(25);
    expect(order.items[0].discountType).toBe('PCT');
    expect(order.items[0].discountReason).toBe('demora de 40 minutos');
    // El servicio baja: 10% de (100 - 25)
    expect(order.serviceCharge).toBe(7.5);
    expect(order.total).toBe(82.5); // 100 + 7.5 - 25
    expect(order.save).toHaveBeenCalled();
  });

  it('acepta un descuento en monto', async () => {
    const order = makeOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });

    await apply({ type: 'AMOUNT', value: 30 });

    expect(order.items[0].discountAmount).toBe(30);
    expect(order.total).toBe(77); // 100 + 7 - 30
  });

  it('deja el descuento en la auditoria con quien lo autorizo', async () => {
    const order = makeOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });

    await apply();

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ITEM_DISCOUNT',
        reason: 'demora de 40 minutos',
        pinValidated: true,
        pinValidatedByUserId: 'admin-9',
      }),
    );
  });

  it('rechaza el PIN invalido', async () => {
    verifyAdminPin.mockResolvedValue({ valid: false });
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(makeOrder()),
    });
    await expect(apply()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('exige motivo', async () => {
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(makeOrder()),
    });
    await expect(apply({ reason: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('no descuenta sobre una orden ya pagada', async () => {
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(makeOrder({ paymentStatus: 'paid' })),
    });
    await expect(apply()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no descuenta un item que ya es cortesia', async () => {
    const order = makeOrder();
    order.items[0] = { ...order.items[0], noCharge: true } as never;
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    await expect(apply()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza pasar del tope del 50%', async () => {
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(makeOrder()),
    });
    await expect(apply({ value: 60 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('revierte el descuento y devuelve los totales al precio pleno', async () => {
    const order = makeOrder();
    mockOrderModel.findOne.mockReturnValue({
      exec: () => Promise.resolve(order),
    });
    await apply();

    await service.removeItemDiscount(
      orderId,
      'item-1',
      { reason: 'lo aplique a la linea equivocada', adminPin: '1234' } as never,
      admin as never,
    );

    expect(order.items[0].discountAmount).toBe(0);
    expect(order.items[0].discountType).toBeUndefined();
    expect(order.serviceCharge).toBe(10);
    expect(order.total).toBe(110);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ITEM_DISCOUNT_REMOVED' }),
    );
  });

  describe('responsable de la cortesia', () => {
    it('guarda de quien fue el error SIN tocar la comision del mesonero', async () => {
      const order = makeOrder();
      mockOrderModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(order),
      });

      await service.noChargeItem(
        orderId,
        'item-1',
        'plato quemado',
        '1234',
        admin as never,
        'COCINA',
      );

      expect(order.items[0].noChargeResponsible).toBe('COCINA');
      // El servicio se mantiene sobre el precio pleno: la cortesia no le
      // quita comision al mesonero.
      expect(order.serviceCharge).toBe(10);
      expect(order.total).toBe(10); // 100 + 10 - 100
    });

    it('la cortesia TOTAL tambien registra el responsable', async () => {
      const order = makeOrder();
      mockOrderModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(order),
      });

      await service.fullCourtesy(
        orderId,
        'premio del evento',
        '1234',
        admin as never,
        'CASA',
      );

      expect(order.items[0].noChargeResponsible).toBe('CASA');
    });

    it('acepta una cortesia sin responsable (clientes viejos)', async () => {
      const order = makeOrder();
      mockOrderModel.findOne.mockReturnValue({
        exec: () => Promise.resolve(order),
      });

      await service.noChargeItem(
        orderId,
        'item-1',
        'invitacion',
        '1234',
        admin as never,
      );

      expect(order.items[0].noCharge).toBe(true);
      expect(order.items[0].noChargeResponsible).toBeUndefined();
    });
  });
});
