import { NotFoundException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULOS_DEFAULT, ModulosConfig } from '@odin6/types';
import { ConfigsService } from '../../modules/configs/configs.service';
import { ejecutarSiModuloActivo, moduloActivo } from './modulo-activo';
import { ModuloActivoGuard } from './modulo-activo.guard';
import { MODULO_KEY, RequiereModulo } from './requiere-modulo.decorator';

/** Configurador falso: `modulos` con los interruptores que se pidan. */
const configsCon = (cambios: Partial<ModulosConfig> = {}) =>
  ({
    obtener: jest.fn(async () => ({ ...MODULOS_DEFAULT, ...cambios })),
  }) as unknown as Pick<ConfigsService, 'obtener'>;

/** Contexto mínimo de Nest con un handler y una clase, para que el guard lea la marca. */
const contexto = (handler: object, clase: object): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => clase,
  }) as unknown as ExecutionContext;

describe('módulos opcionales', () => {
  describe('moduloActivo', () => {
    it('instalación neutra: todo lo opcional apagado', async () => {
      expect(await moduloActivo(configsCon(), 'partners')).toBe(false);
    });

    it('lee el interruptor del contrato', async () => {
      expect(
        await moduloActivo(configsCon({ partners: true }), 'partners'),
      ).toBe(true);
    });
  });

  describe('ejecutarSiModuloActivo', () => {
    it('apagado: la tarea no corre y devuelve false', async () => {
      const tarea = jest.fn();
      expect(
        await ejecutarSiModuloActivo(configsCon(), 'telegramBot', tarea),
      ).toBe(false);
      expect(tarea).not.toHaveBeenCalled();
    });

    it('encendido: la tarea corre una vez', async () => {
      const tarea = jest.fn();
      const corrio = await ejecutarSiModuloActivo(
        configsCon({ telegramBot: true }),
        'telegramBot',
        tarea,
      );
      expect(corrio).toBe(true);
      expect(tarea).toHaveBeenCalledTimes(1);
    });
  });

  describe('ModuloActivoGuard', () => {
    class Controlador {
      @RequiereModulo('reservations')
      ruta() {
        return 'ok';
      }

      sinMarca() {
        return 'ok';
      }
    }
    @RequiereModulo('partners')
    class ControladorDeClase {}

    const guard = (cfg: Pick<ConfigsService, 'obtener'>) =>
      new ModuloActivoGuard(new Reflector(), cfg as ConfigsService);

    it('la marca queda en la metadata del handler', () => {
      expect(Reflect.getMetadata(MODULO_KEY, Controlador.prototype.ruta)).toBe(
        'reservations',
      );
    });

    it('módulo apagado: 404', async () => {
      const ctx = contexto(Controlador.prototype.ruta, Controlador);
      await expect(guard(configsCon()).canActivate(ctx)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('módulo encendido: pasa', async () => {
      const ctx = contexto(Controlador.prototype.ruta, Controlador);
      await expect(
        guard(configsCon({ reservations: true })).canActivate(ctx),
      ).resolves.toBe(true);
    });

    it('la marca a nivel de clase también cuenta', async () => {
      const ctx = contexto(ControladorDeClase, ControladorDeClase);
      await expect(guard(configsCon()).canActivate(ctx)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('una ruta sin marca no se consulta y pasa', async () => {
      const cfg = configsCon();
      const ctx = contexto(Controlador.prototype.sinMarca, Controlador);
      await expect(guard(cfg).canActivate(ctx)).resolves.toBe(true);
      expect(cfg.obtener).not.toHaveBeenCalled();
    });
  });
});
