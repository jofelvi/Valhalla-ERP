import { OPERACION_DEFAULT } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test } from '@nestjs/testing';
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
 * Anular una consolidada DEBE liberar a sus hijas.
 *
 * Sin esto quedaban marcadas como fusionadas apuntando a una madre que ya no
 * cobra, y su deuda desaparecia de la pagina, la nomina y los avisos aunque la
 * orden siguiera sin pagar: 12 casos reales, cientos de dolares invisibles.
 */
describe('AccountsReceivableService - softDelete', () => {
  let service: AccountsReceivableService;
  let updateMany: jest.Mock;
  let findOneAndUpdate: jest.Mock;

  const build = async (cuentaAnulada: Record<string, unknown>) => {
    findOneAndUpdate = jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(cuentaAnulada) }),
    });
    updateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigsService,
          useValue: { obtener: async () => OPERACION_DEFAULT },
        },
        AccountsReceivableService,
        {
          provide: getModelToken(AccountReceivable.name),
          useValue: { findOneAndUpdate, updateMany },
        },
        { provide: getModelToken(Order.name), useValue: {} },
        { provide: getModelToken(Customer.name), useValue: {} },
        {
          provide: getConnectionToken(),
          useValue: {
            collection: () => ({
              findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 1 }),
            }),
          },
        },
        { provide: CustomerNotifierService, useValue: { notify: jest.fn() } },
        {
          provide: CustomerDebtService,
          useValue: { forCustomer: jest.fn().mockResolvedValue({ total: 0 }) },
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

    service = moduleRef.get(AccountsReceivableService);
  };

  it('al anular una CONSOLIDADA libera a sus hijas', async () => {
    await build({
      _id: 'cons-1',
      invoiceNumber: 'CONS-X',
      isConsolidated: true,
      mergedAccountIds: ['hija-1', 'hija-2'],
      status: 'cancelled',
    });

    await service.softDelete('cons-1');

    expect(updateMany).toHaveBeenCalledTimes(1);
    const [filtro, cambios] = updateMany.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(cambios).toEqual({ isMerged: false, mergedIntoId: null });
    // Se buscan por ids Y por mergedIntoId: en los datos viejos ese campo
    // guardaba el documento entero y la lista podia quedar incompleta.
    expect(JSON.stringify(filtro)).toContain('hija-1');
    expect(JSON.stringify(filtro)).toContain('cons-1');
  });

  it('al anular una cuenta NORMAL no toca nada mas', async () => {
    await build({
      _id: 'inv-1',
      invoiceNumber: 'INV-X',
      isConsolidated: false,
      status: 'cancelled',
    });

    await service.softDelete('inv-1');

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('propaga que la cuenta no existe', async () => {
    findOneAndUpdate = jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(null) }),
    });
    updateMany = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigsService,
          useValue: { obtener: async () => OPERACION_DEFAULT },
        },
        AccountsReceivableService,
        {
          provide: getModelToken(AccountReceivable.name),
          useValue: { findOneAndUpdate, updateMany },
        },
        { provide: getModelToken(Order.name), useValue: {} },
        { provide: getModelToken(Customer.name), useValue: {} },
        {
          provide: getConnectionToken(),
          useValue: {
            collection: () => ({
              findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 1 }),
            }),
          },
        },
        { provide: CustomerNotifierService, useValue: { notify: jest.fn() } },
        {
          provide: CustomerDebtService,
          useValue: { forCustomer: jest.fn() },
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

    await expect(
      moduleRef.get(AccountsReceivableService).softDelete('no-existe'),
    ).rejects.toThrow(/no encontrada/);
  });
});
