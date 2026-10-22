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
    it('deja pasar sin usuario resuelto (transicion, igual que RolesGuard)', async () => {
      await expect(controller.findById('cust-1', {})).resolves.toEqual({
        _id: 'cust-1',
        name: 'Ana',
      });
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
});
