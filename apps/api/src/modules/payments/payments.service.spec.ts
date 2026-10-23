import { CONFIG_DEFAULTS, ConfigId } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { CustomerNotifierService } from '../sms/customer-notifier.service';
import { CustomerDebtService } from '../sms/customer-debt.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment } from './schemas/payment.schema';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentModel: Record<string, jest.Mock>;
  let orderModel: Record<string, jest.Mock>;
  let pagoMovilModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    // Modelos mockeados
    paymentModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn(),
    };

    orderModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };

    pagoMovilModel = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getModelToken(Payment.name),
          useValue: paymentModel,
        },
        {
          provide: getModelToken('Order'),
          useValue: orderModel,
        },
        {
          provide: getModelToken('PagoMovil'),
          useValue: pagoMovilModel,
        },
        {
          // El aviso de compra por SMS busca el telefono del cliente
          provide: getModelToken('Customer'),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              select: () => ({
                lean: () => ({ exec: () => Promise.resolve(null) }),
              }),
            }),
          },
        },
        {
          // Servicio compartido: calcula cuanto debe el cliente en total.
          provide: CustomerDebtService,
          useValue: {
            forCustomer: jest
              .fn()
              .mockResolvedValue({ count: 0, total: 0, orphanCount: 0 }),
          },
        },
        {
          provide: CustomerNotifierService,
          useValue: {
            notify: jest.fn().mockResolvedValue({ channel: 'sms', sent: true }),
          },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
        {
          provide: ConfigsService,
          useValue: {
            obtener: (id: ConfigId) => Promise.resolve(CONFIG_DEFAULTS[id]),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('findByWaiter', () => {
    it('lanza BadRequestException si waiterId no se proporciona', async () => {
      await expect(
        service.findByWaiter('', undefined, undefined),
      ).rejects.toThrow(new BadRequestException('waiterId es requerido'));
    });

    it('lanza BadRequestException si waiterId es undefined', async () => {
      await expect(service.findByWaiter('')).rejects.toThrow(
        new BadRequestException('waiterId es requerido'),
      );
    });

    it('une pagos↔órdenes y normaliza ids (_id → id)', async () => {
      const waiterId = 'waiter-123';

      // Órdenes mockeadas
      const orders = [
        {
          _id: 'order-1',
          orderNumber: 'A1B2',
          tableName: 'Mesa 5',
          total: 29.0,
          tipAmount: 2.0,
          serviceCharge: 2.9,
          paymentStatus: 'paid',
          createdAt: new Date('2026-07-15'),
        },
      ];

      // Pagos mockeados
      const payments = [
        {
          _id: 'payment-1',
          orderId: 'order-1',
          amount: 12.5,
          method: 'PAGO_MOVIL',
          transactionId: '1234',
          bcvRate: 724.3,
          expectedAmountBS: 9053.75,
          notes: null,
          userId: 'user-456',
          createdAt: new Date('2026-07-15T14:30:00Z'),
        },
      ];

      // Mock chain para órdenes
      orderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(orders),
          }),
        }),
      });

      // Mock chain para pagos
      paymentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(payments),
          }),
        }),
      });

      const result = await service.findByWaiter(waiterId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'payment-1',
        orderId: 'order-1',
        amount: 12.5,
        method: 'PAGO_MOVIL',
        reference: '1234',
        bcvRate: 724.3,
        expectedAmountBS: 9053.75,
        notes: null,
        userId: 'user-456',
        createdAt: payments[0].createdAt,
        order: {
          id: 'order-1',
          orderNumber: 'A1B2',
          tableName: 'Mesa 5',
          total: 29.0,
          tipAmount: 2.0,
          serviceCharge: 2.9,
          paymentStatus: 'paid',
          createdAt: orders[0].createdAt,
        },
      });
    });

    it('excluye pagos cuya orden no está en el set (pago huérfano)', async () => {
      const waiterId = 'waiter-123';

      const orders = [
        {
          _id: 'order-1',
          orderNumber: 'A1B2',
          tableName: 'Mesa 5',
          total: 29.0,
          tipAmount: 2.0,
          serviceCharge: 2.9,
          paymentStatus: 'paid',
          createdAt: new Date('2026-07-15'),
        },
      ];

      // Dos pagos: uno válido y uno huérfano (orderId no coincide)
      const payments = [
        {
          _id: 'payment-1',
          orderId: 'order-1',
          amount: 12.5,
          method: 'CASH_USD',
          transactionId: null,
          bcvRate: null,
          expectedAmountBS: null,
          notes: null,
          userId: 'user-456',
          createdAt: new Date('2026-07-15T14:30:00Z'),
        },
        {
          _id: 'payment-orphan',
          orderId: 'order-nonexistent',
          amount: 5.0,
          method: 'CASH_USD',
          transactionId: null,
          bcvRate: null,
          expectedAmountBS: null,
          notes: null,
          userId: 'user-456',
          createdAt: new Date('2026-07-15T15:00:00Z'),
        },
      ];

      orderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(orders),
          }),
        }),
      });

      paymentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(payments),
          }),
        }),
      });

      const result = await service.findByWaiter(waiterId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('payment-1');
    });

    it('filtra pagos por rango de fechas (from/to) sobre la fecha del pago', async () => {
      const waiterId = 'waiter-123';
      const from = '2026-07-10T00:00:00Z';
      const to = '2026-07-15T23:59:59Z';

      const orders = [
        {
          _id: 'order-1',
          orderNumber: 'A1B2',
          tableName: 'Mesa 5',
          total: 29.0,
          tipAmount: 2.0,
          serviceCharge: 2.9,
          paymentStatus: 'paid',
          createdAt: new Date('2026-07-15'),
        },
      ];

      const payments = [
        {
          _id: 'payment-1',
          orderId: 'order-1',
          amount: 12.5,
          method: 'CARD',
          transactionId: '5678',
          bcvRate: null,
          expectedAmountBS: null,
          notes: null,
          userId: 'user-456',
          createdAt: new Date('2026-07-15T14:30:00Z'),
        },
      ];

      orderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(orders),
          }),
        }),
      });

      paymentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(payments),
          }),
        }),
      });

      const result = await service.findByWaiter(waiterId, from, to);

      // Las órdenes se buscan SIN rango de fechas (solo waiterId)
      expect(orderModel.find).toHaveBeenCalledWith({
        waiterId,
        isDeleted: { $ne: true },
      });

      // El rango aplica a la fecha del PAGO
      expect(paymentModel.find).toHaveBeenCalledWith({
        orderId: { $in: ['order-1'] },
        createdAt: {
          $gte: new Date(from),
          $lte: new Date(to),
        },
      });

      expect(result).toHaveLength(1);
    });

    it('ordena pagos por createdAt DESC', async () => {
      const waiterId = 'waiter-123';

      const orders = [
        {
          _id: 'order-1',
          orderNumber: 'A1B2',
          tableName: 'Mesa 5',
          total: 29.0,
          tipAmount: 2.0,
          serviceCharge: 2.9,
          paymentStatus: 'paid',
          createdAt: new Date('2026-07-15'),
        },
        {
          _id: 'order-2',
          orderNumber: 'C3D4',
          tableName: 'Mesa 6',
          total: 50.0,
          tipAmount: 5.0,
          serviceCharge: 5.0,
          paymentStatus: 'paid',
          createdAt: new Date('2026-07-14'),
        },
      ];

      const payments = [
        {
          _id: 'payment-1',
          orderId: 'order-1',
          amount: 29.0,
          method: 'CASH_USD',
          transactionId: null,
          bcvRate: null,
          expectedAmountBS: null,
          notes: null,
          userId: 'user-456',
          createdAt: new Date('2026-07-15T14:30:00Z'),
        },
        {
          _id: 'payment-2',
          orderId: 'order-2',
          amount: 50.0,
          method: 'CASH_USD',
          transactionId: null,
          bcvRate: null,
          expectedAmountBS: null,
          notes: null,
          userId: 'user-456',
          createdAt: new Date('2026-07-14T12:00:00Z'),
        },
      ];

      orderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(orders),
          }),
        }),
      });

      paymentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(payments),
          }),
        }),
      });

      const result = await service.findByWaiter(waiterId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('payment-1');
      expect(result[1].id).toBe('payment-2');
    });

    it('retorna array vacío si no hay órdenes/pagos', async () => {
      const waiterId = 'waiter-123';

      orderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      paymentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.findByWaiter(waiterId);

      expect(result).toEqual([]);
    });
  });

  describe('create — idempotencia por clientRequestId', () => {
    it('con una llave que ya existe devuelve el pago previo sin crear otro', async () => {
      // El atajo corre ANTES de todo: solo consulta paymentModel.findOne.
      paymentModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'pago-existente',
          toObject: () => ({ _id: 'pago-existente', amount: 10 }),
        }),
      });

      const result = await service.create({
        orderId: 'o1',
        amount: 10,
        method: 'CASH_USD',
        userId: 'u1',
        clientRequestId: 'key-1',
      });

      expect(result).toMatchObject({ id: 'pago-existente', duplicate: true });
      expect(paymentModel.findOne).toHaveBeenCalledWith({
        clientRequestId: 'key-1',
      });
      expect(paymentModel.create).not.toHaveBeenCalled();
    });

    it('sin llave no intenta el atajo de idempotencia', async () => {
      // Sin clientRequestId no debe consultar por esa llave; se deja fallar
      // aguas abajo (falta method resuelto, etc.) sin tocar el atajo.
      paymentModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.create({
          orderId: 'o1',
          amount: 10,
          userId: 'u1',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(paymentModel.findOne).not.toHaveBeenCalledWith(
        expect.objectContaining({ clientRequestId: expect.anything() }),
      );
    });
  });

  describe('create — pedido inexistente', () => {
    it('rechaza con 404 un cobro cuya orden no existe y no crea nada', async () => {
      paymentModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      orderModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(
        service.create({
          orderId: 'no-existe-123',
          amount: 8,
          method: 'CASH_USD',
          userId: 'u1',
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(paymentModel.create).not.toHaveBeenCalled();
    });
  });
});
