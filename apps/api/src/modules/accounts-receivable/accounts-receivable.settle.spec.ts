import { OPERACION_DEFAULT } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { SociosExcluidosService } from '../socios-excluidos/socios-excluidos.service';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AccountReceivable } from './schemas/account-receivable.schema';
import { Order } from '../orders/schemas/order.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { CustomerNotifierService } from '../sms/customer-notifier.service';
import { CustomerDebtService } from '../sms/customer-debt.service';

/**
 * Al saldar una cuenta por cobrar hay que marcar sus ordenes como pagadas:
 * la comision del mesonero solo es elegible cuando order.paymentStatus === 'paid'
 * (ver ComisionesService y el filtro comisionPendiente de OrdersService).
 * En cuentas consolidadas orderId es null y las ordenes viven en mergedOrderIds.
 */
describe('AccountsReceivableService - propagacion al saldar', () => {
  let service: AccountsReceivableService;
  let mockAccountModel: Record<string, jest.Mock>;
  let mockOrderModel: Record<string, jest.Mock>;
  let mockCustomerModel: Record<string, jest.Mock>;
  let mockSms: Record<string, jest.Mock>;

  const leanExec = <T>(value: T) => ({
    lean: () => ({ exec: () => Promise.resolve(value) }),
  });

  const account = (overrides: Record<string, unknown> = {}) => ({
    _id: 'acc-1',
    customerId: 'cust-1',
    customerName: 'Eliecer',
    orderId: 'order-1',
    amount: 100,
    paidAmount: 100,
    status: 'paid',
    ...overrides,
  });

  beforeEach(async () => {
    mockAccountModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      deleteOne: jest.fn(),
      create: jest.fn(),
    };
    mockOrderModel = {
      find: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };
    mockCustomerModel = {
      find: jest.fn(),
      // El aviso de credito por SMS busca el telefono del cliente
      findOne: jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
      }),
    };
    mockSms = {
      notify: jest.fn().mockResolvedValue({ channel: 'sms', sent: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigsService,
          useValue: { obtener: async () => OPERACION_DEFAULT },
        },
        AccountsReceivableService,
        {
          provide: getModelToken(AccountReceivable.name),
          useValue: mockAccountModel,
        },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(Customer.name), useValue: mockCustomerModel },
        {
          provide: getConnectionToken(),
          useValue: {
            collection: () => ({
              findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 1 }),
            }),
          },
        },
        { provide: CustomerNotifierService, useValue: mockSms },
        {
          provide: CustomerDebtService,
          useValue: {
            forCustomer: jest
              .fn()
              .mockResolvedValue({ count: 0, total: 0, orphanCount: 0 }),
          },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
        // El resumen de la cartera aparta el consumo de los socios: aqui no
        // hay ninguno, para que estos casos midan solo lo suyo.
        {
          provide: SociosExcluidosService,
          useValue: {
            resolver: () =>
              Promise.resolve({
                habilitado: false,
                acciones: [],
                motivo: '',
                customerIds: [],
                nombres: {},
              }),
            esExcluido: () => Promise.resolve(false),
          },
        },
      ],
    }).compile();

    service = module.get<AccountsReceivableService>(AccountsReceivableService);
  });

  it('marca como pagada la orden de una cuenta individual saldada', async () => {
    mockAccountModel.findOneAndUpdate.mockReturnValue(leanExec(account()));

    await service.update('acc-1', { status: 'paid', paidAmount: 100 });

    expect(mockOrderModel.updateMany).toHaveBeenCalledTimes(1);
    const [filter, update] = mockOrderModel.updateMany.mock.calls[0];
    expect(filter._id.$in).toEqual(['order-1']);
    expect(update.$set.paymentStatus).toBe('paid');
  });

  it('marca TODAS las ordenes de una cuenta consolidada saldada (orderId null)', async () => {
    mockAccountModel.findOneAndUpdate.mockReturnValue(
      leanExec(
        account({
          orderId: null,
          isConsolidated: true,
          mergedOrderIds: ['order-1', 'order-2', 'order-3'],
        }),
      ),
    );

    await service.update('acc-1', { status: 'paid', paidAmount: 100 });

    expect(mockOrderModel.updateMany).toHaveBeenCalledTimes(1);
    const [filter] = mockOrderModel.updateMany.mock.calls[0];
    expect(filter._id.$in).toEqual(['order-1', 'order-2', 'order-3']);
  });

  it('NO marca ordenes si la cuenta queda con abono parcial', async () => {
    mockAccountModel.findOneAndUpdate.mockReturnValue(
      leanExec(account({ status: 'partially_paid', paidAmount: 40 })),
    );

    await service.update('acc-1', { status: 'partially_paid', paidAmount: 40 });

    expect(mockOrderModel.updateMany).not.toHaveBeenCalled();
  });

  it('no toca ordenes ya pagadas (filtro idempotente)', async () => {
    mockAccountModel.findOneAndUpdate.mockReturnValue(leanExec(account()));

    await service.update('acc-1', { status: 'paid', paidAmount: 100 });

    const [filter] = mockOrderModel.updateMany.mock.calls[0];
    expect(filter.paymentStatus).toEqual({ $ne: 'paid' });
  });
});
