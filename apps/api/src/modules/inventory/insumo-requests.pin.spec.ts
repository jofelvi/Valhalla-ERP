import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { InsumoRequestsController } from './insumo-requests.controller';
import { InsumoRequestsService } from './insumo-requests.service';
import { AuthService } from '../auth/auth.service';

/**
 * El PIN permite que un jefe autorice la reposicion en el telefono de la
 * estacion. Lo que se prueba aca es que eso NO se convierta en un agujero:
 * el traslado tiene que quedar a nombre del dueño del PIN, y un PIN malo no
 * puede mover ni un gramo de inventario.
 */
describe('InsumoRequestsController — autorizacion por PIN', () => {
  const approve = jest.fn();
  const verifyAdminPin = jest.fn();
  let controller: InsumoRequestsController;

  const reqDeBarra = {
    user: { id: 'u-barra', sub: 'u-barra', name: 'Jose (barra)', role: 'bar' },
  };

  beforeEach(async () => {
    approve.mockReset().mockResolvedValue({ status: 'APPROVED' });
    verifyAdminPin.mockReset();

    const module = await Test.createTestingModule({
      controllers: [InsumoRequestsController],
      providers: [
        { provide: InsumoRequestsService, useValue: { approve } },
        { provide: AuthService, useValue: { verifyAdminPin } },
      ],
    }).compile();

    controller = module.get(InsumoRequestsController);
  });

  it('sin PIN autoriza el dueño del token, como siempre', async () => {
    await controller.approve('req-1', {}, reqDeBarra);

    expect(verifyAdminPin).not.toHaveBeenCalled();
    expect(approve).toHaveBeenCalledWith('req-1', {
      id: 'u-barra',
      name: 'Jose (barra)',
      role: 'bar',
    });
  });

  it('con PIN valido el traslado queda a nombre del JEFE, no del telefono', async () => {
    verifyAdminPin.mockResolvedValue({
      valid: true,
      adminId: 'u-jefe',
      adminName: 'Jonathan',
      adminRole: 'admin',
    });

    await controller.approve('req-1', { pin: '4321' }, reqDeBarra);

    expect(approve).toHaveBeenCalledWith('req-1', {
      id: 'u-jefe',
      name: 'Jonathan',
      role: 'admin',
    });
  });

  it('con PIN invalido rechaza y NO toca el inventario', async () => {
    verifyAdminPin.mockResolvedValue({
      valid: false,
      adminId: null,
      adminName: null,
    });

    await expect(
      controller.approve('req-1', { pin: '0000' }, reqDeBarra),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(approve).not.toHaveBeenCalled();
  });

  it('un PIN en blanco no cuenta como PIN: cae al rol del token', async () => {
    // Sin esto, mandar pin:"" desde la app saltaria la verificacion y dejaria
    // que el propio solicitante se autorice.
    await controller.approve('req-1', { pin: '   ' }, reqDeBarra);

    expect(verifyAdminPin).not.toHaveBeenCalled();
    expect(approve).toHaveBeenCalledWith(
      'req-1',
      expect.objectContaining({ role: 'bar' }),
    );
  });
});
