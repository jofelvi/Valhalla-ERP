/**
 * El dinero de una orden se recalcula con UN SOLO modelo.
 *
 * Corroborado en modo usuario el 07/09/2026 sobre una copia de produccion:
 * un admin aplicaba un 20% con su PIN (total correcto, 23.10) y en cuanto el
 * mesonero agregaba un refresco de $3, el PATCH recalculaba el total SIN
 * restar el descuento y cobrando el 10% de servicio sobre la base sin
 * descontar: 30.80 en vez de 26.40. El cliente pagaba $4.40 de mas y el
 * descuento seguia guardado en el item, contradiciendo al total.
 *
 * La causa era que `update` y `removeItem` recalculaban a mano en vez de usar
 * `computeOrderTotals`, que es el modelo canonico (y el unico probado). Este
 * spec fija que un PATCH posterior NO puede alterar un descuento ya
 * autorizado, ni volver a cobrar una cortesia.
 */
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
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
import { ConfigMap, NOMINA_DEFAULT, TARIFAS_DEFAULT } from '@odin6/types';

interface ItemPrueba {
  _id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discountAmount?: number;
  noCharge?: boolean;
  sentQty?: number;
}

interface TotalesGuardados {
  subtotal: number;
  serviceCharge: number;
  noChargeAmount: number;
  discountAmount: number;
  total: number;
  comisionBase: number;
}

describe('OrdersService.update — un solo modelo de dinero', () => {
  let service: OrdersService;
  let mockOrderModel: Record<string, jest.Mock>;
  /** Lo que el servicio manda a la base en el findOneAndUpdate. */
  let guardado: Record<string, unknown>;
  /** Configuracion vigente que el servicio lee (Ajustes). Se puede cambiar en la prueba. */
  let vigentes: Partial<ConfigMap> = {};

  const orderId = '507f1f77bcf86cd799439011';
  const usuario = { id: 'u-1', role: 'admin', name: 'Admin' };

  /** Orden actual en base: $25 con un descuento de $4 ya autorizado. */
  const itemsConDescuento = (): ItemPrueba[] => [
    {
      _id: 'item-1',
      productId: 'p1',
      name: 'Hamburguesa',
      quantity: 2,
      unitPrice: 10,
      total: 20,
      discountAmount: 4,
      sentQty: 2,
    },
    {
      _id: 'item-2',
      productId: 'p2',
      name: 'Cerveza',
      quantity: 1,
      unitPrice: 5,
      total: 5,
      sentQty: 1,
    },
  ];

  const ordenActual = (items: ItemPrueba[]) => ({
    _id: orderId,
    orderNumber: '060926-0031',
    paymentStatus: 'pending',
    isDeleted: false,
    subtotal: 25,
    serviceCharge: 2.1,
    discountAmount: 4,
    noChargeAmount: 0,
    total: 23.1,
    waiterId: 'w-1',
    userId: 'u-1',
    items,
    toObject() {
      return this;
    },
  });

  beforeEach(async () => {
    guardado = {};
    vigentes = {};
    const actual = ordenActual(itemsConDescuento());
    mockOrderModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(actual) }),
        exec: () => Promise.resolve(actual),
      }),
      findOneAndUpdate: jest.fn().mockImplementation((_f, payload) => {
        guardado = payload as Record<string, unknown>;
        return {
          lean: () => ({
            exec: () => Promise.resolve({ ...actual, ...guardado }),
          }),
        };
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        configsDePrueba(vigentes),
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
        { provide: PosGateway, useValue: { notifyOrderUpdated: jest.fn() } },
        { provide: AuthService, useValue: { verifyAdminPin: jest.fn() } },
        {
          provide: PaymentsService,
          useValue: { checkReferenceUsed: jest.fn().mockResolvedValue(false) },
        },
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
          // Cliente normal (no socio): esExcluido siempre false.
          provide: SociosExcluidosService,
          useValue: { esExcluido: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  const totales = (): TotalesGuardados => ({
    subtotal: Number(guardado.subtotal),
    serviceCharge: Number(guardado.serviceCharge),
    noChargeAmount: Number(guardado.noChargeAmount ?? 0),
    discountAmount: Number(guardado.discountAmount ?? 0),
    total: Number(guardado.total),
    comisionBase: Number(guardado.comisionBase ?? 0),
  });

  it('un PATCH que agrega un item NO borra el descuento ya autorizado', async () => {
    // El mesonero agrega un refresco de $3 a la orden que ya tenia el 20%.
    const items: ItemPrueba[] = [
      ...itemsConDescuento(),
      {
        _id: 'item-3',
        productId: 'p3',
        name: 'Refresco',
        quantity: 1,
        unitPrice: 3,
        total: 3,
      },
    ];

    await service.update(orderId, { items } as never, usuario as never);

    const t = totales();
    expect(t.subtotal).toBe(28);
    // El descuento sobrevive y sigue restandose.
    expect(t.discountAmount).toBe(4);
    // El 10% se cobra sobre lo que de verdad se cobra: (28 - 4).
    expect(t.serviceCharge).toBe(2.4);
    // 28 + 2.40 - 0 - 4
    expect(t.total).toBe(26.4);
  });

  it('un PATCH no vuelve a cobrar una cortesia', async () => {
    const items: ItemPrueba[] = [
      ...itemsConDescuento(),
      {
        _id: 'item-3',
        productId: 'p3',
        name: 'Postre de cortesia',
        quantity: 1,
        unitPrice: 6,
        total: 6,
        noCharge: true,
      },
    ];

    await service.update(orderId, { items } as never, usuario as never);

    const t = totales();
    expect(t.subtotal).toBe(31); // la cortesia entra a precio pleno
    expect(t.noChargeAmount).toBe(6);
    expect(t.discountAmount).toBe(4);
    // La cortesia NO baja la base del servicio (lo que paga el cliente); el
    // descuento SI.
    expect(t.serviceCharge).toBe(2.7); // (31 - 4) * 10%
    expect(t.total).toBe(23.7); // 31 + 2.70 - 6 - 4
    // Pero la comision del mesonero SI excluye la cortesia: (31 - 6 - 4) * 10%.
    expect(t.comisionBase).toBe(21);
  });

  it('subir la cantidad de una linea respeta el descuento de otra', async () => {
    // Es lo que hace el boton "+" de la pantalla de cobro.
    const items = itemsConDescuento();
    items[1] = { ...items[1], quantity: 2, total: 10 };

    await service.update(orderId, { items } as never, usuario as never);

    const t = totales();
    expect(t.subtotal).toBe(30);
    expect(t.discountAmount).toBe(4);
    expect(t.serviceCharge).toBe(2.6); // (30 - 4) * 10%
    expect(t.total).toBe(28.6); // 30 + 2.60 - 4
  });

  it('sin recargo de servicio, el descuento se sigue restando', async () => {
    const actualSinServicio = {
      ...ordenActual(itemsConDescuento()),
      serviceCharge: 0,
      total: 21,
      waiterId: null,
    };
    mockOrderModel.findOne.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(actualSinServicio) }),
      exec: () => Promise.resolve(actualSinServicio),
    });

    await service.update(
      orderId,
      { items: itemsConDescuento() } as never,
      usuario as never,
    );

    const t = totales();
    expect(t.serviceCharge).toBe(0);
    expect(t.discountAmount).toBe(4);
    expect(t.total).toBe(21); // 25 - 4
  });

  it('cambiar la tarifa en Ajustes no reescribe el servicio de una orden ya creada', async () => {
    // La orden nacio con el 10 %: su copia de configuracion quedo guardada en la orden.
    const creada = {
      ...ordenActual(itemsConDescuento()),
      configAplicada: { tarifas: TARIFAS_DEFAULT, nomina: NOMINA_DEFAULT },
    };
    // Despues el dueno sube la tarifa al 20 %: solo aplica a ordenes nuevas.
    vigentes.tarifas = { ...TARIFAS_DEFAULT, serviceRate: 0.2 };
    mockOrderModel.findOne.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(creada) }),
      exec: () => Promise.resolve(creada),
    });

    await service.update(
      orderId,
      { items: itemsConDescuento() } as never,
      usuario as never,
    );

    const t = totales();
    expect(t.serviceCharge).toBe(2.1); // (25 - 4) x 10 %, no x 20 %
    expect(t.total).toBe(23.1);
  });
});
