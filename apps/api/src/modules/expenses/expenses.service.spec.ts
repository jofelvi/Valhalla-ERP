import { Test } from '@nestjs/testing';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { ExpensesService, RegistroParcialError } from './expenses.service';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { WeeklyNote, WeeklyNoteSchema } from './schemas/weekly-note.schema';
import { PurchasesService } from '../inventory/purchases.service';
import { MovementsService } from '../inventory/movements.service';
import { TurnosSociosService } from '../analytics/turnos-socios.service';
import { convertir, fmtMoney, fmtStock } from './money';

const actor = {
  telegramId: 7,
  socio: 'Jonathan',
  userId: 'u1',
  source: 'telegram' as const,
};

const SEMANA_POR_DEFECTO = {
  desde: new Date('2026-09-01T10:00:00.000Z'),
  hasta: new Date('2026-09-08T10:00:00.000Z'),
  socio: 'Orlando',
  estimado: true,
};

describe('ExpensesService', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let service: ExpensesService;
  const purchasesCreate = jest.fn();
  const purchasesGetById = jest.fn();
  const getStockFor = jest.fn();
  const homeWarehouseIdFor = jest.fn();
  const semanaDe = jest.fn();

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Expense.name, schema: ExpenseSchema },
          { name: WeeklyNote.name, schema: WeeklyNoteSchema },
        ]),
      ],
      providers: [
        ExpensesService,
        // La compra de inventario ya tiene su propia bateria; aqui solo importa
        // que se llame primero y que su fallo no deje un gasto huerfano.
        {
          provide: PurchasesService,
          useValue: { create: purchasesCreate, getById: purchasesGetById },
        },
        {
          provide: MovementsService,
          useValue: { getStockFor, homeWarehouseIdFor },
        },
        { provide: TurnosSociosService, useValue: { semanaDe } },
      ],
    }).compile();
    service = module.get(ExpensesService);
    connection = module.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await connection.collection('expenses').deleteMany({});
    await connection.collection('weekly_notes').deleteMany({});
    purchasesCreate.mockReset();
    purchasesGetById.mockReset();
    getStockFor.mockReset();
    homeWarehouseIdFor.mockReset();
    homeWarehouseIdFor.mockResolvedValue(null);
    semanaDe.mockReset();
    semanaDe.mockResolvedValue(SEMANA_POR_DEFECTO);
  });

  it('un gasto general en Bs guarda ambas monedas, la semana y el socio de turno', async () => {
    const { expense, stockAhora } = await service.registrar({
      kind: 'GENERAL',
      category: 'Transporte',
      description: 'Taxi hielo',
      currency: 'BS',
      amount: 1500,
      exchangeRate: 36.5,
      paymentStatus: 'PAID',
      fundsSource: 'PROPIOS',
      invoiceUrls: [],
      date: new Date('2026-09-03T15:00:00.000Z'),
      actor,
    });
    expect(expense.amountBs).toBe(1500);
    expect(expense.amountUsd).toBe(41.1);
    expect(expense.weekStart.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    expect(expense.socioTurno).toBe('Orlando');
    expect(expense.paidBy).toBe('Jonathan');
    expect(expense.paidAt).toBeInstanceOf(Date);
    expect(stockAhora).toEqual([]);
    expect(purchasesCreate).not.toHaveBeenCalled();
  });

  it('insumos: el stock se lee en la casa del producto, donde la compra lo dejo (stock unificado)', async () => {
    // Prueba real Viveluso 18/09/2026: la compra entraba a Cocina y el grupo
    // leia Deposito General -> "Papas en Hilo: 0 g" teniendo 7.476 g.
    purchasesCreate.mockResolvedValue({
      _id: 'P1',
      warehouseId: 'GENERAL',
      items: [
        { productId: 'PAPAS', productName: 'Papas en Hilo', baseUnit: 'GR' },
      ],
    });
    homeWarehouseIdFor.mockResolvedValue('COCINA');
    getStockFor.mockImplementation(async (wh: string) =>
      wh === 'COCINA' ? 7476 : 0,
    );

    const { stockAhora } = await service.registrar({
      kind: 'INSUMOS',
      category: 'Insumos de cocina',
      supplierId: 'S1',
      supplierName: 'Viveluso',
      currency: 'USD',
      amount: 88.5,
      exchangeRate: 36.5,
      lines: [
        {
          productId: 'PAPAS',
          quantity: 15,
          unit: 'kg',
          unitCost: 5.9,
          invoiceText: 'PAPA FRITA PERRO',
        },
      ],
      paymentStatus: 'CREDIT',
      invoiceUrls: [],
      actor,
    });

    expect(getStockFor).toHaveBeenCalledWith('COCINA', 'PAPAS');
    expect(stockAhora).toEqual([
      { productName: 'Papas en Hilo', qty: 7476, baseUnit: 'GR' },
    ]);
  });

  it('insumos: crea la compra PRIMERO y enlaza purchaseId; devuelve el stock actual', async () => {
    purchasesCreate.mockResolvedValue({
      _id: 'P1',
      warehouseId: 'GENERAL',
      items: [
        { productId: 'HARINA', productName: 'Harina PAN', baseUnit: 'GR' },
      ],
    });
    getStockFor.mockResolvedValue(34500);

    const { expense, stockAhora } = await service.registrar({
      kind: 'INSUMOS',
      category: 'Insumos de cocina',
      supplierId: 'S1',
      supplierName: 'Viveluso',
      currency: 'USD',
      amount: 100,
      exchangeRate: 36.5,
      lines: [
        {
          productId: 'HARINA',
          quantity: 20,
          unit: 'und',
          unitCost: 5,
          invoiceText: 'HARINA PAN 1KGX20',
        },
      ],
      paymentStatus: 'CREDIT',
      invoiceUrls: ['https://x/f.jpg'],
      actor,
    });

    expect(purchasesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        placeId: 'S1',
        currency: 'USD',
        invoiceUrls: ['https://x/f.jpg'],
      }),
      'u1',
    );
    expect(purchasesCreate.mock.calls[0][0].bcvRate).toBeUndefined();
    expect(expense.purchaseId).toBe('P1');
    expect(expense.fundsSource).toBeUndefined();
    expect(stockAhora).toEqual([
      { productName: 'Harina PAN', qty: 34500, baseUnit: 'GR' },
    ]);
  });

  it('insumos en Bs manda bcvRate a la compra', async () => {
    purchasesCreate.mockResolvedValue({
      _id: 'P2',
      warehouseId: 'GENERAL',
      items: [],
    });
    await service.registrar({
      kind: 'INSUMOS',
      category: 'Bebidas',
      supplierId: 'S1',
      supplierName: 'Polar',
      currency: 'BS',
      amount: 3650,
      exchangeRate: 36.5,
      lines: [{ productId: 'X', quantity: 1, unit: 'und', unitCost: 3650 }],
      paymentStatus: 'PAID',
      fundsSource: 'EMPRESA',
      invoiceUrls: [],
      actor,
    });
    expect(purchasesCreate.mock.calls[0][0].bcvRate).toBe(36.5);
  });

  it('si la compra falla no queda ningun gasto', async () => {
    purchasesCreate.mockRejectedValue(new Error('Insumo X no encontrado'));
    await expect(
      service.registrar({
        kind: 'INSUMOS',
        category: 'Bebidas',
        supplierId: 'S1',
        supplierName: 'Polar',
        currency: 'USD',
        amount: 10,
        exchangeRate: 36.5,
        lines: [{ productId: 'X', quantity: 1, unit: 'und', unitCost: 10 }],
        paymentStatus: 'PAID',
        fundsSource: 'EMPRESA',
        invoiceUrls: [],
        actor,
      }),
    ).rejects.toThrow('Insumo X no encontrado');
    expect(await connection.collection('expenses').countDocuments()).toBe(0);
  });

  it('si el gasto falla despues de crear la compra, lanza RegistroParcialError con el purchaseId y no duplica la compra', async () => {
    purchasesCreate.mockResolvedValue({
      _id: 'P9',
      warehouseId: 'GENERAL',
      items: [{ productId: 'X', productName: 'Producto X', baseUnit: 'GR' }],
    });
    getStockFor.mockResolvedValue(10);
    // El insert del gasto (o cualquier cosa entre la compra y el) revienta:
    // la compra P9 ya quedo escrita y hay que avisar con su id.
    semanaDe.mockRejectedValueOnce(new Error('Mongo caido'));

    let capturado: unknown;
    try {
      await service.registrar({
        kind: 'INSUMOS',
        category: 'Bebidas',
        supplierId: 'S1',
        supplierName: 'Polar',
        currency: 'USD',
        amount: 10,
        exchangeRate: 36.5,
        lines: [{ productId: 'X', quantity: 1, unit: 'und', unitCost: 10 }],
        paymentStatus: 'PAID',
        fundsSource: 'EMPRESA',
        invoiceUrls: [],
        actor,
      });
    } catch (e: unknown) {
      capturado = e;
    }
    expect(capturado).toBeInstanceOf(RegistroParcialError);
    expect((capturado as RegistroParcialError).purchaseId).toBe('P9');
    expect(purchasesCreate).toHaveBeenCalledTimes(1);
    expect(await connection.collection('expenses').countDocuments()).toBe(0);
  });

  it('reintentar con el purchaseId de un RegistroParcialError no crea otra compra: solo enlaza el gasto', async () => {
    purchasesGetById.mockResolvedValue({
      _id: 'P9',
      warehouseId: 'GENERAL',
      items: [{ productId: 'X', productName: 'Producto X', baseUnit: 'GR' }],
    });
    getStockFor.mockResolvedValue(10);

    const { expense, stockAhora } = await service.registrar({
      kind: 'INSUMOS',
      category: 'Bebidas',
      supplierId: 'S1',
      supplierName: 'Polar',
      currency: 'USD',
      amount: 10,
      exchangeRate: 36.5,
      lines: [{ productId: 'X', quantity: 1, unit: 'und', unitCost: 10 }],
      paymentStatus: 'PAID',
      fundsSource: 'EMPRESA',
      invoiceUrls: [],
      actor,
      purchaseId: 'P9',
    });

    expect(purchasesCreate).not.toHaveBeenCalled();
    expect(purchasesGetById).toHaveBeenCalledWith('P9');
    expect(expense.purchaseId).toBe('P9');
    expect(stockAhora).toEqual([
      { productName: 'Producto X', qty: 10, baseUnit: 'GR' },
    ]);
    expect(await connection.collection('expenses').countDocuments()).toBe(1);
  });

  it('rechaza contado sin origen de fondos e insumos sin proveedor o sin renglones', async () => {
    const base = {
      category: 'Otros',
      currency: 'BS' as const,
      amount: 1,
      exchangeRate: 36.5,
      invoiceUrls: [],
      actor,
    };
    await expect(
      service.registrar({ ...base, kind: 'GENERAL', paymentStatus: 'PAID' }),
    ).rejects.toThrow(/fondos/);
    await expect(
      service.registrar({
        ...base,
        kind: 'INSUMOS',
        paymentStatus: 'CREDIT',
        lines: [{ productId: 'X', quantity: 1, unit: 'und', unitCost: 1 }],
      }),
    ).rejects.toThrow(/proveedor/);
    await expect(
      service.registrar({
        ...base,
        kind: 'INSUMOS',
        paymentStatus: 'CREDIT',
        supplierId: 'S',
        supplierName: 'S',
      }),
    ).rejects.toThrow(/rengl/);
  });

  it('un credito aparece en porPagar y al pagarlo con fondos propios pasa a reembolsos', async () => {
    const { expense } = await service.registrar({
      kind: 'GENERAL',
      category: 'Gas y servicios',
      currency: 'BS',
      amount: 500,
      exchangeRate: 36.5,
      paymentStatus: 'CREDIT',
      invoiceUrls: [],
      actor,
    });
    expect((await service.porPagar()).map((e) => e._id)).toEqual([expense._id]);
    expect(await service.reembolsosPendientes()).toEqual([]);

    const pagado = await service.marcarPagado(expense._id, {
      fundsSource: 'PROPIOS',
      socio: 'Daisy',
    });
    expect(pagado.paymentStatus).toBe('PAID');
    expect(pagado.paidBy).toBe('Daisy');
    expect(await service.porPagar()).toEqual([]);
    expect((await service.reembolsosPendientes()).map((e) => e._id)).toEqual([
      expense._id,
    ]);

    const reembolsado = await service.marcarReembolsado(expense._id, 'Orlando');
    expect(reembolsado.reimbursedBy).toBe('Orlando');
    expect(await service.reembolsosPendientes()).toEqual([]);
  });

  it('listar() filtra por fecha del gasto, no por la semana de negocio', async () => {
    const dentroA = await service.registrar({
      kind: 'GENERAL',
      category: 'Otros',
      currency: 'BS',
      amount: 10,
      exchangeRate: 36.5,
      paymentStatus: 'CREDIT',
      invoiceUrls: [],
      date: new Date('2026-09-02T12:00:00.000Z'),
      actor,
    });
    const dentroB = await service.registrar({
      kind: 'GENERAL',
      category: 'Otros',
      currency: 'BS',
      amount: 20,
      exchangeRate: 36.5,
      paymentStatus: 'CREDIT',
      invoiceUrls: [],
      date: new Date('2026-09-05T12:00:00.000Z'),
      actor,
    });
    await service.registrar({
      kind: 'GENERAL',
      category: 'Otros',
      currency: 'BS',
      amount: 30,
      exchangeRate: 36.5,
      paymentStatus: 'CREDIT',
      invoiceUrls: [],
      date: new Date('2026-09-09T12:00:00.000Z'),
      actor,
    });

    const lista = await service.listar({
      desde: new Date('2026-09-01T10:00:00.000Z'),
      hasta: new Date('2026-09-08T10:00:00.000Z'),
    });
    expect(lista.map((e) => e._id)).toEqual([
      dentroA.expense._id,
      dentroB.expense._id,
    ]);
  });

  it('pagar dos veces o reembolsar algo de Negocio es error', async () => {
    const { expense } = await service.registrar({
      kind: 'GENERAL',
      category: 'Otros',
      currency: 'BS',
      amount: 1,
      exchangeRate: 36.5,
      paymentStatus: 'PAID',
      fundsSource: 'EMPRESA',
      invoiceUrls: [],
      actor,
    });
    await expect(
      service.marcarPagado(expense._id, { fundsSource: 'EMPRESA', socio: 'X' }),
    ).rejects.toThrow(/ya/);
    await expect(service.marcarReembolsado(expense._id, 'X')).rejects.toThrow(
      /propios/,
    );
    await expect(
      service.marcarPagado('nope', { fundsSource: 'EMPRESA', socio: 'X' }),
    ).rejects.toThrow(/no encontrado/);
  });

  it('dos toques simultaneos al mismo pago: solo uno gana, el otro rechaza', async () => {
    const { expense } = await service.registrar({
      kind: 'GENERAL',
      category: 'Otros',
      currency: 'BS',
      amount: 50,
      exchangeRate: 36.5,
      paymentStatus: 'CREDIT',
      invoiceUrls: [],
      actor,
    });

    const resultados = await Promise.allSettled([
      service.marcarPagado(expense._id, {
        fundsSource: 'EMPRESA',
        socio: 'Daisy',
      }),
      service.marcarPagado(expense._id, {
        fundsSource: 'EMPRESA',
        socio: 'Orlando',
      }),
    ]);

    const ganadores = resultados.filter((r) => r.status === 'fulfilled');
    const perdedores = resultados.filter((r) => r.status === 'rejected');
    expect(ganadores).toHaveLength(1);
    expect(perdedores).toHaveLength(1);
    expect((perdedores[0] as PromiseRejectedResult).reason).toMatchObject({
      message: expect.stringMatching(/ya/),
    });
  });

  it('las novedades quedan en la semana de negocio y se listan por rango', async () => {
    const nota = await service.agregarNovedad('Se daño la nevera', actor);
    expect(nota.weekStart.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    // La novedad se fecha con new Date() al crearla (no con el weekStart mockeado),
    // asi que el rango de la consulta tiene que rodear la hora real, no la semana.
    const ahora = Date.now();
    const lista = await service.novedades({
      desde: new Date(ahora - 60_000),
      hasta: new Date(ahora + 60_000),
    });
    expect(lista.map((n) => n.text)).toEqual(['Se daño la nevera']);
  });

  it('pagar un credito con fondos de Negocio no deja paidBy', async () => {
    const { expense } = await service.registrar({
      kind: 'GENERAL',
      category: 'Otros',
      currency: 'BS',
      amount: 200,
      exchangeRate: 36.5,
      paymentStatus: 'CREDIT',
      invoiceUrls: [],
      actor,
    });
    const pagado = await service.marcarPagado(expense._id, {
      fundsSource: 'EMPRESA',
      socio: 'X',
    });
    expect(pagado.fundsSource).toBe('EMPRESA');
    expect(pagado.paidBy).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(pagado, 'paidBy')).toBe(false);
  });
});

describe('money', () => {
  it('convierte en ambos sentidos con 2 decimales', () => {
    expect(convertir(18450, 'BS', 36.5)).toEqual({
      amountBs: 18450,
      amountUsd: 505.48,
    });
    expect(convertir(245, 'USD', 36.5)).toEqual({
      amountBs: 8942.5,
      amountUsd: 245,
    });
  });
  it('formatea al estilo venezolano', () => {
    expect(fmtMoney(18450, 'BS')).toBe('Bs 18.450,00');
    expect(fmtMoney(245.5, 'USD')).toBe('$ 245,50');
  });
  it('muestra el stock en la unidad que se lee', () => {
    expect(fmtStock(34500, 'GR')).toBe('34,5 kg');
    expect(fmtStock(800, 'ML')).toBe('800 ml');
    expect(fmtStock(12, 'UND')).toBe('12 und');
  });
});
