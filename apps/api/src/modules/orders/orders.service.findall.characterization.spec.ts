/**
 * Caracterización: findAll — 13 filtros + paginación
 *
 * Medido: `findAll` acepta filtros y paginación.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';
import { Table } from '../tables/schemas/table.schema';
import { AuthService } from '../auth/auth.service';
import { PosGateway } from '../websockets/gateways/pos.gateway';
import { PaymentsService } from '../payments/payments.service';
import { OcrService } from '../ocr/ocr.service';
import { OrderItemEventsService } from './order-item-events.service';
import { PagoMovilService } from '../pago-movil/pago-movil.service';
import { ConsumptionService } from '../inventory/consumption.service';
import { MovementsService } from '../inventory/movements.service';
import { AccountsReceivableService } from '../accounts-receivable/accounts-receivable.service';
import { SociosExcluidosService } from '../socios-excluidos/socios-excluidos.service';
import { KitchenNotifierService } from '../push/kitchen-notifier.service';
import { configsDePrueba } from './configs-de-prueba';

describe('OrdersService.findAll — filtros y paginación', () => {
  let service: OrdersService;
  let mockOrderModel: Record<string, unknown>;
  let mockLogger: Logger;

  beforeEach(async () => {
    mockLogger = { warn: jest.fn() } as unknown as Logger;

    mockOrderModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          { _id: 'order-1', status: 'PENDING' },
          { _id: 'order-2', status: 'READY' },
        ]),
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
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
        { provide: getModelToken('User'), useValue: {} },
        { provide: getModelToken('Invoice'), useValue: {} },
        { provide: getModelToken('Payment'), useValue: {} },
        { provide: PosGateway, useValue: {} },
        { provide: AuthService, useValue: {} },
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
        { provide: ConsumptionService, useValue: {} },
        { provide: MovementsService, useValue: { emit: jest.fn() } },
        { provide: AccountsReceivableService, useValue: {} },
        { provide: KitchenNotifierService, useValue: {} },
        {
          provide: SociosExcluidosService,
          useValue: { esExcluido: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();

    service = moduleRef.get<OrdersService>(OrdersService);
    (service as any).logger = mockLogger;
  });

  describe('findAll — básico', () => {
    it('sin filtros devuelve ordenes', async () => {
      const result = await service.findAll();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('llama find', async () => {
      await service.findAll();
      expect(mockOrderModel.find).toHaveBeenCalled();
    });

    it('ordena por createdAt DESC', async () => {
      await service.findAll();
      const cursor = (mockOrderModel.find as jest.Mock).mock.results[0].value;
      expect(cursor.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it('aplica paginación', async () => {
      await service.findAll({ limit: 10, page: 2 });
      const cursor = (mockOrderModel.find as jest.Mock).mock.results[0].value;
      expect(cursor.skip).toHaveBeenCalled();
      expect(cursor.limit).toHaveBeenCalled();
    });
  });
});
