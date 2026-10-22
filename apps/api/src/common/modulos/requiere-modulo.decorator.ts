import { SetMetadata } from '@nestjs/common';
import { ModuloKey } from '@odin6/types';

export const MODULO_KEY = 'modulo';

/**
 * Marca un controlador o una ruta como parte de un módulo opcional (`modulos` del contrato).
 * Con el módulo apagado, `ModuloActivoGuard` responde 404: la ruta no existe para ese negocio.
 */
export const RequiereModulo = (modulo: ModuloKey) =>
  SetMetadata(MODULO_KEY, modulo);
