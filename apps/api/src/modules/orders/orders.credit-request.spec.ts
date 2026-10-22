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
import { OrderStatusEnum, TableStatusEnum } from '@odin6/types';
import { configsDePrueba } from './configs-de-prueba';

describe('OrdersService - Credit Request', () => {
  let service: OrdersService;
  let mockOrderModel: any;
  let mockTableModel: any;
  let mockUserModel: any;
  let mockInvoiceModel: any;
  let mockPaymentModel: any;
  let mockPosGateway: any;
  let mockAuthService: any;
  let mockAccountsReceivableService: any;

  const mockUser = {
    id: 'waiter-123',
    role: 'waiter',
    name: 'Juan Mesonero',
  };

  const mockAdmin = {
    id: 'admin-456',
    role: 'admin',
    name: 'Carlos Admin',
  };

  const mockOrder = {
    _id: 'order-789',
    waiterId: 'waiter-123',
    userId: 'user-001',
    customerId: 'customer-001',
    customerName: 'María Cliente',
    total: 100,
    paymentStatus: 'pending',
    status: OrderStatusEnum.PENDING,
    tableId: 'table-001',
    creditRequest: undefined,
    items: [],
    subtotal: 100,
    tax: 16,
    save: jest.fn(),
    markModified: jest.fn(),
    toObject: jest.fn(),
    exec: jest.fn(),
    lean: jest.fn(),
  };

  const mockTable = {
    _id: 'table-001',
    name: 'Mesa 1',
    orderId: 'order-789',
    status: 'OCCUPIED',
    isAvailable: false,
  };

  beforeEach(async () => {
    // Mock de modelos
    mockOrderModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      find: jest.fn(),
      updateMany: jest.fn(),
    };

    mockTableModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      find: jest.fn(),
    };

    mockUserModel = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockInvoiceModel = {
      findOne: jest.fn(),
    };

    mockPaymentModel = {
      findOne: jest.fn(),
    };

    // Mock de servicios
    mockPosGateway = {
      notifyOrderUpdated: jest.fn(),
      notifyTableUpdated: jest.fn(),
      notifyOrderCreated: jest.fn(),
    };

    mockAuthService = {
      verifyAdminPin: jest.fn(),
    };

    mockAccountsReceivableService = {
      create: jest.fn(),
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
          useValue: mockAuthService,
        },
        {
          provide: PaymentsService,
          useValue: {
            processPayment: jest.fn(),
          },
        },
        {
          provide: OcrService,
          useValue: {
            processOcr: jest.fn(),
          },
        },
        {
          provide: OrderItemEventsService,
          useValue: {
            record: jest.fn(),
            recordMany: jest.fn(),
          },
        },
        {
          provide: PagoMovilService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: ConsumptionService,
          useValue: {
            recordConsumption: jest.fn(),
          },
        },
        {
          provide: AccountsReceivableService,
          useValue: mockAccountsReceivableService,
        },
        { provide: MovementsService, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('requestCredit', () => {
    it('debe rechazar solicitud de no-mesonero (403)', async () => {
      const otherUser = { id: 'other-user', role: 'waiter', name: 'Otro' };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockOrder),
      });

      await expect(
        service.requestCredit('order-789', { note: 'test' }, otherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe rechazar si no hay cliente real (400)', async () => {
      const orderNoCustomer = { ...mockOrder, customerId: null };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderNoCustomer),
      });

      await expect(
        service.requestCredit('order-789', { note: 'test' }, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe escribir creditRequest REQUESTED exitosamente', async () => {
      const orderCopy: any = {
        ...mockOrder,
        creditRequest: undefined,
        save: jest.fn().mockImplementation(function () {
          // Actualizar toObject para que refleje los cambios después de save
          this.toObject = jest.fn().mockReturnValue({
            ...this,
            _id: 'order-789',
          });
          return Promise.resolve(undefined);
        }),
      };

      orderCopy.toObject = jest.fn().mockReturnValue({
        ...orderCopy,
        _id: 'order-789',
      });

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderCopy),
      });

      const result = await service.requestCredit(
        'order-789',
        { note: 'test' },
        mockUser,
      );

      expect(orderCopy.creditRequest).toBeDefined();
      expect(orderCopy.creditRequest.status).toBe('REQUESTED');
      expect(orderCopy.creditRequest.requestedBy).toBe('waiter-123');
      expect(orderCopy.save).toHaveBeenCalled();
      expect(mockPosGateway.notifyOrderUpdated).toHaveBeenCalled();
      // Verificar que el resultado contiene creditRequest
      expect(result.id).toBe('order-789');
    });
  });

  describe('approveCreditRequest', () => {
    it('debe rechazar si la orden ya está pagada (PAID)', async () => {
      const orderWithRequestPaid = {
        ...mockOrder,
        total: 100,
        paidAmount: 100,
        paymentStatus: 'pending',
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
        },
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequestPaid),
      });

      await expect(
        service.approveCreditRequest('order-789', { pin: '1234' }, mockAdmin),
      ).rejects.toThrow(BadRequestException);

      // Verificar que NO se llamó a authService ni accountsReceivableService
      expect(mockAuthService.verifyAdminPin).not.toHaveBeenCalled();
      expect(mockAccountsReceivableService.create).not.toHaveBeenCalled();
    });

    it('debe rechazar si la orden está pagada pero sin paidAmount (paymentStatus=PAID legacy)', async () => {
      const orderWithRequestPaidLegacy = {
        ...mockOrder,
        total: 100,
        paidAmount: undefined,
        paymentStatus: 'PAID',
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
        },
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequestPaidLegacy),
      });

      await expect(
        service.approveCreditRequest('order-789', { pin: '1234' }, mockAdmin),
      ).rejects.toThrow(BadRequestException);

      expect(mockAccountsReceivableService.create).not.toHaveBeenCalled();
    });

    it('debe rechazar si la orden está parcialmente pagada (PARTIALLY_PAID)', async () => {
      const orderWithRequestPartialPaid = {
        ...mockOrder,
        total: 100,
        paidAmount: 60,
        paymentStatus: 'pending',
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
        },
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequestPartialPaid),
      });

      await expect(
        service.approveCreditRequest('order-789', { pin: '1234' }, mockAdmin),
      ).rejects.toThrow(BadRequestException);

      expect(mockAccountsReceivableService.create).not.toHaveBeenCalled();
    });

    it('debe rechazar si la orden tiene total <= 0', async () => {
      const orderWithRequestZeroTotal = {
        ...mockOrder,
        total: 0,
        paidAmount: 0,
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
        },
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequestZeroTotal),
      });

      await expect(
        service.approveCreditRequest('order-789', { pin: '1234' }, mockAdmin),
      ).rejects.toThrow(BadRequestException);

      expect(mockAccountsReceivableService.create).not.toHaveBeenCalled();
    });

    it('debe permitir aprobar si la orden sin cobrar (UNPAID)', async () => {
      // Datos primero y metodos despues: un literal que se devuelve a si
      // mismo en toObject/save hacia caer a tsc 5.8 ("Debug Failure").
      const datosSinCobrar = {
        ...mockOrder,
        total: 100,
        paidAmount: 0,
        paymentStatus: 'pending',
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
          requestedByName: 'Juan',
        },
      };
      const orderWithRequestUnpaid = {
        ...datosSinCobrar,
        toObject: jest
          .fn()
          .mockReturnValue({ ...datosSinCobrar, _id: 'order-789' }),
        save: jest.fn().mockResolvedValue(datosSinCobrar),
        markModified: jest.fn(),
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequestUnpaid),
      });

      mockAuthService.verifyAdminPin.mockResolvedValue({
        valid: true,
        adminName: 'Carlos Admin',
        adminId: 'admin-456',
      });

      mockAccountsReceivableService.create.mockResolvedValue({
        id: 'ar-001',
      });

      mockTableModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTable),
      });

      mockTableModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTable),
      });

      const result = await service.approveCreditRequest(
        'order-789',
        { pin: '1234' },
        mockAdmin,
      );

      // Verificar que se creó AR normal
      expect(mockAccountsReceivableService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          paidAmount: 0,
        }),
      );

      expect(result.creditRequest.status).toBe('APPROVED');
    });

    it('debe rechazar PIN inválido (401)', async () => {
      const orderWithRequest = {
        ...mockOrder,
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
        },
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequest),
      });

      mockAuthService.verifyAdminPin.mockResolvedValue({
        valid: false,
        adminName: null,
        adminId: null,
      });

      await expect(
        service.approveCreditRequest('order-789', { pin: 'wrong' }, mockAdmin),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('no debe crear AR si PIN es inválido', async () => {
      const orderWithRequest = {
        ...mockOrder,
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
        },
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequest),
      });

      mockAuthService.verifyAdminPin.mockResolvedValue({
        valid: false,
      });

      try {
        await service.approveCreditRequest(
          'order-789',
          { pin: 'wrong' },
          mockAdmin,
        );
      } catch {
        // Expected
      }

      expect(mockAccountsReceivableService.create).not.toHaveBeenCalled();
    });

    it('debe crear AR, cambiar status a CREDIT/PENDING, y liberar mesa', async () => {
      const orderWithRequest = {
        ...mockOrder,
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
          requestedByName: 'Juan',
        },
      };
      orderWithRequest.toObject = jest
        .fn()
        .mockReturnValue({ ...orderWithRequest, _id: 'order-789' });
      orderWithRequest.save = jest.fn().mockResolvedValue(orderWithRequest);

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequest),
      });

      mockAuthService.verifyAdminPin.mockResolvedValue({
        valid: true,
        adminName: 'Carlos Admin',
        adminId: 'admin-456',
      });

      mockAccountsReceivableService.create.mockResolvedValue({
        id: 'ar-001',
      });

      mockTableModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTable),
      });

      mockTableModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTable),
      });

      const result = await service.approveCreditRequest(
        'order-789',
        { pin: '1234' },
        mockAdmin,
      );

      // Verificar que se creó AR con shape correcto
      expect(mockAccountsReceivableService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'customer-001',
          customerName: 'María Cliente',
          orderId: 'order-789',
          invoiceNumber: expect.stringContaining('INV-'),
          amount: 100,
          paidAmount: 0,
          dueDate: expect.any(Date),
          status: 'pending',
          description: expect.stringContaining('Orden #'),
        }),
      );

      // Verificar que la orden cambió a CREDIT
      expect(orderWithRequest.status).toBe(OrderStatusEnum.CREDIT);
      expect(orderWithRequest.paymentStatus).toBe('pending');

      // Verificar que se liberó la mesa
      expect(mockTableModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'table-001' },
        expect.objectContaining({
          status: 'ISAVAILABLE',
          isAvailable: true,
          orderId: null,
        }),
      );

      // Verificar emisión de eventos
      expect(mockPosGateway.notifyOrderUpdated).toHaveBeenCalled();
      expect(mockPosGateway.notifyTableUpdated).toHaveBeenCalled();

      expect(result.creditRequest.status).toBe('APPROVED');
    });

    it('debe cancelar AR si fallo al guardar orden (compensación)', async () => {
      const orderWithRequest = {
        ...mockOrder,
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
          requestedByName: 'Juan',
        },
      };

      // Simular que el save de la orden falla
      orderWithRequest.save = jest
        .fn()
        .mockRejectedValue(new Error('MongoDB connection failed'));

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequest),
      });

      mockAuthService.verifyAdminPin.mockResolvedValue({
        valid: true,
        adminName: 'Carlos Admin',
        adminId: 'admin-456',
      });

      const arId = 'ar-001';
      mockAccountsReceivableService.create.mockResolvedValue({
        id: arId,
      });

      // Mock softDelete de AR
      mockAccountsReceivableService.softDelete = jest.fn().mockResolvedValue({
        id: arId,
        status: 'cancelled',
      });

      await expect(
        service.approveCreditRequest('order-789', { pin: '1234' }, mockAdmin),
      ).rejects.toThrow('MongoDB connection failed');

      // Verificar que se intentó compensar (marcar AR como cancelled)
      expect(mockAccountsReceivableService.softDelete).toHaveBeenCalledWith(
        arId,
      );
    });
  });

  describe('rejectCreditRequest', () => {
    it('debe rechazar si mesonero intenta rechazar (403)', async () => {
      const waiterUser = {
        id: 'waiter-123',
        role: 'waiter',
        name: 'Juan Mesonero',
      };

      const orderWithRequest = {
        ...mockOrder,
        creditRequest: {
          status: 'REQUESTED',
        },
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequest),
      });

      await expect(
        service.rejectCreditRequest(
          'order-789',
          { reason: 'Cliente sin saldo' },
          waiterUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe rechazar si reason vacío o no presente (400)', async () => {
      const orderWithRequest = {
        ...mockOrder,
        creditRequest: {
          status: 'REQUESTED',
        },
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequest),
      });

      // El DTO debe validar reason no vacío
      // Aquí solo verificamos que si llega vacío, el service lo rechaza
      await expect(
        service.rejectCreditRequest('order-789', { reason: '' }, mockAdmin),
      ).rejects.toThrow(); // Puede ser error de validation o BadRequest
    });

    it('debe rechazar si creditRequest no está en REQUESTED', async () => {
      const orderApproved = {
        ...mockOrder,
        creditRequest: {
          status: 'APPROVED',
        },
      };

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderApproved),
      });

      await expect(
        service.rejectCreditRequest(
          'order-789',
          { reason: 'Cliente sin saldo' },
          mockAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe actualizar status a REJECTED con reason', async () => {
      const orderWithRequest = {
        ...mockOrder,
        creditRequest: {
          status: 'REQUESTED',
          requestedBy: 'waiter-123',
        },
      };
      orderWithRequest.toObject = jest
        .fn()
        .mockReturnValue({ ...orderWithRequest, _id: 'order-789' });
      orderWithRequest.save = jest.fn().mockResolvedValue(orderWithRequest);

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(orderWithRequest),
      });

      const result = await service.rejectCreditRequest(
        'order-789',
        { reason: 'Cliente sin saldo de crédito' },
        mockAdmin,
      );

      expect(orderWithRequest.creditRequest.status).toBe('REJECTED');
      expect(orderWithRequest.creditRequest.rejectionReason).toBe(
        'Cliente sin saldo de crédito',
      );
      expect(orderWithRequest.creditRequest.resolvedBy).toBe('admin-456');
      expect(orderWithRequest.save).toHaveBeenCalled();
      expect(mockPosGateway.notifyOrderUpdated).toHaveBeenCalled();
      expect(result.creditRequest.status).toBe('REJECTED');
    });
  });

  describe('findAll filter creditRequested', () => {
    it('debe filtrar por creditRequested=true', async () => {
      mockOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        // findAll pagina siempre: la cadena real lleva skip y limit.
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: 'order-1',
            creditRequest: { status: 'REQUESTED' },
          },
        ]),
      });

      const result = await service.findAll({ creditRequested: true });

      expect(mockOrderModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          'creditRequest.status': 'REQUESTED',
        }),
      );
      expect(result).toHaveLength(1);
    });
  });
});
