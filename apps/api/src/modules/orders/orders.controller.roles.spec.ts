import { ForbiddenException } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

const STAFF = [
  'admin',
  'manager',
  'cashier',
  'waiter',
  'kitchen',
  'bar',
  'pizza',
];
const CAJA = ['admin', 'manager', 'cashier', 'waiter'];

function rolesDe(handler: unknown): string[] {
  return Reflect.getMetadata(ROLES_KEY, handler as object) as string[];
}

describe('OrdersController — permisos por rol', () => {
  let controller: OrdersController;
  let service: { findById: jest.Mock; findAll: jest.Mock };

  beforeEach(() => {
    service = {
      findById: jest.fn(),
      findAll: jest.fn(),
    };
    controller = new OrdersController(service as unknown as OrdersService);
  });

  it('toda ruta HTTP del controller declara @Roles (sin @Roles cualquier cuenta pasaba)', () => {
    const proto = OrdersController.prototype as unknown as Record<
      string,
      unknown
    >;
    const rutasSinRoles = Object.getOwnPropertyNames(proto).filter((nombre) => {
      const fn = proto[nombre];
      if (typeof fn !== 'function' || nombre === 'constructor') return false;
      // Solo los handlers HTTP (los que tienen metadata de ruta).
      if (!Reflect.hasMetadata('path', fn)) return false;
      return !Reflect.hasMetadata(ROLES_KEY, fn);
    });
    expect(rutasSinRoles).toEqual([]);
  });

  it('descartar-sin-cobrar es de caja (no cliente, no cocina/barra/pizza)', () => {
    const roles = rolesDe(controller.descartarSinCobrar);
    expect(roles).toEqual(CAJA);
    expect(roles).not.toContain('customer');
    expect(roles).not.toContain('kitchen');
  });

  it('PATCH :id (update generico) es de caja, no cliente', () => {
    const roles = rolesDe(controller.update);
    expect(roles).toEqual(CAJA);
    expect(roles).not.toContain('customer');
  });

  it('el cobro y los descuentos son de caja', () => {
    expect(rolesDe(controller.fullCourtesy)).toEqual(CAJA);
    expect(rolesDe(controller.cancelOrder)).toEqual(CAJA);
    expect(rolesDe(controller.mergeOrders)).toEqual(CAJA);
  });

  it('aprobar y rechazar credito es de cobro (admin, manager, cashier)', () => {
    expect(rolesDe(controller.approveCreditRequest)).toEqual([
      'admin',
      'manager',
      'cashier',
    ]);
    expect(rolesDe(controller.rejectCreditRequest)).toEqual([
      'admin',
      'manager',
      'cashier',
    ]);
  });

  it('entregar item es de todo el personal, sin cliente', () => {
    const roles = rolesDe(controller.deliverItem);
    expect(roles).toEqual(STAFF);
    expect(roles).not.toContain('customer');
  });

  it('crear orden admite CUSTOMER (carrito de la app) y personal', () => {
    const roles = rolesDe(controller.create);
    expect(roles).toEqual([...STAFF, 'customer']);
  });

  it('link del QR, pedir cuenta y solicitud del cliente son solo CUSTOMER', () => {
    expect(rolesDe(controller.linkCustomer)).toEqual(['customer']);
    expect(rolesDe(controller.createCustomerRequest)).toEqual(['customer']);
    expect(rolesDe(controller.requestBill)).toEqual(['customer']);
  });

  it('resolver solicitud del cliente es de personal', () => {
    expect(rolesDe(controller.resolveCustomerRequest)).toEqual(STAFF);
  });

  describe('GET :id — la orden propia del cliente, o personal', () => {
    const ordenDeCliente = { _id: 'o-1', customerId: 'cust-1' };

    it('el cliente vinculado lee SU orden', async () => {
      service.findById.mockResolvedValue(ordenDeCliente);
      await expect(
        controller.findById('o-1', {
          user: { id: 'cust-1', role: 'customer' },
        }),
      ).resolves.toEqual(ordenDeCliente);
    });

    it('el cliente NO lee la orden de otro cliente', async () => {
      service.findById.mockResolvedValue(ordenDeCliente);
      await expect(
        controller.findById('o-1', {
          user: { id: 'otro-cliente', role: 'customer' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('el personal lee cualquier orden', async () => {
      service.findById.mockResolvedValue(ordenDeCliente);
      await expect(
        controller.findById('o-1', { user: { id: 'mes-1', role: 'waiter' } }),
      ).resolves.toEqual(ordenDeCliente);
    });

    it('sin sesion no se lee nada', async () => {
      service.findById.mockResolvedValue(ordenDeCliente);
      await expect(controller.findById('o-1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('GET :id admite CUSTOMER y personal en @Roles', () => {
      expect(rolesDe(controller.findById)).toEqual([...STAFF, 'customer']);
    });
  });

  describe('GET / — el cliente solo lista sus ordenes', () => {
    const ordenes = [
      { _id: 'o-1', customerId: 'cust-1' },
      { _id: 'o-2', customerId: 'otro-cliente' },
    ];

    // findAll tiene 15 query params antes de la sesion (ver la firma).
    const listar = (req: unknown) =>
      controller.findAll(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        req as never,
      );

    it('el cliente solo recibe las suyas aunque pida el restaurante entero', async () => {
      service.findAll.mockResolvedValue(ordenes);
      const res = await listar({ user: { id: 'cust-1', role: 'customer' } });
      expect(res).toEqual([{ _id: 'o-1', customerId: 'cust-1' }]);
    });

    it('el personal recibe la lista completa sin filtrar', async () => {
      service.findAll.mockResolvedValue(ordenes);
      const res = await listar({ user: { id: 'cajero', role: 'cashier' } });
      expect(res).toEqual(ordenes);
    });

    it('sin sesion se rechaza', async () => {
      service.findAll.mockResolvedValue(ordenes);
      await expect(listar({})).rejects.toThrow(ForbiddenException);
      expect(service.findAll).not.toHaveBeenCalled();
    });

    it('GET / admite CUSTOMER y personal en @Roles', () => {
      expect(rolesDe(controller.findAll)).toEqual([...STAFF, 'customer']);
    });
  });
});
