import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PrintQueueService } from './print-queue.service';
import { PrintJob, PrintJobType } from './schemas/print-job.schema';
import { PrintGateway } from '../websockets/gateways/print.gateway';
import { Product } from '../products/schemas/product.schema';
import { PrintAlertsService } from './print-alerts.service';
import { OrdersService } from '../orders/orders.service';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { signFichaToken } from '../orders/ficha-token.util';
import { ConfigsService } from '../configs/configs.service';
import { CONFIG_DEFAULTS, ConfigId, MODULOS_DEFAULT } from '@odin6/types';

/**
 * El ticket repetido de la barra (reportado el 28/08/2026).
 *
 * El mesonero comanda un refresco: sale la ficha de BARRA con el refresco.
 * Minutos despues agrega una hamburguesa a la MISMA orden. Como el refresco
 * todavia no se entrego, la reposicion de ficha volvia a emitir el ticket de
 * BARRA con ese mismo refresco — la barra terminaba con dos papeles para una
 * sola bebida.
 *
 * El QR es de la ORDEN, no del ticket: la ficha que la barra ya tiene sigue
 * mostrando todo lo pendiente al escanearla, asi que no hace falta reimprimirle
 * nada cuando lo nuevo es de otra estacion.
 */
describe('PrintQueueService - ficha repetida al agregar items', () => {
  let service: PrintQueueService;
  let creados: Record<string, unknown>[];

  const ORDER_ID = 'orden-1';

  // La orden tiene el refresco de barra SIN entregar y la hamburguesa recien
  // comandada: es lo que devuelve la vista de ficha en el momento del bug.
  const fichaConAmbos = {
    orderId: ORDER_ID,
    orderNumber: 'A1B2C3D4',
    tableName: 'Mesa 5',
    sector: null,
    waiterName: 'Ana',
    fichaToken: 'AR1.orden-1.abcd.firma',
    items: [
      {
        itemId: 'i1',
        productId: 'p-refresco',
        productName: 'Pepsi',
        station: 'BAR',
        quantity: 1,
        deliveredQty: 0,
        pendingQty: 1,
      },
      {
        itemId: 'i2',
        productId: 'p-burger',
        productName: 'Hamburguesa',
        station: 'KITCHEN',
        quantity: 1,
        deliveredQty: 0,
        pendingQty: 1,
      },
      {
        itemId: 'i3',
        productId: 'p-pizza',
        productName: 'Pizza Grande',
        station: 'PIZZA',
        quantity: 1,
        deliveredQty: 0,
        pendingQty: 1,
      },
    ],
  };

  beforeEach(async () => {
    creados = [];
    const create = jest.fn((dto: Record<string, unknown>) => {
      creados.push(dto);
      return Promise.resolve({
        toObject: () => ({ ...dto, _id: 'job-' + creados.length }),
      });
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrintQueueService,
        {
          // Configuración neutra del contrato: el ticket se completa con defaults.
          provide: ConfigsService,
          useValue: {
            obtener: (id: ConfigId) =>
              Promise.resolve(
                id === 'modulos'
                  ? { ...MODULOS_DEFAULT, barTokens: true }
                  : CONFIG_DEFAULTS[id],
              ),
          },
        },
        {
          provide: getModelToken(PrintJob.name),
          useValue: {
            create,
            // Upsert atomico: si ya hay una ficha de esa orden+estacion la
            // devuelve (y el servicio no duplica); si no, la inserta.
            // Respaldo en base: devuelve la ficha ya creada para esa orden+estacion.
            findOne: (filtro: Record<string, unknown>) => ({
              lean: () => ({
                exec: () =>
                  Promise.resolve(
                    creados.find(
                      (c) =>
                        c.type === filtro.type &&
                        c.orderId === filtro.orderId &&
                        c.station === filtro.station,
                    ) ?? null,
                  ),
              }),
            }),
            find: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
            updateMany: () => ({ exec: () => Promise.resolve({}) }),
          },
        },
        {
          // El servicio traduce los ingredientes quitados (ids) a nombre para
          // que la comanda no diga "SIN prod-botella-a". Sin catalogo
          // en las pruebas, devuelve vacio y se imprime lo que vino.
          provide: getModelToken(Product.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              lean: () => ({ exec: () => Promise.resolve([]) }),
            }),
          },
        },
        {
          provide: PrintGateway,
          useValue: { emitNewJob: jest.fn(), emitStatusChanged: jest.fn() },
        },
        {
          provide: PrintAlertsService,
          useValue: { notifyIncident: jest.fn(), notifyFailure: jest.fn() },
        },
        {
          provide: OrdersService,
          useValue: {
            getFichaByOrderId: jest.fn().mockResolvedValue(fichaConAmbos),
            findRecentOrderIdBySuffix: jest.fn().mockResolvedValue(ORDER_ID),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(PrintQueueService);
  });

  const comandaDe = (station: string, nombre: string): CreatePrintJobDto =>
    ({
      type: PrintJobType.COMANDA,
      orderId: ORDER_ID,
      payload: {
        orderNumber: 'A1B2C3D4',
        items: [{ name: nombre, quantity: 1, station }],
      },
    }) as unknown as CreatePrintJobDto;

  const fichasCreadas = () =>
    creados
      .filter((c) => c.type === PrintJobType.FICHA)
      .map((c) => String(c.station));

  it('comandar la hamburguesa NO le reimprime el refresco a la barra', async () => {
    await service.create(comandaDe('KITCHEN', 'Hamburguesa'));
    // deja correr la reposicion, que va en segundo plano
    await new Promise((r) => setTimeout(r, 10));

    expect(fichasCreadas()).toEqual(['KITCHEN']);
    expect(fichasCreadas()).not.toContain('BAR');
    expect(fichasCreadas()).not.toContain('PIZZA');
  });

  // La regla es transversal: vale igual para barra, cocina y pizza.
  it('comandar una pizza solo le imprime a pizza', async () => {
    await service.create(comandaDe('PIZZA', 'Pizza Grande'));
    await new Promise((r) => setTimeout(r, 10));

    expect(fichasCreadas()).toEqual(['PIZZA']);
  });

  it('comandar en barra no le reimprime nada a cocina ni a pizza', async () => {
    await service.create(comandaDe('BAR', 'Pepsi'));
    await new Promise((r) => setTimeout(r, 10));

    expect(fichasCreadas()).not.toContain('KITCHEN');
    expect(fichasCreadas()).not.toContain('PIZZA');
  });

  it('si lo nuevo es de barra, la barra si recibe su ficha', async () => {
    await service.create(comandaDe('BAR', 'Pepsi'));
    await new Promise((r) => setTimeout(r, 10));

    expect(fichasCreadas()).toEqual(['BAR']);
  });

  it('una comanda con las dos estaciones imprime las dos fichas', async () => {
    const dto = comandaDe('BAR', 'Pepsi');
    (dto.payload as Record<string, unknown>).items = [
      { name: 'Pepsi', quantity: 1, station: 'BAR' },
      { name: 'Hamburguesa', quantity: 1, station: 'KITCHEN' },
    ];
    await service.create(dto);
    await new Promise((r) => setTimeout(r, 10));

    expect(fichasCreadas().sort()).toEqual(['BAR', 'KITCHEN']);
    // pizza no entra: no se comando nada suyo
    expect(fichasCreadas()).not.toContain('PIZZA');
  });

  // El caso real del 28/08: la app encola SU ficha y el servidor repone otra
  // por la comanda, en el mismo segundo. Antes los dos consultaban el
  // antiduplicado antes de que el otro escribiera y la barra recibia el papel
  // repetido — se vieron seis fichas identicas de una misma orden.
  it('la ficha del cliente y la que repone el servidor no se duplican', async () => {
    // Token FIRMADO: con uno invalido el servicio no parte la ficha por
    // estacion y la prueba no tocaria el camino que interesa.
    const token = signFichaToken(
      ORDER_ID,
      'abcd1234',
      'dev-ficha-secret-change-me',
    );
    const fichaDelCliente = {
      type: PrintJobType.FICHA,
      orderId: ORDER_ID,
      payload: { orderNumber: 'A1B2C3D4', qrData: token },
    } as unknown as CreatePrintJobDto;

    await Promise.all([
      service.create(comandaDe('BAR', 'Pepsi')),
      service.create(fichaDelCliente),
    ]);
    await new Promise((r) => setTimeout(r, 80));

    const deBarra = fichasCreadas().filter((e) => e === 'BAR');
    expect(deBarra).toHaveLength(1);
  });

  // Lo que motivo el cambio: el mesonero agrega una bebida a una mesa que ya
  // tenia otra sin entregar. La barra debe recibir SOLO la nueva, no un papel
  // con las dos que parezca un pedido distinto.
  it('el ticket trae solo lo recien comandado, no lo que ya estaba pendiente', async () => {
    const dto = comandaDe('BAR', 'Pepsi');
    await service.create(dto);
    await new Promise((r) => setTimeout(r, 40));

    const fichaBar = creados.find(
      (c) => c.type === PrintJobType.FICHA && c.station === 'BAR',
    );
    const items = ((fichaBar?.payload as Record<string, unknown>)?.items ??
      []) as Array<{
      productName: string;
    }>;
    expect(items.map((i) => i.productName)).toEqual(['Pepsi']);
  });

  // Red de seguridad: si el nombre no coincide con nada de la ficha (cambio de
  // producto, texto raro), la estacion recibe su lista completa en vez de
  // quedarse sin papel.
  it('si el nombre no coincide, la estacion recibe todo lo suyo', async () => {
    const dto = comandaDe('BAR', 'Nombre Que No Existe');
    await service.create(dto);
    await new Promise((r) => setTimeout(r, 40));

    const fichaBar = creados.find(
      (c) => c.type === PrintJobType.FICHA && c.station === 'BAR',
    );
    const items = ((fichaBar?.payload as Record<string, unknown>)?.items ??
      []) as Array<{
      productName: string;
    }>;
    expect(items.length).toBeGreaterThan(0);
  });
});
