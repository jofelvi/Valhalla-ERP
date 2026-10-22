import { CONFIG_DEFAULTS, ConfigId, MODULOS_DEFAULT } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { REGISTRO_PACKS_PRUEBA } from './registro-packs.fixture';
/**
 * Conversion a pack, contra el servicio DE VERDAD.
 *
 * Se llama a OrdersService con los modelos mockeados, no a una copia de la
 * logica: el spec de packs que ya existia reimplementaba `normalizePackLines`
 * dentro del propio test, y esa copia se quedo con `toFixed(4)` cuando el
 * servidor usa `toFixed(2)`. Una prueba que reimplementa lo que deberia
 * verificar deja de proteger el dia que el original cambia.
 *
 * Lo que se fija aca:
 *
 *   1. El GET de opciones NO escribe nada. Convertir es una opcion, no una
 *      obligacion (regla del dueño, 20/09/2026).
 *   2. El precio sale del CATALOGO, no del cliente. El mapa que usaba la web
 *      tenia el tobo de lata en $11 mientras la ficha decia $14.
 *   3. Items, totales y nota de sistema se guardan de una sola vez.
 */
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
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

const PILSEN = 'prod-botella-b';
const TOBO = 'pack-tobo-12';
const MEDIA_CAJA = 'pack-media-18';
const CAJA = 'pack-caja-36';

interface ItemPrueba extends Record<string, unknown> {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  deliveredQty?: number;
  sentQty?: number;
  inventoryConsumedQty?: number;
}

describe('OrdersService — conversion a pack', () => {
  let service: OrdersService;
  let orden: Record<string, unknown> & { save: jest.Mock };
  let mockOrderModel: Record<string, jest.Mock>;
  let precioDelCatalogo: Record<string, number>;

  const orderId = '507f1f77bcf86cd799439011';
  const usuario = { id: 'u-1', role: 'admin', name: 'Admin' };

  const docePilsenEntregadas = (): ItemPrueba[] => [
    {
      productId: PILSEN,
      name: 'Cerveza Pilsen Botella',
      quantity: 12,
      unitPrice: 1.2,
      total: 14.4,
      deliveredQty: 12,
      sentQty: 12,
      inventoryConsumedQty: 12,
    },
  ];

  const armarOrden = (items: ItemPrueba[]) => {
    const doc: Record<string, unknown> & { save: jest.Mock } = {
      _id: orderId,
      orderNumber: '200926-0007',
      paymentStatus: 'pending',
      isDeleted: false,
      subtotal: 14.4,
      serviceCharge: 1.44,
      total: 15.84,
      waiterId: 'u-1',
      userId: 'u-1',
      items,
      additionalNotes: [],
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return { ...this };
      },
    };
    return doc;
  };

  beforeEach(async () => {
    precioDelCatalogo = { [TOBO]: 11, [MEDIA_CAJA]: 16, [CAJA]: 34 };
    orden = armarOrden(docePilsenEntregadas());

    mockOrderModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(orden) }),
        exec: () => Promise.resolve(orden),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(orden) }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        configsDePrueba(),
        OrdersService,
        {
          provide: getModelToken('Product'),
          useValue: {
            find: jest.fn().mockImplementation((filtro: unknown) => {
              const ids =
                (filtro as { _id?: { $in?: string[] } })?._id?.$in ?? [];
              const docs = ids
                .filter((id) => precioDelCatalogo[id] !== undefined)
                .map((id) => ({ _id: id, price: precioDelCatalogo[id] }));
              return { lean: () => ({ exec: () => Promise.resolve(docs) }) };
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
          useValue: { record: jest.fn(), recordMany: jest.fn() },
        },
        { provide: PagoMovilService, useValue: {} },
        { provide: ConsumptionService, useValue: {} },
        { provide: AccountsReceivableService, useValue: {} },
        { provide: MovementsService, useValue: { emit: jest.fn() } },
        {
          provide: KitchenNotifierService,
          useValue: { itemsDelivered: jest.fn() },
        },
        {
          provide: SociosExcluidosService,
          useValue: { esExcluido: jest.fn().mockResolvedValue(false) },
        },
        {
          // Packs encendidos y registro de prueba (configs/packs), con los neutros del contrato.
          provide: ConfigsService,
          useValue: {
            obtener: (id: ConfigId) =>
              Promise.resolve(
                id === 'modulos'
                  ? { ...MODULOS_DEFAULT, packsAndBuckets: true }
                  : CONFIG_DEFAULTS[id],
              ),
            obtenerCrudo: () => Promise.resolve(REGISTRO_PACKS_PRUEBA),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  describe('GET de opciones — ofrece y no toca nada', () => {
    it('devuelve el tobo con el precio del catalogo', async () => {
      const { opciones } = await service.getOpcionesDeConversion(orderId);

      const tobo = opciones.find((o) => o.targetPackId === TOBO);
      expect(tobo).toBeDefined();
      expect(tobo?.packPrice).toBe(11);
      expect(tobo?.numPacksPossible).toBe(1);
    });

    it('NO escribe: ni save, ni findOneAndUpdate, ni updateOne', async () => {
      // Un GET que convirtiera seria la obligacion que el dueño rechazo.
      await service.getOpcionesDeConversion(orderId);

      expect(orden.save).not.toHaveBeenCalled();
      expect(mockOrderModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockOrderModel.updateOne).not.toHaveBeenCalled();
    });

    it('si el dueño cambia el precio en la ficha, la opcion lo refleja sin tocar codigo', async () => {
      precioDelCatalogo[TOBO] = 13;

      const { opciones } = await service.getOpcionesDeConversion(orderId);

      expect(opciones.find((o) => o.targetPackId === TOBO)?.packPrice).toBe(13);
    });

    it('un pack sin precio en el catalogo no se ofrece', async () => {
      delete precioDelCatalogo[TOBO];

      const { opciones } = await service.getOpcionesDeConversion(orderId);

      expect(opciones.find((o) => o.targetPackId === TOBO)).toBeUndefined();
    });

    it('consulta el catalogo UNA sola vez', async () => {
      const productModel = (
        service as unknown as { productModel: { find: jest.Mock } }
      ).productModel;

      await service.getOpcionesDeConversion(orderId);

      expect(productModel.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST de conversion — aplica lo que le piden', () => {
    const convertirUnTobo = () =>
      service.convertirPack(
        orderId,
        { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 1 },
        usuario,
      );

    it('deja la linea del pack con el precio del catalogo', async () => {
      precioDelCatalogo[TOBO] = 13;

      await convertirUnTobo();

      const items = orden.items as ItemPrueba[];
      const pack = items.find((i) => i.productId === TOBO);
      expect(pack?.total).toBe(13);
      expect(items.find((i) => i.productId === PILSEN)).toBeUndefined();
    });

    it('guarda items, totales y nota en UN SOLO save', async () => {
      await convertirUnTobo();

      expect(orden.save).toHaveBeenCalledTimes(1);

      // La nota tiene que estar ANTES del save, no en una segunda escritura
      // que pueda quedar huerfana si la primera falla.
      const notas = orden.additionalNotes as Array<Record<string, unknown>>;
      expect(notas).toHaveLength(1);
      expect(notas[0].system).toBe(true);
      expect(String(notas[0].text)).toContain('Tobo de prueba');
      expect(String(notas[0].text)).toContain('ahorro');
    });

    it('recalcula los totales de la orden', async () => {
      await convertirUnTobo();

      // 12 sueltas a $1.20 eran $14.40; el tobo son $11.
      expect(orden.subtotal).toBe(11);
      expect(orden.total).toBe(12.1); // 11 + 10% de servicio
    });

    it('avisa por WebSocket', async () => {
      const gateway = (
        service as unknown as { posGateway: { notifyOrderUpdated: jest.Mock } }
      ).posGateway;

      await convertirUnTobo();

      expect(gateway.notifyOrderUpdated).toHaveBeenCalledTimes(1);
    });

    it('pedir mas packs de los posibles da 400 y no guarda nada', async () => {
      await expect(
        service.convertirPack(
          orderId,
          { sourceProductId: PILSEN, targetPackId: TOBO, packsToConvert: 2 },
          usuario,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(orden.save).not.toHaveBeenCalled();
    });

    it('una conversion que no esta disponible da 400', async () => {
      // La media caja necesita 18 y solo hay 12 entregadas.
      await expect(
        service.convertirPack(
          orderId,
          {
            sourceProductId: PILSEN,
            targetPackId: MEDIA_CAJA,
            packsToConvert: 1,
          },
          usuario,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(orden.save).not.toHaveBeenCalled();
    });

    it('un pack sin precio da 400 en vez de cobrar $0', async () => {
      delete precioDelCatalogo[TOBO];

      await expect(convertirUnTobo()).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(orden.save).not.toHaveBeenCalled();
    });

    it('lo pedido y no entregado sigue en la cuenta', async () => {
      orden = armarOrden([
        {
          productId: PILSEN,
          name: 'Cerveza Pilsen Botella',
          quantity: 12,
          unitPrice: 1.2,
          total: 14.4,
          deliveredQty: 6,
          sentQty: 12,
          inventoryConsumedQty: 6,
        },
        {
          productId: PILSEN,
          name: 'Cerveza Pilsen Botella',
          quantity: 6,
          unitPrice: 1.2,
          total: 7.2,
          deliveredQty: 6,
          sentQty: 6,
          inventoryConsumedQty: 6,
        },
      ]);
      mockOrderModel.findOne.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(orden) }),
        exec: () => Promise.resolve(orden),
      });

      await convertirUnTobo();

      const items = orden.items as ItemPrueba[];
      const sueltas = items.filter((i) => i.productId === PILSEN);
      expect(sueltas.reduce((s, i) => s + Number(i.quantity), 0)).toBe(6);
      expect(items.find((i) => i.productId === TOBO)?.quantity).toBe(12);
    });
  });
});
