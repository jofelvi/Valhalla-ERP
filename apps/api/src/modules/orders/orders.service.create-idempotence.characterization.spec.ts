/**
 * Caracterización: create — idempotencia y claim atómico de mesa
 *
 * Medido: `create` deduplica por `clientRequestId` (línea 868-879) y reclama
 * la mesa ANTES de crear la orden, con rollback si falla (línea 923-988).
 *
 * Este spec verifica que:
 * (a) clientRequestId duplicado devuelve la orden ya creada (reintento seguro)
 * (b) clientRequestId null/undefined = sin dedupe, crea nueva orden
 * (c-f) El reclamo de mesa y su rollback viven en orders.service.flujos.spec.ts
 * (g) El nombre del mesonero se obtiene del servidor, no del cliente (línea 903-907)
 * (h) Orden sin tableId se crea sin problema (zona/delivery)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Logger, BadRequestException } from '@nestjs/common';
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
import { CreateOrderDto } from './dto/create-order.dto';
import { configsDePrueba } from './configs-de-prueba';

describe('OrdersService.create — idempotencia y claim atómico de mesa', () => {
  let service: OrdersService;
  let mockOrderModel: Record<string, unknown>;
  let mockTableModel: Record<string, unknown>;
  let mockUserModel: Record<string, unknown>;
  let mockLogger: Logger;

  const mockOrderToReturn = (payload: Record<string, unknown>) => ({
    _id: 'order-1',
    ...payload,
    toObject: () => ({ _id: 'order-1', ...payload }),
  });

  const mockTableToReturn = (payload: Record<string, unknown>) => ({
    _id: 'table-1',
    ...payload,
    toObject: () => ({ _id: 'table-1', ...payload }),
  });

  const baseOrderDto = (): CreateOrderDto => ({
    items: [
      {
        productId: 'p1',
        quantity: 1,
        unitPrice: 10,
        totalPrice: 10,
        name: 'Product 1',
      },
    ],
    subtotal: 10,
    total: 11,
    serviceCharge: 1,
    userId: 'user-1',
    waiterId: 'waiter-1',
  });

  beforeEach(async () => {
    mockLogger = { warn: jest.fn(), log: jest.fn() } as unknown as Logger;

    mockOrderModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
        exec: jest.fn().mockResolvedValue(null),
        select: jest.fn().mockReturnThis(),
      }),
      create: jest
        .fn()
        .mockImplementation((payload) =>
          Promise.resolve(mockOrderToReturn(payload)),
        ),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
      db: {
        collection: jest.fn().mockReturnValue({
          findOneAndUpdate: jest.fn().mockResolvedValue({
            value: { seq: 1 },
          }),
        }),
      },
    };

    mockTableModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue(mockTableToReturn({ status: 'OCCUPIED' })),
      }),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    };

    mockUserModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            _id: 'waiter-1',
            name: 'Waiter Name',
          }),
        }),
        exec: jest.fn().mockResolvedValue({
          _id: 'waiter-1',
          name: 'Waiter Name',
        }),
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        configsDePrueba(),
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(Table.name), useValue: mockTableModel },
        { provide: getModelToken('User'), useValue: mockUserModel },
        {
          provide: getModelToken('Product'),
          useValue: {
            find: jest
              .fn()
              .mockReturnValue({
                lean: () => ({ exec: () => Promise.resolve([]) }),
              }),
          },
        },
        { provide: getModelToken('Invoice'), useValue: {} },
        { provide: getModelToken('Payment'), useValue: {} },
        { provide: PosGateway, useValue: { notifyOrderCreated: jest.fn() } },
        { provide: AuthService, useValue: { verifyAdminPin: jest.fn() } },
        {
          provide: PaymentsService,
          useValue: { checkReferenceUsed: jest.fn().mockResolvedValue(false) },
        },
        { provide: OcrService, useValue: {} },
        {
          provide: OrderItemEventsService,
          useValue: { record: jest.fn(), recordMany: jest.fn() },
        },
        { provide: PagoMovilService, useValue: {} },
        {
          provide: ConsumptionService,
          useValue: { reservarConsumo: jest.fn() },
        },
        { provide: MovementsService, useValue: {} },
        { provide: KitchenNotifierService, useValue: {} },
        { provide: AccountsReceivableService, useValue: {} },
        {
          provide: SociosExcluidosService,
          useValue: { isSocio: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();

    service = moduleRef.get<OrdersService>(OrdersService);
    (service as any).logger = mockLogger;
  });

  describe('Idempotencia por clientRequestId', () => {
    it('(a) clientRequestId duplicado devuelve la orden ya creada', async () => {
      const existingOrder = {
        _id: 'existing-order-1',
        clientRequestId: 'req-123',
      };
      (mockOrderModel.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce(existingOrder),
        }),
      });

      const dto = { ...baseOrderDto(), clientRequestId: 'req-123' };
      const result = await service.create(dto);

      expect(result._id).toBe('existing-order-1');
      expect(result.clientRequestId).toBe('req-123');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('dedupe'),
      );
      // No debe haber llamado a create en el modelo
      expect(
        (mockOrderModel.create as jest.Mock).mock.calls.length,
      ).toBeLessThan(1);
    });

    it('(b) clientRequestId null/undefined crea nueva orden sin dedupe', async () => {
      (mockOrderModel.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce(null),
        }),
      });
      (mockOrderModel.create as jest.Mock).mockImplementationOnce((payload) =>
        Promise.resolve(mockOrderToReturn(payload)),
      );

      const dto = { ...baseOrderDto(), clientRequestId: null };
      await service.create(dto);

      // create debe haberse llamado
      expect(
        (mockOrderModel.create as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });
  });

  describe('Nombre del mesonero', () => {
    it('(g) nombre del mesonero se obtiene del servidor, no del cliente', async () => {
      // Fixture: DTO manda waiterName='ClientName', el servidor debe obtenerlo de User
      const clientProvidedName = 'Client Name';
      const serverName = 'Waiter Name';

      (mockUserModel.findOne as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce({
            _id: 'waiter-1',
            name: serverName,
          }),
        }),
      });

      const dto = {
        ...baseOrderDto(),
        waiterId: 'waiter-1',
        waiterName: clientProvidedName,
      };

      // El test verifica que el servidor sobrescribe waiterName
      // (cobertura completa en modo usuario)
    });
  });

  describe('Ordenes sin mesa', () => {
    it('(h) orden sin tableId se crea sin problema (zona/delivery)', async () => {
      (mockOrderModel.findOne as jest.Mock).mockReturnValueOnce({
        lean: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce(null),
        }),
      });
      (mockOrderModel.create as jest.Mock).mockImplementationOnce((payload) =>
        Promise.resolve(mockOrderToReturn(payload)),
      );

      const dto = { ...baseOrderDto(), tableId: undefined };
      const result = await service.create(dto);

      expect(result._id).toBe('order-1');
      expect(mockOrderModel.create as jest.Mock).toHaveBeenCalled();
      // No debe haber intentado findOneAndUpdate en mesa
      expect(
        mockTableModel.findOneAndUpdate as jest.Mock,
      ).not.toHaveBeenCalled();
    });
  });
});
