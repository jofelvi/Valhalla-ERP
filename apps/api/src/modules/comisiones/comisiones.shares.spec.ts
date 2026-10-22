import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ComisionesService } from './comisiones.service';
import { PagoComision } from './schemas/pago-comision.schema';
import { Order } from '../orders/schemas/order.schema';
import { configsDePrueba } from '../orders/configs-de-prueba';

describe('ComisionesService - Waiter Shares', () => {
  let service: ComisionesService;
  let mockPagoComisionModel: Record<string, jest.Mock>;
  let mockOrderModel: Record<string, jest.Mock>;

  const mockOrder = (overrides: Record<string, unknown> = {}) => ({
    _id: 'order-1',
    waiterId: 'waiter-1',
    paymentStatus: 'paid',
    comisionBase: 100,
    tipAmount: 5,
    createdAt: new Date('2026-07-01'),
    comisionPagada: false,
    waiterShares: [],
    save: jest.fn(),
    markModified: jest.fn(),
    toObject: jest.fn(),
    ...overrides,
  });

  const mockPagoComision = (overrides: Record<string, unknown> = {}) => {
    const pago = {
      _id: 'pago-1',
      waiterId: 'waiter-1',
      montoTotal: 0,
      tipTotal: 0,
      orderIds: [],
      fechaPago: new Date(),
      ...overrides,
    };
    return {
      ...pago,
      toObject: jest.fn().mockReturnValue(pago),
    };
  };

  beforeEach(async () => {
    mockPagoComisionModel = {
      // `find` lo usa la guardia anti doble pago (ver comisiones.service.ts):
      // busca un pago identico de los ultimos 60s. Sin pagos previos devuelve
      // vacio y el flujo sigue normal.
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([]) }),
      }),
      create: jest.fn(),
    };

    mockOrderModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        configsDePrueba(),
        ComisionesService,
        {
          provide: getModelToken(PagoComision.name),
          useValue: mockPagoComisionModel,
        },
        {
          provide: getModelToken(Order.name),
          useValue: mockOrderModel,
        },
      ],
    }).compile();

    service = module.get<ComisionesService>(ComisionesService);
  });

  describe('pagarComision - anti doble pago', () => {
    // El 26/04/2026 se crearon CUATRO registros identicos del mismo pago: 11
    // ordenes quedaron con la comision pagada 4 veces ($41,42 de mas). Nadie
    // impedia apretar el boton varias veces.
    it('devuelve el pago que ya existe en vez de crear otro identico', async () => {
      const order = mockOrder({
        _id: 'order-1',
        serviceCharge: 10,
        tipAmount: 5,
      });
      mockOrderModel.find.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue([order]) }),
      });
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(order),
      });

      // Ya hay un pago de hace 5 segundos por las MISMAS ordenes
      const previo = {
        _id: 'pago-previo',
        waiterId: 'waiter-1',
        orderIds: ['order-1'],
        montoTotal: 10,
      };
      mockPagoComisionModel.find.mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([previo]) }),
      });

      const result = await service.pagarComision({
        waiterId: 'waiter-1',
        waiterName: 'Juan',
        orderIds: ['order-1'],
      });

      expect(mockPagoComisionModel.create).not.toHaveBeenCalled();
      expect(result.id).toBe('pago-previo');
    });

    it('si las ordenes son distintas si crea el pago', async () => {
      const order = mockOrder({
        _id: 'order-2',
        serviceCharge: 10,
        tipAmount: 5,
      });
      mockOrderModel.find.mockReturnValue({
        lean: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue([order]) }),
      });
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(order),
      });
      mockPagoComisionModel.find.mockReturnValue({
        lean: () => ({
          exec: () =>
            Promise.resolve([
              { _id: 'otro', waiterId: 'waiter-1', orderIds: ['order-1'] },
            ]),
        }),
      });
      mockPagoComisionModel.create.mockResolvedValue(
        mockPagoComision({ _id: 'pago-nuevo', montoTotal: 10 }),
      );

      await service.pagarComision({
        waiterId: 'waiter-1',
        waiterName: 'Juan',
        orderIds: ['order-2'],
      });

      expect(mockPagoComisionModel.create).toHaveBeenCalled();
    });
  });

  describe('pagarComision - Share-aware', () => {
    it('(f) debe calcular montos correctos para shares 60/40 con serviceCharge=10, tip=5', async () => {
      // Orden con shares 60/40
      const order = mockOrder({
        _id: 'order-1',
        comisionBase: 100,
        tipAmount: 5,
        waiterShares: [
          { waiterId: 'waiter-1', pct: 60, comisionPagada: false },
          { waiterId: 'waiter-2', pct: 40, comisionPagada: false },
        ],
      });

      // Mock: find órdenes por ID
      mockOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([order]),
        }),
      });

      // Mock: crear pago
      const createdPago = mockPagoComision({
        _id: 'pago-1',
        montoTotal: 4.2, // 100 x 7 % (la nomina de la orden) x 60 %
        tipTotal: 3.0, // 5 * 60 / 100
      });
      mockPagoComisionModel.create.mockResolvedValue(createdPago);

      // Mock: findOne para actualizar
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(order),
      });

      const result = await service.pagarComision({
        waiterId: 'waiter-1',
        waiterName: 'Juan',
        orderIds: ['order-1'],
      });

      // Verificar que el payload calculó correctamente para waiter-1 (60%)
      // El monto lo calcula el servicio: se mira lo que se escribio en el pago.
      expect(mockPagoComisionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          montoTotal: 4.2,
          tipTotal: 3,
          commissionRate: 0.07,
          commissionBasis: 'sales',
        }),
      );

      // Verificar que se marcó el share como pagado
      expect(order.waiterShares[0].comisionPagada).toBe(true);
      expect(order.save).toHaveBeenCalled();
    });

    it('(g) pagar share de waiter-1 NO marca comisionPagada global; pagar waiter-2 SÍ la marca', async () => {
      const order = mockOrder({
        _id: 'order-2',
        comisionBase: 100,
        tipAmount: 5,
        waiterShares: [
          { waiterId: 'waiter-1', pct: 60, comisionPagada: false },
          { waiterId: 'waiter-2', pct: 40, comisionPagada: false },
        ],
      });

      // Usar mock que retorna la misma orden cada vez (para mantener estado)
      mockOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([order]),
        }),
      });

      const createdPago1 = mockPagoComision({ _id: 'pago-1' });
      mockPagoComisionModel.create.mockResolvedValueOnce(createdPago1);

      // Primera llamada: pagar waiter-1
      mockOrderModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(order),
      });

      await service.pagarComision({
        waiterId: 'waiter-1',
        waiterName: 'Juan',
        orderIds: ['order-2'],
      });

      // Después de pagar waiter-1, comisionPagada global NO debe estar true
      expect(order.comisionPagada).toBeFalsy();
      expect(order.waiterShares[0].comisionPagada).toBe(true);

      // Segunda llamada: pagar waiter-2
      const createdPago2 = mockPagoComision({ _id: 'pago-2' });
      mockPagoComisionModel.create.mockResolvedValueOnce(createdPago2);

      mockOrderModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(order),
      });

      await service.pagarComision({
        waiterId: 'waiter-2',
        waiterName: 'Pedro',
        orderIds: ['order-2'],
      });

      // Ahora sí debe estar marcada la comisionPagada global
      expect(order.comisionPagada).toBe(true);
      expect(order.waiterShares[1].comisionPagada).toBe(true);
    });

    it('(h) orden SIN shares: la comision es la base x tasa de la orden, y la propina va completa', async () => {
      const order = mockOrder({
        _id: 'order-3',
        comisionBase: 100,
        tipAmount: 5,
        waiterShares: [], // Sin shares
      });

      mockOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([order]),
        }),
      });

      const createdPago = mockPagoComision({
        _id: 'pago-3',
        montoTotal: 7.0, // 100 x 7 %, sin porcentaje de reparto
        tipTotal: 5.0, // Completo
      });
      mockPagoComisionModel.create.mockResolvedValue(createdPago);

      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(order),
      });

      // Mock updateOne para marcar el orden como pagado
      mockOrderModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.pagarComision({
        waiterId: 'waiter-1',
        waiterName: 'Juan',
        orderIds: ['order-3'],
      });

      // Sin shares, debe tomar el monto completo
      expect(mockPagoComisionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ montoTotal: 7, tipTotal: 5 }),
      );
      expect(result.tipTotal).toBe(5.0);

      // Verificar que updateOne fue llamado con los campos correctos
      expect(mockOrderModel.updateOne).toHaveBeenCalledWith(
        { _id: 'order-3' },
        expect.objectContaining({
          $set: expect.objectContaining({
            comisionPagada: true,
          }),
        }),
      );
    });

    it('(i) share ya pagado se excluye de marcación doble (guard)', async () => {
      const order = mockOrder({
        _id: 'order-4',
        comisionBase: 100,
        tipAmount: 5,
        waiterShares: [
          { waiterId: 'waiter-1', pct: 60, comisionPagada: true }, // Ya pagado
          { waiterId: 'waiter-2', pct: 40, comisionPagada: false },
        ],
      });

      mockOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([order]),
        }),
      });

      const createdPago = mockPagoComision({ _id: 'pago-4' });
      mockPagoComisionModel.create.mockResolvedValue(createdPago);

      // Intento pagar nuevamente waiter-1 (ya pagado)
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(order),
      });

      const result = await service.pagarComision({
        waiterId: 'waiter-1',
        waiterName: 'Juan',
        orderIds: ['order-4'],
      });

      // Debe excluir del cálculo y NO re-marcar
      expect(result.montoTotal).toBe(0); // Excluido porque ya está pagado
      expect(result.tipTotal).toBe(0);

      // No debe haber más cambios al guardar
      expect(order.save).not.toHaveBeenCalled();
    });
  });

  describe('findOrdenespendientes - Share-aware', () => {
    it('debe incluir órdenes donde waiter tiene share sin pagar', async () => {
      const pago = mockPagoComision({
        orderIds: ['order-1'],
      });

      mockPagoComisionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([pago]),
        }),
      });

      // Orden adicional donde waiter-1 tiene share sin pagar
      mockOrderModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              _id: 'order-share',
              waiterShares: [
                { waiterId: 'waiter-1', pct: 50, comisionPagada: false },
              ],
            },
          ]),
        }),
      });

      const result = await service.findOrdenespendientes('waiter-1');

      // Solo órdenes con comisión POR pagar: las liquidadas (order-1 viene
      // de un pago ya registrado) NO son pendientes
      expect(result.pendingOrderIds).not.toContain('order-1');
      expect(result.pendingOrderIds).toContain('order-share');
      expect(result.totalCommissions).toBe(1);
    });
  });
});
