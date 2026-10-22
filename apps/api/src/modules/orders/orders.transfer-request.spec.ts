import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
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
import { OrderStatusEnum } from '@odin6/types';
import { configsDePrueba } from './configs-de-prueba';

describe('OrdersService - Transfer Request', () => {
  let service: OrdersService;
  let mockOrderModel: Record<string, jest.Mock>;
  let mockTableModel: Record<string, jest.Mock>;
  let mockUserModel: Record<string, jest.Mock>;
  let mockInvoiceModel: Record<string, jest.Mock>;
  let mockPaymentModel: Record<string, jest.Mock>;
  let mockPosGateway: Record<string, jest.Mock>;

  const waiter1 = { id: 'waiter-1', role: 'waiter', name: 'Juan Mesonero' };
  const waiter2 = { id: 'waiter-2', role: 'waiter', name: 'Pedro Camarero' };

  const mockOrder = {
    _id: 'order-789',
    waiterId: 'waiter-1',
    userId: 'user-001',
    customerId: 'customer-001',
    total: 100,
    paymentStatus: 'pending',
    status: OrderStatusEnum.PENDING,
    tableId: 'table-001',
    subtotal: 100,
    tax: 16,
    serviceCharge: 10,
    items: [],
    transferRequest: undefined,
    waiterShares: [],
    save: jest.fn(),
    markModified: jest.fn(),
    toObject: jest.fn(),
  };

  beforeEach(async () => {
    mockOrderModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
    };

    mockTableModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    // El nombre del mesonero lo resuelve el SERVIDOR contra userModel, no el
    // JWT (que no lo trae). Sin este mock, createTransferRequest y
    // acceptTransferRequest revientan al ir a buscarlo.
    const nombrePorId: Record<string, string> = {
      'waiter-1': 'Juan Mesonero',
      'waiter-2': 'Pedro Camarero',
      'waiter-3': 'Otro Mesonero',
    };
    mockUserModel = {
      findOne: jest.fn((filtro: { _id?: string }) => ({
        select: () => ({
          lean: () => ({
            exec: () =>
              Promise.resolve(
                filtro?._id && nombrePorId[filtro._id]
                  ? { name: nombrePorId[filtro._id] }
                  : null,
              ),
          }),
        }),
      })),
    };

    mockInvoiceModel = {
      findOne: jest.fn(),
    };

    mockPaymentModel = {
      findOne: jest.fn(),
    };

    mockPosGateway = {
      notifyOrderUpdated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        configsDePrueba(),
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
        {
          provide: getModelToken(Order.name),
          useValue: mockOrderModel,
        },
        {
          provide: getModelToken(Table.name),
          useValue: mockTableModel,
        },
        {
          provide: getModelToken('User'),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken('Invoice'),
          useValue: mockInvoiceModel,
        },
        {
          provide: getModelToken('Payment'),
          useValue: mockPaymentModel,
        },
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
        {
          provide: PosGateway,
          useValue: mockPosGateway,
        },
        {
          provide: AuthService,
          useValue: {},
        },
        {
          provide: PaymentsService,
          useValue: {},
        },
        {
          provide: OcrService,
          useValue: {},
        },
        {
          provide: OrderItemEventsService,
          useValue: { record: jest.fn(), recordMany: jest.fn() },
        },
        {
          provide: PagoMovilService,
          useValue: {},
        },
        {
          provide: ConsumptionService,
          useValue: {},
        },
        {
          provide: AccountsReceivableService,
          useValue: {},
        },
        { provide: MovementsService, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('createTransferRequest', () => {
    it('debe rechazar si intenta cederse a sí mismo (400)', async () => {
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.createTransferRequest(
          'order-789',
          {
            toWaiterId: 'waiter-1', // same as fromWaiterId
            fromPct: 50,
            toPct: 50,
          },
          waiter1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si intenta cederse a sí mismo (400)', async () => {
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.createTransferRequest(
          'order-789',
          {
            toWaiterId: 'waiter-1', // same as fromWaiterId
            fromPct: 50,
            toPct: 50,
          },
          waiter1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si pcts no suman 100 (400)', async () => {
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.createTransferRequest(
          'order-789',
          {
            toWaiterId: 'waiter-2',
            fromPct: 50,
            toPct: 60, // sum = 110
          },
          waiter1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si orden ya pagada (400)', async () => {
      const paidOrder = { ...mockOrder, paymentStatus: 'paid' };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(paidOrder),
      });

      await expect(
        service.createTransferRequest(
          'order-789',
          {
            toWaiterId: 'waiter-2',
            fromPct: 50,
            toPct: 50,
          },
          waiter1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si orden ya transferida (waiterShares previos, 400)', async () => {
      const transferredOrder = {
        ...mockOrder,
        waiterShares: [
          { waiterId: 'waiter-1', pct: 50 },
          { waiterId: 'waiter-2', pct: 50 },
        ],
      };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(transferredOrder),
      });

      await expect(
        service.createTransferRequest(
          'order-789',
          {
            toWaiterId: 'waiter-3',
            fromPct: 50,
            toPct: 50,
          },
          waiter1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe crear transferRequest REQUESTED exitosamente', async () => {
      const orderCopy = { ...mockOrder };
      orderCopy.save = jest.fn().mockResolvedValue(undefined);
      orderCopy.toObject = jest.fn().mockReturnValue({
        ...orderCopy,
        _id: 'order-789',
      });

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderCopy),
      });

      const result = await service.createTransferRequest(
        'order-789',
        {
          toWaiterId: 'waiter-2',
          fromPct: 60,
          toPct: 40,
        },
        waiter1,
      );

      expect(orderCopy.transferRequest).toBeDefined();
      expect(orderCopy.transferRequest.status).toBe('REQUESTED');
      expect(orderCopy.transferRequest.fromWaiterId).toBe('waiter-1');
      expect(orderCopy.transferRequest.toWaiterId).toBe('waiter-2');
      expect(orderCopy.transferRequest.fromPct).toBe(60);
      expect(orderCopy.transferRequest.toPct).toBe(40);
      // Los nombres salen del userModel, NO del JWT. Antes se escribia el
      // literal 'Usuario' (45 de 45 traspasos del historico lo tenian) porque
      // el token no trae `name`.
      expect(orderCopy.transferRequest.fromWaiterName).toBe('Juan Mesonero');
      expect(orderCopy.transferRequest.toWaiterName).toBe('Pedro Camarero');
      expect(orderCopy.save).toHaveBeenCalled();
      expect(mockPosGateway.notifyOrderUpdated).toHaveBeenCalled();
      expect(result.id).toBe('order-789');
    });
  });

  describe('acceptTransferRequest', () => {
    it('debe rechazar si no hay transferRequest pendiente (400)', async () => {
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.acceptTransferRequest('order-789', waiter2),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si no es toWaiterId (403)', async () => {
      const orderWithTransfer = {
        ...mockOrder,
        transferRequest: {
          status: 'REQUESTED',
          fromWaiterId: 'waiter-1',
          toWaiterId: 'waiter-2',
          fromPct: 60,
          toPct: 40,
        },
      };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithTransfer),
      });

      const waiter3 = { id: 'waiter-3', role: 'waiter', name: 'Otro' };
      await expect(
        service.acceptTransferRequest('order-789', waiter3),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe crear waiterShares con comisiones correctas', async () => {
      const orderWithTransfer = {
        ...mockOrder,
        transferRequest: {
          status: 'REQUESTED',
          fromWaiterId: 'waiter-1',
          fromWaiterName: 'Juan',
          toWaiterId: 'waiter-2',
          fromPct: 60,
          toPct: 40,
        },
      };
      orderWithTransfer.save = jest.fn().mockResolvedValue(undefined);
      orderWithTransfer.toObject = jest.fn().mockReturnValue({
        ...orderWithTransfer,
        _id: 'order-789',
      });

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithTransfer),
      });

      const result = await service.acceptTransferRequest('order-789', waiter2);

      // Verificar que se cambió status a ACCEPTED
      expect(orderWithTransfer.transferRequest.status).toBe('ACCEPTED');
      expect(orderWithTransfer.transferRequest.resolvedAt).toBeDefined();

      // Verificar que se crearon waiterShares
      expect(orderWithTransfer.waiterShares).toHaveLength(2);
      expect(orderWithTransfer.waiterShares[0]).toMatchObject({
        waiterId: 'waiter-1',
        waiterName: 'Juan Mesonero',
        pct: 60,
        comisionPagada: false,
      });
      expect(orderWithTransfer.waiterShares[1]).toMatchObject({
        waiterId: 'waiter-2',
        waiterName: 'Pedro Camarero',
        pct: 40,
        comisionPagada: false,
      });

      // Verificar que cambió waiterId
      expect(orderWithTransfer.waiterId).toBe('waiter-2');
      // ...Y QUE EL NOMBRE VIAJA CON EL. Sin esta linea la orden quedaba
      // apuntando al que la recibe y diciendo el nombre del que la inicio:
      // 14 casos en un solo fin de semana, uno de $222,37 mal acreditado.
      expect(orderWithTransfer.waiterName).toBe('Pedro Camarero');

      expect(orderWithTransfer.save).toHaveBeenCalled();
      expect(mockPosGateway.notifyOrderUpdated).toHaveBeenCalled();
      expect(result.id).toBe('order-789');
    });
  });

  describe('rejectTransferRequest', () => {
    it('debe rechazar si no hay transferRequest pendiente (400)', async () => {
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.rejectTransferRequest(
          'order-789',
          { reason: 'No quiero' },
          waiter2,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si no es toWaiterId (403)', async () => {
      const orderWithTransfer = {
        ...mockOrder,
        transferRequest: {
          status: 'REQUESTED',
          fromWaiterId: 'waiter-1',
          toWaiterId: 'waiter-2',
        },
      };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithTransfer),
      });

      const waiter3 = { id: 'waiter-3', role: 'waiter', name: 'Otro' };
      await expect(
        service.rejectTransferRequest(
          'order-789',
          { reason: 'No quiero' },
          waiter3,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe marcar como REJECTED sin crear waiterShares', async () => {
      const orderWithTransfer = {
        ...mockOrder,
        transferRequest: {
          status: 'REQUESTED',
          fromWaiterId: 'waiter-1',
          toWaiterId: 'waiter-2',
        },
      };
      orderWithTransfer.save = jest.fn().mockResolvedValue(undefined);
      orderWithTransfer.toObject = jest.fn().mockReturnValue({
        ...orderWithTransfer,
        _id: 'order-789',
      });

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithTransfer),
      });

      const result = await service.rejectTransferRequest(
        'order-789',
        { reason: 'Prefiero no' },
        waiter2,
      );

      expect(orderWithTransfer.transferRequest.status).toBe('REJECTED');
      expect(orderWithTransfer.transferRequest.reason).toBe('Prefiero no');
      expect(orderWithTransfer.waiterShares).toHaveLength(0);
      expect(result.id).toBe('order-789');
    });
  });

  describe('cancelTransferRequest', () => {
    it('debe rechazar si no hay transferRequest pendiente (400)', async () => {
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.cancelTransferRequest(
          'order-789',
          { reason: 'Cambié de idea' },
          waiter1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si no es fromWaiterId (403)', async () => {
      const orderWithTransfer = {
        ...mockOrder,
        transferRequest: {
          status: 'REQUESTED',
          fromWaiterId: 'waiter-1',
          toWaiterId: 'waiter-2',
        },
      };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithTransfer),
      });

      await expect(
        service.cancelTransferRequest(
          'order-789',
          { reason: 'Cambié de idea' },
          waiter2,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe marcar como CANCELLED', async () => {
      const orderWithTransfer = {
        ...mockOrder,
        transferRequest: {
          status: 'REQUESTED',
          fromWaiterId: 'waiter-1',
          toWaiterId: 'waiter-2',
        },
      };
      orderWithTransfer.save = jest.fn().mockResolvedValue(undefined);
      orderWithTransfer.toObject = jest.fn().mockReturnValue({
        ...orderWithTransfer,
        _id: 'order-789',
      });

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithTransfer),
      });

      const result = await service.cancelTransferRequest(
        'order-789',
        { reason: 'Cambié de idea' },
        waiter1,
      );

      expect(orderWithTransfer.transferRequest.status).toBe('CANCELLED');
      expect(orderWithTransfer.transferRequest.reason).toBe('Cambié de idea');
      expect(result.id).toBe('order-789');
    });
  });

  describe('findAll filter transferPendingFor', () => {
    it('debe filtrar órdenes con transferRequest.status=REQUESTED para un waiter', async () => {
      mockOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        // findAll pagina siempre: la cadena real lleva skip y limit.
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: 'order-1',
            transferRequest: {
              status: 'REQUESTED',
              toWaiterId: 'waiter-2',
            },
          },
        ]),
      });

      const result = await service.findAll({ transferPendingFor: 'waiter-2' });

      expect(mockOrderModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: [
            { 'transferRequest.status': 'REQUESTED' },
            { 'transferRequest.toWaiterId': 'waiter-2' },
          ],
        }),
      );
      expect(result).toHaveLength(1);
    });
  });
});
