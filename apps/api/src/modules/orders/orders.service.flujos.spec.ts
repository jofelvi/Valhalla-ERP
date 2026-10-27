/**
 * Caracterizacion de los flujos de `OrdersService` que mueven mesas y
 * productos y que no tenian ni una prueba: reclamar mesa al crear, candado de
 * lo ya comandado, entregar, borrar/anular y fusionar.
 *
 * Se prueba el efecto que importa en la base (que se escribe, con que filtro)
 * y no solo que "lanza". La regla de las mesas es la de CLAUDE.md: liberar
 * SIEMPRE los 3 campos (status, isAvailable, orderId) o la mesa queda roja.
 */
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
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
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { TableStatusEnum, OrderStatusEnum } from '@odin6/types';
import { configsDePrueba } from './configs-de-prueba';

type AuthUser = Parameters<OrdersService['remove']>[1];

/**
 * Consulta de Mongoose falsa: sirve igual con `await q`, `q.lean()`,
 * `q.lean().exec()` y `q.select(...)`, que es como la usa el servicio.
 */
interface ConsultaFalsa<T> extends PromiseLike<T> {
  lean: () => ConsultaFalsa<T>;
  select: () => ConsultaFalsa<T>;
  exec: () => Promise<T>;
}
const consulta = <T>(valor: T): ConsultaFalsa<T> => {
  const q: ConsultaFalsa<T> = {
    lean: () => q,
    select: () => q,
    exec: () => Promise.resolve(valor),
    then: (ok, error) => Promise.resolve(valor).then(ok, error),
  };
  return q;
};

/** Los 3 campos que dejan una mesa libre en el POS. */
const MESA_LIBRE = {
  status: TableStatusEnum.ISAVAILABLE,
  isAvailable: true,
  orderId: null,
};

const admin: AuthUser = { id: 'admin-1', name: 'Admin', role: 'admin' };
const mesonero: AuthUser = { id: 'w-1', name: 'Mesonero', role: 'waiter' };

describe('OrdersService — flujos de mesa, entrega, borrado y fusion', () => {
  let service: OrdersService;
  let orderModel: Record<string, jest.Mock>;
  let tableModel: Record<string, jest.Mock>;
  let userModel: Record<string, jest.Mock>;
  let paymentModel: Record<string, jest.Mock>;
  let verifyAdminPin: jest.Mock;
  let recordEvent: jest.Mock;

  beforeEach(async () => {
    orderModel = {
      findOne: jest.fn().mockReturnValue(consulta(null)),
      findOneAndUpdate: jest.fn().mockReturnValue(consulta(null)),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      create: jest.fn(),
    };
    tableModel = {
      findOne: jest.fn().mockReturnValue(consulta(null)),
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue(consulta({ _id: 'mesa-1', ...MESA_LIBRE })),
    };
    userModel = {
      findOne: jest
        .fn()
        .mockReturnValue(consulta({ _id: 'w-1', name: 'Mesonero' })),
    };
    paymentModel = { countDocuments: jest.fn().mockResolvedValue(0) };
    verifyAdminPin = jest.fn();
    recordEvent = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        configsDePrueba(),
        OrdersService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Table.name), useValue: tableModel },
        {
          provide: getModelToken('User'),
          useValue: userModel,
        },
        {
          provide: getModelToken('Product'),
          useValue: { find: jest.fn().mockReturnValue(consulta([])) },
        },
        { provide: getModelToken('Invoice'), useValue: {} },
        { provide: getModelToken('Payment'), useValue: paymentModel },
        {
          provide: PosGateway,
          useValue: {
            notifyOrderCreated: jest.fn(),
            notifyOrderUpdated: jest.fn(),
            notifyOrderDeleted: jest.fn(),
            notifyTableUpdated: jest.fn(),
          },
        },
        { provide: AuthService, useValue: { verifyAdminPin } },
        {
          provide: PaymentsService,
          useValue: { checkReferenceUsed: jest.fn().mockResolvedValue(false) },
        },
        { provide: OcrService, useValue: {} },
        {
          provide: OrderItemEventsService,
          useValue: { record: recordEvent, recordMany: jest.fn() },
        },
        { provide: PagoMovilService, useValue: {} },
        {
          provide: ConsumptionService,
          useValue: { reverseOrder: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: AccountsReceivableService, useValue: {} },
        {
          provide: MovementsService,
          useValue: { emit: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: KitchenNotifierService,
          useValue: { itemsDelivered: jest.fn() },
        },
        {
          provide: SociosExcluidosService,
          useValue: { esExcluido: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  // ─── create: reclamo atomico de la mesa ───────────────────────────────
  describe('create con mesa', () => {
    const dto = (): CreateOrderDto => ({
      items: [
        {
          productId: 'p1',
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
          name: 'Hamburguesa',
        },
      ],
      subtotal: 10,
      total: 11,
      serviceCharge: 1,
      userId: 'cajero-1',
      waiterId: 'w-1',
      tableId: 'mesa-1',
      orderNumber: '260926-0001',
    });

    it('reclama la mesa solo si esta libre o reservada por quien crea', async () => {
      orderModel.create.mockImplementation((payload: object) =>
        Promise.resolve({
          _id: 'orden-1',
          ...payload,
          toObject: () => ({ _id: 'orden-1', ...payload }),
        }),
      );

      await service.create(dto());

      const [filtro, cambio] = tableModel.findOneAndUpdate.mock.calls[0];
      expect(filtro).toEqual({
        _id: 'mesa-1',
        orderId: null,
        $or: [
          { isAvailable: true },
          { isAvailable: false, claimedBy: { $in: ['cajero-1', 'w-1'] } },
        ],
      });
      expect(cambio).toMatchObject({
        status: TableStatusEnum.OCCUPIED,
        isAvailable: false,
        orderId: 'PENDING_ORDER_CREATION',
      });
      // Y al final la mesa apunta a la orden real, no al marcador.
      const ultimo = tableModel.findOneAndUpdate.mock.calls.at(-1);
      expect(JSON.stringify(ultimo)).toContain('orden-1');
    });

    it('si la mesa ya tiene una orden activa, no crea nada', async () => {
      tableModel.findOneAndUpdate.mockReturnValueOnce(consulta(null));
      orderModel.findOne.mockReturnValueOnce(
        consulta({ _id: 'abcdef1234567890', status: 'PENDING' }),
      );

      await expect(service.create(dto())).rejects.toThrow(
        /ya tiene una orden activa \(#34567890/,
      );
      expect(orderModel.create).not.toHaveBeenCalled();
    });

    it('si otro mesonero la esta atendiendo, lo dice con su nombre', async () => {
      tableModel.findOneAndUpdate.mockReturnValueOnce(consulta(null));
      tableModel.findOne.mockReturnValueOnce(
        consulta({ claimedBy: 'w-9', claimedByName: 'Jostin' }),
      );

      await expect(service.create(dto())).rejects.toThrow(
        'La mesa la esta atendiendo Jostin.',
      );
      expect(orderModel.create).not.toHaveBeenCalled();
    });

    it('si crear la orden falla, devuelve la mesa libre (rollback)', async () => {
      orderModel.create.mockRejectedValue(new Error('mongo caido'));

      await expect(service.create(dto())).rejects.toThrow('mongo caido');

      const rollback = tableModel.findOneAndUpdate.mock.calls[1];
      expect(rollback[0]).toEqual({
        _id: 'mesa-1',
        orderId: 'PENDING_ORDER_CREATION',
      });
      expect(rollback[1]).toEqual(MESA_LIBRE);
    });
  });

  // ─── update: candado de lo ya comandado ───────────────────────────────
  describe('update: quitar lo ya comandado', () => {
    beforeEach(() => {
      orderModel.findOne.mockReturnValue(
        consulta({
          _id: 'orden-1',
          serviceCharge: 0,
          items: [
            {
              _id: 'item-1',
              productId: 'p1',
              name: 'Cerveza',
              quantity: 6,
              unitPrice: 5,
              total: 30,
              sentQty: 6,
            },
          ],
        }),
      );
    });

    const quitarTodo = (extra: Partial<UpdateOrderDto> = {}): UpdateOrderDto =>
      ({ items: [], ...extra }) as UpdateOrderDto;

    const estadoDe = async (p: Promise<unknown>): Promise<number | null> => {
      try {
        await p;
        return null;
      } catch (err: unknown) {
        return err instanceof HttpException ? err.getStatus() : -1;
      }
    };

    it('sin PIN ni motivo responde 428 y no escribe', async () => {
      await expect(
        estadoDe(service.update('orden-1', quitarTodo(), admin)),
      ).resolves.toBe(428);
      expect(verifyAdminPin).not.toHaveBeenCalled();
      expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('con PIN pero sin motivo tambien responde 428', async () => {
      await expect(
        estadoDe(
          service.update('orden-1', quitarTodo({ editPin: '1234' }), admin),
        ),
      ).resolves.toBe(428);
      expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('con un PIN invalido responde 428 y no escribe', async () => {
      verifyAdminPin.mockResolvedValue({ valid: false });

      await expect(
        estadoDe(
          service.update(
            'orden-1',
            quitarTodo({ editPin: '0000', editReason: 'se equivoco' }),
            admin,
          ),
        ),
      ).resolves.toBe(428);
      expect(verifyAdminPin).toHaveBeenCalledWith('0000');
      expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  // ─── deliverItem ──────────────────────────────────────────────────────
  describe('deliverItem', () => {
    const orden = (item: Record<string, unknown>) => ({
      _id: 'orden-1',
      items: [
        { _id: 'item-0', name: 'Pizza', quantity: 1, deliveredQty: 1 },
        {
          _id: 'item-1',
          productId: 'p1',
          name: 'Cerveza',
          quantity: 3,
          ...item,
        },
      ],
    });

    it('suma lo entregado sobre el item por su indice y deja el evento', async () => {
      orderModel.findOne.mockReturnValue(consulta(orden({ deliveredQty: 1 })));

      await service.deliverItem('orden-1', 'item-1', 2, admin);

      expect(orderModel.updateOne).toHaveBeenCalledWith(
        { _id: 'orden-1' },
        { $inc: { 'items.1.deliveredQty': 2 } },
      );
      // Sello de la última entrega: la zona del POS muestra quién y cuándo.
      expect(orderModel.updateOne).toHaveBeenCalledWith(
        { _id: 'orden-1' },
        {
          $set: {
            ultimaEntrega: expect.objectContaining({
              porId: 'admin-1',
              en: expect.any(Date),
            }),
          },
        },
      );
      expect(recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ITEM_DELIVERED',
          qty: 2,
          previousDeliveredQty: 1,
          newDeliveredQty: 3,
          actorId: 'admin-1',
        }),
      );
    });

    it('no entrega mas de lo pedido', async () => {
      orderModel.findOne.mockReturnValue(consulta(orden({ deliveredQty: 2 })));

      await expect(
        service.deliverItem('orden-1', 'item-1', 2, admin),
      ).rejects.toThrow('No se pueden entregar 4 unidades');
      expect(orderModel.updateOne).not.toHaveBeenCalled();
    });

    it('no entrega un item cancelado', async () => {
      orderModel.findOne.mockReturnValue(
        consulta(orden({ deliveredQty: 0, cancelledAt: new Date() })),
      );

      await expect(
        service.deliverItem('orden-1', 'item-1', 1, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(orderModel.updateOne).not.toHaveBeenCalled();
    });
  });

  // ─── remove / cancelWithPin ───────────────────────────────────────────
  describe('remove', () => {
    it('libera la mesa con los 3 campos y borra la orden', async () => {
      orderModel.findOne.mockReturnValue(
        consulta({ _id: 'orden-1', tableId: 'mesa-1', items: [] }),
      );

      await service.remove('orden-1', admin);

      expect(tableModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'mesa-1' },
        MESA_LIBRE,
        { new: true },
      );
      expect(orderModel.deleteOne).toHaveBeenCalledWith({ _id: 'orden-1' });
    });

    it('un mesonero no borra la orden de otro', async () => {
      orderModel.findOne.mockReturnValue(
        consulta({ _id: 'orden-1', waiterId: 'w-9', userId: 'w-9' }),
      );

      await expect(service.remove('orden-1', mesonero)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(tableModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(orderModel.deleteOne).not.toHaveBeenCalled();
    });
  });

  // ─── descartarSinCobrar: "atras" en la pantalla de cobro ─────────────
  // ─── addItem (POST /:id/items): mismas guardas de dinero que el PATCH ──
  describe('addItem', () => {
    const ordenDoc = (over: Record<string, unknown> = {}) => ({
      _id: 'orden-1',
      waiterId: 'w-1',
      status: 'PENDING',
      paymentStatus: 'pending',
      items: [],
      save: jest.fn(),
      ...over,
    });
    const ponerCatalogo = (price: number) => {
      (
        service as unknown as { productModel: { find: jest.Mock } }
      ).productModel.find.mockReturnValue(
        consulta([{ _id: 'p1', price, name: 'Buchanans' }]),
      );
    };
    const item = (over: Record<string, unknown> = {}) =>
      ({
        productId: 'p1',
        name: 'Buchanans',
        quantity: 1,
        unitPrice: 70,
        ...over,
      }) as never;

    it('no agrega productos a una orden ya cobrada (409)', async () => {
      const doc = ordenDoc({ paymentStatus: 'pending_verification' });
      orderModel.findOne.mockReturnValue(consulta(doc));
      ponerCatalogo(70);

      await expect(
        service.addItem('orden-1', item(), mesonero),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('rechaza un precio menor al del catalogo (400)', async () => {
      const doc = ordenDoc();
      orderModel.findOne.mockReturnValue(consulta(doc));
      ponerCatalogo(70);

      await expect(
        service.addItem('orden-1', item({ unitPrice: 0.01 }), mesonero),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('rechaza un producto nuevo que llega como cortesia (400)', async () => {
      const doc = ordenDoc();
      orderModel.findOne.mockReturnValue(consulta(doc));
      ponerCatalogo(70);

      await expect(
        service.addItem('orden-1', item({ noCharge: true }), mesonero),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(doc.save).not.toHaveBeenCalled();
    });
  });

  describe('descartarSinCobrar', () => {
    const borrador = {
      _id: 'orden-1',
      tableId: 'mesa-1',
      paymentStatus: 'pending',
      waiterId: 'w-1',
      items: [{ productId: 'p1', quantity: 2, printedQty: 0, deliveredQty: 0 }],
    };

    it('borra el borrador sin cobro y libera la mesa con los 3 campos', async () => {
      orderModel.findOne.mockReturnValue(consulta(borrador));

      await service.descartarSinCobrar('orden-1', mesonero);

      expect(tableModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'mesa-1' },
        MESA_LIBRE,
        { new: true },
      );
      // A1: el borrado es atomico; el filtro repite las condiciones del borrador.
      expect(orderModel.deleteOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'orden-1',
          paidAmount: { $in: [null, 0] },
        }),
      );
    });

    it('409 y la mesa NO se libera si el borrado no casa (deletedCount 0)', async () => {
      orderModel.findOne.mockReturnValue(
        consulta({
          _id: 'orden-1',
          waiterId: 'w-1',
          status: 'PENDING',
          paymentStatus: 'pending',
          items: [],
          tableId: 'mesa-1',
        }),
      );
      orderModel.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
      await expect(
        service.descartarSinCobrar('orden-1', mesonero),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tableModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('409 si la orden es una cuenta a crédito (status CREDIT)', async () => {
      orderModel.findOne.mockReturnValue(
        consulta({
          _id: 'orden-1',
          waiterId: 'w-1',
          status: 'CREDIT',
          paymentStatus: 'pending',
          items: [],
        }),
      );
      await expect(
        service.descartarSinCobrar('orden-1', mesonero),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(orderModel.deleteOne).not.toHaveBeenCalled();
    });

    it.each([
      ['ya esta marcada pagada', { paymentStatus: 'paid' }],
      ['espera verificacion', { paymentStatus: 'pending_verification' }],
      ['trae pagos pendientes cargados', { pendingPayments: [{ amount: 5 }] }],
      ['ya imprimio un producto', { items: [{ printedQty: 1 }] }],
      ['ya entrego un producto', { items: [{ deliveredQty: 1 }] }],
      ['ya movio inventario', { inventoryProcessed: true }],
    ])('rechaza con 409 y no borra nada si %s', async (_caso, cambio) => {
      orderModel.findOne.mockReturnValue(consulta({ ...borrador, ...cambio }));

      await expect(
        service.descartarSinCobrar('orden-1', mesonero),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(orderModel.deleteOne).not.toHaveBeenCalled();
      expect(tableModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rechaza si ya hay un pago registrado en la coleccion de pagos', async () => {
      orderModel.findOne.mockReturnValue(consulta(borrador));
      paymentModel.countDocuments.mockResolvedValue(1);

      await expect(
        service.descartarSinCobrar('orden-1', mesonero),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(orderModel.deleteOne).not.toHaveBeenCalled();
    });

    it('un mesonero no descarta la orden de otro', async () => {
      orderModel.findOne.mockReturnValue(
        consulta({ ...borrador, waiterId: 'w-9', userId: 'w-9' }),
      );

      await expect(
        service.descartarSinCobrar('orden-1', mesonero),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(orderModel.deleteOne).not.toHaveBeenCalled();
    });
  });

  describe('cancelWithPin', () => {
    it('solo un admin puede anular: el PIN de un manager no sirve', async () => {
      verifyAdminPin.mockResolvedValue({ valid: true, adminRole: 'manager' });

      await expect(service.cancelWithPin('orden-1', '1234')).rejects.toThrow(
        'PIN invalido',
      );
      expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('anula sin borrar: libera la mesa y deja la orden marcada', async () => {
      verifyAdminPin.mockResolvedValue({
        valid: true,
        adminRole: 'admin',
        adminName: 'Dueño',
      });
      orderModel.findOne.mockReturnValue(
        consulta({ _id: 'orden-1', tableId: 'mesa-1' }),
      );

      await service.cancelWithPin('orden-1', '1234', 'cliente se fue');

      expect(tableModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'mesa-1' },
        MESA_LIBRE,
        { new: true },
      );
      const [filtro, cambio] = orderModel.findOneAndUpdate.mock.calls[0];
      expect(filtro).toEqual({ _id: 'orden-1' });
      expect(cambio.$set).toMatchObject({
        status: OrderStatusEnum.CANCELLED,
        isDeleted: true,
        deletedBy: 'Dueño',
        deletedReason: 'cliente se fue',
      });
      expect(orderModel.deleteOne).not.toHaveBeenCalled();
    });
  });

  // ─── mergeOrders ──────────────────────────────────────────────────────
  describe('mergeOrders', () => {
    const base = {
      items: [] as Array<Record<string, unknown>>,
      subtotal: 0,
      serviceCharge: 0,
      tax: 0,
      total: 0,
      status: 'PENDING',
    };
    let destino: Record<string, unknown> & {
      save: jest.Mock;
      markModified: jest.Mock;
    };

    beforeEach(() => {
      verifyAdminPin.mockResolvedValue({ valid: true, adminId: 'admin-1' });
      destino = {
        ...base,
        _id: 'destino',
        tableId: 'mesa-1',
        fichaNonce: 'vieja',
        items: [
          {
            _id: 'a',
            productId: 'p1',
            name: 'Pizza',
            quantity: 1,
            unitPrice: 8,
            total: 8,
          },
        ],
        subtotal: 8,
        total: 8,
        save: jest.fn().mockResolvedValue(undefined),
        markModified: jest.fn(),
      };
      destino.toObject = () => ({ ...destino });
      const origen = {
        ...base,
        _id: 'origen',
        tableId: 'mesa-2',
        items: [
          {
            _id: 'b',
            productId: 'p2',
            name: 'Cerveza',
            quantity: 2,
            unitPrice: 2,
            total: 4,
          },
        ],
        subtotal: 4,
        total: 4,
      };
      origen.toObject = () => ({ ...origen });
      orderModel.findOne.mockImplementation((f: { _id: string }) =>
        consulta(f._id === 'destino' ? destino : origen),
      );
    });

    it('marca el origen como fusionado solo si nadie lo fusiono antes', async () => {
      orderModel.findOneAndUpdate.mockReturnValue(consulta({ _id: 'origen' }));

      await service.mergeOrders('destino', 'origen', '1234');

      const [filtro, cambio] = orderModel.findOneAndUpdate.mock.calls[0];
      expect(filtro).toEqual({
        _id: 'origen',
        mergedIntoOrderId: { $exists: false },
        isDeleted: { $ne: true },
      });
      expect(cambio.$set).toMatchObject({
        mergedIntoOrderId: 'destino',
        isDeleted: true,
        mergedBy: 'admin-1',
      });
    });

    it('pasa los items al destino, revoca su ficha y libera la mesa del origen', async () => {
      orderModel.findOneAndUpdate.mockReturnValue(consulta({ _id: 'origen' }));

      await service.mergeOrders('destino', 'origen', '1234');

      expect(destino.save).toHaveBeenCalled();
      expect((destino.items as unknown[]).length).toBe(2);
      expect(destino.mergedFromOrderIds).toEqual(['origen']);
      expect(destino.fichaNonce).not.toBe('vieja');
      expect(tableModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'mesa-2', orderId: 'origen' },
        MESA_LIBRE,
        { new: true },
      );
    });

    it('si otra caja lo fusiono primero, no toca el destino ni la mesa', async () => {
      orderModel.findOneAndUpdate.mockReturnValue(consulta(null));

      await expect(
        service.mergeOrders('destino', 'origen', '1234'),
      ).rejects.toThrow(/fusionada o anulada por otra caja/);
      expect(destino.save).not.toHaveBeenCalled();
      expect(tableModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  // 27/09/2026: pos-data devolvia la coleccion `users` entera, con el hash de
  // la contraseña y el PIN de admin en texto plano, a cualquiera que abriera
  // el POS o el telefono del mesonero.
  describe('getPosData — usuarios sin datos sensibles', () => {
    const usuarioCompleto = {
      _id: 'u-1',
      name: 'Carlos',
      role: 'admin',
      isActive: true,
      email: 'carlos@example.com',
      passwordHash: '$2b$10$hash',
      pin: '1234',
      pinHash: '$2b$10$pinhash',
    };

    beforeEach(() => {
      orderModel.find = jest.fn().mockReturnValue({
        lean: () => ({ sort: () => ({ exec: () => Promise.resolve([]) }) }),
      });
      tableModel.find = jest.fn().mockReturnValue(consulta([]));
    });

    it('aunque Mongo devuelva todo, solo salen id, nombre, rol y activo', async () => {
      userModel.find = jest.fn().mockReturnValue(consulta([usuarioCompleto]));

      const { users } = await service.getPosData();

      expect(users).toEqual([
        {
          id: 'u-1',
          _id: 'u-1',
          name: 'Carlos',
          role: 'admin',
          isActive: true,
        },
      ]);
    });

    it('pide a Mongo solo esos campos', async () => {
      const select = jest.fn();
      const q = consulta([usuarioCompleto]);
      select.mockReturnValue(q);
      userModel.find = jest.fn().mockReturnValue({ ...q, select });

      await service.getPosData();

      expect(select).toHaveBeenCalledWith('_id name role isActive');
    });
  });

  // ─── update: guardas de dinero del modelo PREPAGO ─────────────────────
  describe('update: cobro PREPAGO (guardas de dinero)', () => {
    const cerveza = {
      _id: 'item-1',
      productId: 'p1',
      name: 'Cerveza',
      quantity: 2,
      unitPrice: 5,
      total: 10,
      sentQty: 2,
    };
    const pizza = {
      productId: 'p2',
      name: 'Pizza',
      quantity: 1,
      unitPrice: 8,
      total: 8,
    };

    const ordenCon = (paymentStatus: string | null, status = 'pending') => ({
      _id: 'orden-1',
      total: 10,
      subtotal: 10,
      serviceCharge: 0,
      status,
      paymentStatus,
      items: [cerveza],
    });

    const estadoDe = async (p: Promise<unknown>): Promise<number | null> => {
      try {
        await p;
        return null;
      } catch (err: unknown) {
        return err instanceof HttpException ? err.getStatus() : -1;
      }
    };

    beforeEach(() => {
      orderModel.findOneAndUpdate.mockImplementation(
        (_f: unknown, patch: Record<string, unknown>) =>
          consulta({ _id: 'orden-1', ...patch }),
      );
    });

    it('agregar productos a una orden ya cobrada responde 409 y no escribe', async () => {
      orderModel.findOne.mockReturnValue(
        consulta(ordenCon('pending_verification')),
      );

      const err = await service
        .update(
          'orden-1',
          { items: [cerveza, pizza] } as unknown as UpdateOrderDto,
          admin,
        )
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).message).toBe(
        'Este pedido ya está cobrado: para agregar productos crea un pedido nuevo.',
      );
      expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('tambien bloquea si la orden ya esta paid', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenCon('paid')));

      await expect(
        estadoDe(
          service.update(
            'orden-1',
            { items: [cerveza, pizza] } as unknown as UpdateOrderDto,
            admin,
          ),
        ),
      ).resolves.toBe(409);
      expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('agregar productos a una orden sin cobrar pasa', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenCon('pending')));

      await expect(
        service.update(
          'orden-1',
          { items: [cerveza, pizza] } as unknown as UpdateOrderDto,
          admin,
        ),
      ).resolves.toBeDefined();
      expect(orderModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('quitar productos de una orden cobrada no se bloquea aqui', async () => {
      orderModel.findOne.mockReturnValue(
        consulta(ordenCon('pending_verification')),
      );

      await expect(
        estadoDe(
          service.update(
            'orden-1',
            { items: [] } as unknown as UpdateOrderDto,
            admin,
          ),
        ),
      ).resolves.toBe(428);
      // 428 viene del candado de PIN (lo ya comandado), no del 409 nuevo.
      expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('cobro pending_verification que no cubre el total responde 400 y no escribe', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenCon('pending')));

      const err = await service
        .update(
          'orden-1',
          {
            paymentStatus: 'pending_verification',
            pendingPayments: [{ method: 'CASH_USD', amount: 5 }],
          } as unknown as UpdateOrderDto,
          admin,
        )
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toBe(
        'El pago no cubre el total: faltan $5.00.',
      );
      expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('cobro que cubre el total exacto pasa', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenCon('pending')));

      await expect(
        service.update(
          'orden-1',
          {
            paymentStatus: 'pending_verification',
            pendingPayments: [{ method: 'CASH_USD', amount: 10 }],
          } as unknown as UpdateOrderDto,
          admin,
        ),
      ).resolves.toBeDefined();
      expect(orderModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('pago mixto de dos entradas que suma el total pasa', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenCon('pending')));

      await expect(
        service.update(
          'orden-1',
          {
            paymentStatus: 'pending_verification',
            pendingPayments: [
              { method: 'CASH_USD', amount: 4 },
              { method: 'PAGO_MOVIL', amount: 6, reference: null },
            ],
          } as unknown as UpdateOrderDto,
          admin,
        ),
      ).resolves.toBeDefined();
    });

    it('pago mixto que suma menos del total responde 400', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenCon('pending')));

      await expect(
        estadoDe(
          service.update(
            'orden-1',
            {
              paymentStatus: 'pending_verification',
              pendingPayments: [
                { method: 'CASH_USD', amount: 4 },
                { method: 'PAGO_MOVIL', amount: 5.9, reference: null },
              ],
            } as unknown as UpdateOrderDto,
            admin,
          ),
        ),
      ).resolves.toBe(400);
    });

    it('cobro parcial junto con items que suben el total se mide contra el total nuevo', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenCon('pending')));

      // Total nuevo = 10 (cerveza) + 8 (pizza) = 18; el cobro trae solo 10.
      await expect(
        estadoDe(
          service.update(
            'orden-1',
            {
              items: [cerveza, pizza],
              paymentStatus: 'pending_verification',
              pendingPayments: [{ method: 'CASH_USD', amount: 10 }],
            } as unknown as UpdateOrderDto,
            admin,
          ),
        ),
      ).resolves.toBe(400);
      expect(orderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('en una orden cobrada, productos nuevos + cobro que cubre el total nuevo pasa', async () => {
      orderModel.findOne.mockReturnValue(
        consulta(ordenCon('pending_verification')),
      );

      await expect(
        service.update(
          'orden-1',
          {
            items: [cerveza, pizza],
            paymentStatus: 'pending_verification',
            pendingPayments: [{ method: 'CASH_USD', amount: 18 }],
          } as unknown as UpdateOrderDto,
          admin,
        ),
      ).resolves.toBeDefined();
      expect(orderModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('una orden cobrada que solo reenvia sus items (entrega) no se bloquea', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenCon('paid')));

      await expect(
        service.update(
          'orden-1',
          { items: [cerveza] } as unknown as UpdateOrderDto,
          admin,
        ),
      ).resolves.toBeDefined();
    });
  });

  // ─── Guardas de dinero del PATCH: cobro (C1, M1), piso de precio (C2), total cobrado (M2) ───
  describe('guardas de dinero del PATCH', () => {
    const ID = 'orden-1';
    const ITEM = (
      qty: number,
      unit: number,
      extra: Record<string, unknown> = {},
    ) => ({
      _id: 'l1',
      productId: 'p1',
      name: 'Tequeño',
      quantity: qty,
      unitPrice: unit,
      total: qty * unit,
      sentQty: qty,
      ...extra,
    });
    const ordenBase = (over: Record<string, unknown> = {}) => ({
      _id: ID,
      waiterId: 'w-1',
      status: 'PENDING',
      paymentStatus: 'pending',
      total: 20,
      items: [ITEM(2, 10)],
      pendingPayments: [],
      ...over,
    });
    const ponerCatalogo = (price: number) => {
      (
        service as unknown as { productModel: { find: jest.Mock } }
      ).productModel.find.mockReturnValue(
        consulta([{ _id: 'p1', price, name: 'Tequeño' }]),
      );
    };
    /** Un PATCH que pasa las guardas puede fallar despues por otros mocks: solo importa que no sea 400/409. */
    const sinRechazoDeDinero = async (p: Promise<unknown>) => {
      try {
        await p;
      } catch (e) {
        expect(e).not.toBeInstanceOf(BadRequestException);
        expect(e).not.toBeInstanceOf(ConflictException);
      }
    };

    beforeEach(() => {
      ponerCatalogo(10);
      paymentModel.find = jest.fn().mockReturnValue(consulta([]));
      orderModel.findOne.mockReturnValue(consulta(ordenBase()));
      orderModel.findOneAndUpdate.mockReturnValue(consulta(ordenBase()));
    });

    it('un PATCH sin items no escribe montos: {total:0} se ignora', async () => {
      await sinRechazoDeDinero(
        service.update(
          ID,
          { total: 0, subtotal: 0, serviceCharge: 0, notes: 'x' } as never,
          mesonero,
        ),
      );
      for (const [, payload] of orderModel.findOneAndUpdate.mock.calls) {
        const p = payload as Record<string, unknown>;
        expect(p).not.toHaveProperty('total');
        expect(p).not.toHaveProperty('subtotal');
        expect(p).not.toHaveProperty('serviceCharge');
      }
    });

    it('C1: paymentStatus "paid" sin Payment que cubra el total → 400', async () => {
      await expect(
        service.update(ID, { paymentStatus: 'paid' } as never, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('C1: paymentStatus "partial" sin ningun pago → 400', async () => {
      await expect(
        service.update(ID, { paymentStatus: 'partial' } as never, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('C1: pending_verification con pendingPayments null → 400', async () => {
      await expect(
        service.update(
          ID,
          {
            paymentStatus: 'pending_verification',
            pendingPayments: null,
          } as never,
          mesonero,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('C1: el cajero cobra con Payments que cubren el total y marca paid → pasa', async () => {
      paymentModel.find = jest
        .fn()
        .mockReturnValue(consulta([{ amount: 20, status: 'paid' }]));
      await sinRechazoDeDinero(
        service.update(
          ID,
          {
            paymentStatus: 'paid',
            status: 'PAID',
            pendingPayments: null,
          } as never,
          admin,
        ),
      );
    });

    it('C1: un Payment anulado no cuenta para cubrir el total → 400', async () => {
      paymentModel.find = jest
        .fn()
        .mockReturnValue(consulta([{ amount: 20, status: 'anulado' }]));
      await expect(
        service.update(ID, { paymentStatus: 'paid' } as never, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('verificacion de caja: pending_verification que cubre → pasa', async () => {
      await sinRechazoDeDinero(
        service.update(
          ID,
          {
            paymentStatus: 'pending_verification',
            pendingPayments: [{ method: 'CASH_USD', amount: 20 }],
          } as never,
          mesonero,
        ),
      );
    });

    it('verificacion de caja: paid que confirma lo declarado pasa a caja, no al mesonero', async () => {
      orderModel.findOne.mockReturnValue(
        consulta(
          ordenBase({ pendingPayments: [{ method: 'CASH_USD', amount: 20 }] }),
        ),
      );
      await sinRechazoDeDinero(
        service.update(ID, { paymentStatus: 'paid' } as never, admin),
      );
      await expect(
        service.update(ID, { paymentStatus: 'paid' } as never, mesonero),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('M1: amount negativo que "cubre" el total → 400', async () => {
      await expect(
        service.update(
          ID,
          {
            paymentStatus: 'pending_verification',
            pendingPayments: [
              { method: 'CASH_USD', amount: 100 },
              { method: 'CASH_USD', amount: -90 },
            ],
          } as never,
          mesonero,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('M1: amount no numerico → 400', async () => {
      await expect(
        service.update(
          ID,
          {
            paymentStatus: 'pending_verification',
            pendingPayments: [{ method: 'CASH_USD', amount: 'abc' }],
          } as never,
          mesonero,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('C2: unitPrice por debajo del catalogo → 400 "Precio invalido"', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenBase({ items: [] })));
      await expect(
        service.update(ID, { items: [ITEM(1, 2)] } as never, admin),
      ).rejects.toThrow('Precio inválido para Tequeño');
    });

    it('C2: unitPrice igual al catalogo → pasa', async () => {
      orderModel.findOne.mockReturnValue(consulta(ordenBase({ items: [] })));
      await sinRechazoDeDinero(
        service.update(ID, { items: [ITEM(1, 10)] } as never, admin),
      );
    });

    it('C2: item existente con descuento guardado reenviado igual → pasa', async () => {
      const conDescuento = [
        ITEM(2, 10, { discountAmount: 2, discountReason: 'socio' }),
      ];
      orderModel.findOne.mockReturnValue(
        consulta(ordenBase({ items: conDescuento })),
      );
      await sinRechazoDeDinero(
        service.update(ID, { items: conDescuento } as never, admin),
      );
    });

    it('C2: un PATCH que introduce un descuento → 400', async () => {
      orderModel.findOne.mockReturnValue(
        consulta(ordenBase({ items: [ITEM(2, 10)] })),
      );
      await expect(
        service.update(
          ID,
          { items: [ITEM(2, 10, { discountAmount: 5 })] } as never,
          admin,
        ),
      ).rejects.toThrow('solo se cambian con su acción y PIN admin');
    });

    it('M2: bajar el total de una orden ya cobrada → 409', async () => {
      orderModel.findOne.mockReturnValue(
        consulta(
          ordenBase({
            paymentStatus: 'paid',
            status: 'PAID',
            total: 20,
            items: [ITEM(2, 10, { sentQty: 0 })],
          }),
        ),
      );
      await expect(
        service.update(
          ID,
          { items: [ITEM(1, 10, { sentQty: 0 })] } as never,
          admin,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('M2: entrega que reenvia los mismos items de una orden cobrada → pasa', async () => {
      orderModel.findOne.mockReturnValue(
        consulta(
          ordenBase({ paymentStatus: 'paid', status: 'PAID', total: 20 }),
        ),
      );
      await sinRechazoDeDinero(
        service.update(ID, { items: [ITEM(2, 10)] } as never, admin),
      );
    });
  });
});
