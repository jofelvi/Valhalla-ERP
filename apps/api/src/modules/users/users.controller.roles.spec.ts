import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

// Los @Roles quedan como metadata para las rutas que restringen por rol fijo.
// PATCH :id NO usa @Roles: su permiso depende de si el id es el propio, asi que
// se prueba el comportamiento del metodo (runtime), no la metadata — que era
// justo el hueco: metadata en verde no garantizaba que el guard rechazara.
describe('UsersController — permisos', () => {
  it('findAll exige ADMIN o MANAGER', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      UsersController.prototype.findAll,
    );
    expect(roles).toEqual(['admin', 'manager']);
  });

  it('findById y findByEmail exigen ADMIN o MANAGER', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, UsersController.prototype.findById),
    ).toEqual(['admin', 'manager']);
    expect(
      Reflect.getMetadata(ROLES_KEY, UsersController.prototype.findByEmail),
    ).toEqual(['admin', 'manager']);
  });

  it('resetPassword (password) exige ADMIN', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      UsersController.prototype.resetPassword,
    );
    expect(roles).toEqual(['admin']);
  });

  it('softDelete exige ADMIN', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      UsersController.prototype.softDelete,
    );
    expect(roles).toEqual(['admin']);
  });

  describe('update (PATCH :id) — dueño o admin', () => {
    let controller: UsersController;
    let service: { update: jest.Mock };

    beforeEach(() => {
      service = { update: jest.fn().mockResolvedValue({ id: 'u1' }) };
      controller = new UsersController(service as unknown as UsersService);
    });

    it('sin sesion → 401', async () => {
      await expect(
        controller.update('u1', { name: 'x' }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('un no-admin editando OTRO usuario → 403', async () => {
      await expect(
        controller.update(
          'u2',
          { name: 'x' },
          { user: { id: 'u1', role: 'waiter' } },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('un no-admin editando SU propio perfil → pasa, pero sin privilegios', async () => {
      await controller.update(
        'u1',
        { name: 'x', role: 'admin' },
        { user: { id: 'u1', role: 'waiter' } },
      );
      expect(service.update).toHaveBeenCalledWith(
        'u1',
        { name: 'x', role: 'admin' },
        {
          isAdmin: false,
        },
      );
    });

    it('un ADMIN puede editar a cualquiera con privilegios', async () => {
      await controller.update(
        'u2',
        { role: 'manager' },
        { user: { id: 'u1', role: 'admin' } },
      );
      expect(service.update).toHaveBeenCalledWith(
        'u2',
        { role: 'manager' },
        {
          isAdmin: true,
        },
      );
    });
  });
});
