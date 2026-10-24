import { ForbiddenException } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

describe('CustomersController — permisos', () => {
  let controller: CustomersController;
  let service: { findById: jest.Mock };

  beforeEach(() => {
    service = {
      findById: jest.fn().mockResolvedValue({ _id: 'cust-1', name: 'Ana' }),
    };
    controller = new CustomersController(
      service as unknown as CustomersService,
    );
  });

  // El listado completo (findAll) y la busqueda (search/by-member) exponian
  // las 2.943 fichas de clientes a cualquier cuenta autenticada, incluido un
  // CUSTOMER. Se verifica que quedaron con @Roles restringido al staff.
  it('findAll exige ADMIN, MANAGER o CASHIER', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.findAll);
    expect(roles).toEqual(['admin', 'manager', 'cashier']);
  });

  it('search exige staff (incluye WAITER, no CUSTOMER)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.search);
    expect(roles).toEqual(['admin', 'manager', 'cashier', 'waiter']);
    expect(roles).not.toContain('customer');
  });

  it('findByMemberAction exige staff', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.findByMemberAction);
    expect(roles).toEqual(['admin', 'manager', 'cashier', 'waiter']);
  });

  describe('findById — propio perfil o staff', () => {
    it('rechaza sin usuario resuelto, sin depender del interruptor de lecturas', async () => {
      await expect(controller.findById('cust-1', {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.findById).not.toHaveBeenCalled();
    });

    it('exige staff o CUSTOMER en @Roles (sin @Roles, cualquier cuenta pasaba)', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, controller.findById);
      expect(roles).toEqual([
        'admin',
        'manager',
        'cashier',
        'waiter',
        'customer',
      ]);
    });

    it('deja pasar al dueno de la ficha', async () => {
      await expect(
        controller.findById('cust-1', {
          user: { id: 'cust-1', role: 'customer' },
        }),
      ).resolves.toEqual({ _id: 'cust-1', name: 'Ana' });
    });

    it('deja pasar a staff consultando la ficha de otro', async () => {
      await expect(
        controller.findById('cust-1', {
          user: { id: 'waiter-9', role: 'waiter' },
        }),
      ).resolves.toEqual({ _id: 'cust-1', name: 'Ana' });
    });

    it('rechaza a un CUSTOMER consultando la ficha de otro', async () => {
      await expect(
        controller.findById('cust-1', {
          user: { id: 'otro-customer', role: 'customer' },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.findById).not.toHaveBeenCalled();
    });
  });

  describe('create y update — alta solo staff, edicion propia o staff', () => {
    let escritura: { create: jest.Mock; update: jest.Mock };
    let ctrl: CustomersController;

    beforeEach(() => {
      escritura = {
        create: jest.fn().mockResolvedValue({ _id: 'nuevo' }),
        update: jest.fn().mockResolvedValue({ _id: 'cust-1' }),
      };
      ctrl = new CustomersController(escritura as unknown as CustomersService);
    });

    it('create exige staff, sin CUSTOMER', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, ctrl.create);
      expect(roles).toEqual(['admin', 'manager', 'cashier', 'waiter']);
      expect(roles).not.toContain('customer');
    });

    it('update admite CUSTOMER (su propia ficha) y staff', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, ctrl.update);
      expect(roles).toContain('customer');
      expect(roles).toContain('cashier');
    });

    it('update: un CUSTOMER edita SU ficha', async () => {
      await expect(
        ctrl.update('cust-1', {}, { user: { id: 'cust-1', role: 'customer' } }),
      ).resolves.toEqual({ _id: 'cust-1' });
      expect(escritura.update).toHaveBeenCalledTimes(1);
    });

    it('update: un CUSTOMER NO edita la ficha de otro (socio)', async () => {
      await expect(
        ctrl.update(
          'socio-9',
          {},
          { user: { id: 'cust-1', role: 'customer' } },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(escritura.update).not.toHaveBeenCalled();
    });

    it('update: staff edita cualquier ficha', async () => {
      await expect(
        ctrl.update(
          'socio-9',
          {},
          { user: { id: 'cajero-1', role: 'cashier' } },
        ),
      ).resolves.toEqual({ _id: 'cust-1' });
    });

    it('update sin usuario se rechaza', async () => {
      await expect(ctrl.update('cust-1', {}, {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
