import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuloKey } from '@odin6/types';
import { ConfigsService } from '../../modules/configs/configs.service';
import { MODULO_KEY } from './requiere-modulo.decorator';
import { moduloActivo } from './modulo-activo';

/**
 * Responde 404 si el módulo marcado con `@RequiereModulo` está apagado. Sin marca, deja pasar.
 * Va después de la autenticación: un módulo apagado no revela nada, ni siquiera que existe.
 */
@Injectable()
export class ModuloActivoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configs: ConfigsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const modulo = this.reflector.getAllAndOverride<ModuloKey | undefined>(
      MODULO_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!modulo) return true;
    if (await moduloActivo(this.configs, modulo)) return true;
    throw new NotFoundException();
  }
}
