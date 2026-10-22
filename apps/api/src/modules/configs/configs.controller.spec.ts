import { NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@odin6/types';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { ConfigsController } from './configs.controller';
import { ConfigsService } from './configs.service';
import { ActualizarConfigDto } from './dto/actualizar-config.dto';

/** Doble del servicio: registra lo pedido y devuelve un sobre fijo. */
const servicioFalso = () => {
  const envelope = {
    id: 'tarifas',
    valor: {},
    configured: true,
    updatedAt: null,
    updatedBy: 'u1',
  };
  return {
    publico: jest.fn(async () => ({
      configured: true,
      negocio: { tradeName: 'Demo Sabor' },
      marca: {},
      tarifas: {},
      operacion: {},
      vocabulario: {},
      modulos: {},
    })),
    obtenerEnvelope: jest.fn(async () => envelope),
    actualizar: jest.fn(async () => envelope),
  };
};

const crear = () => {
  const servicio = servicioFalso();
  const controller = new ConfigsController(
    servicio as unknown as ConfigsService,
  );
  return { controller, servicio };
};

describe('ConfigsController', () => {
  describe('GET /api/config/publico', () => {
    it('devuelve lo público del servicio y nunca nómina', async () => {
      const { controller, servicio } = crear();
      const pub = await controller.publico({ headers: {} });
      expect(servicio.publico).toHaveBeenCalledTimes(1);
      expect(pub).not.toHaveProperty('nomina');
    });
  });

  describe('GET /api/configs/:id', () => {
    it('lee un documento válido del contrato, incluida nómina', async () => {
      const { controller, servicio } = crear();
      await controller.obtener('nomina');
      expect(servicio.obtenerEnvelope).toHaveBeenCalledWith('nomina');
    });

    it('un id fuera del contrato responde 404 sin tocar el servicio', () => {
      const { controller, servicio } = crear();
      expect(() => controller.obtener('margen_minimo')).toThrow(
        NotFoundException,
      );
      expect(servicio.obtenerEnvelope).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/configs/:id', () => {
    it('guarda el parcial y registra como actor al usuario de la sesión', async () => {
      const { controller, servicio } = crear();
      await controller.actualizar(
        'tarifas',
        { valor: { serviceRate: 0.12 } },
        { user: { id: 'admin-7' } },
      );
      expect(servicio.actualizar).toHaveBeenCalledWith(
        'tarifas',
        { serviceRate: 0.12 },
        'admin-7',
      );
    });

    it('sin usuario en la petición el actor queda en null', async () => {
      const { controller, servicio } = crear();
      await controller.actualizar('marca', { valor: {} }, {});
      expect(servicio.actualizar).toHaveBeenCalledWith('marca', {}, null);
    });

    it('un id fuera del contrato responde 404 y no escribe', () => {
      const { controller, servicio } = crear();
      expect(() =>
        controller.actualizar('caja', { valor: {} }, { user: { id: 'u' } }),
      ).toThrow(NotFoundException);
      expect(servicio.actualizar).not.toHaveBeenCalled();
    });
  });

  describe('roles', () => {
    const roles = (metodo: keyof ConfigsController) =>
      Reflect.getMetadata(
        ROLES_KEY,
        ConfigsController.prototype[metodo],
      ) as string[];

    it('lectura: ADMIN y MANAGER', () => {
      expect(roles('obtener')).toEqual([
        UserRoleEnum.ADMIN,
        UserRoleEnum.MANAGER,
      ]);
    });

    it('escritura: solo ADMIN', () => {
      expect(roles('actualizar')).toEqual([UserRoleEnum.ADMIN]);
    });

    it('el público no exige roles', () => {
      expect(roles('publico')).toBeUndefined();
    });
  });
});

describe('ActualizarConfigDto', () => {
  const validar = (cuerpo: unknown) =>
    validate(plainToInstance(ActualizarConfigDto, cuerpo));

  it('acepta un objeto parcial', async () => {
    expect(await validar({ valor: { serviceRate: 0.1 } })).toHaveLength(0);
  });

  it('rechaza valor que no es objeto (número, texto, lista, ausente)', async () => {
    expect((await validar({ valor: 30 })).length).toBeGreaterThan(0);
    expect((await validar({ valor: 'x' })).length).toBeGreaterThan(0);
    expect((await validar({ valor: [1] })).length).toBeGreaterThan(0);
    expect((await validar({})).length).toBeGreaterThan(0);
  });
});
