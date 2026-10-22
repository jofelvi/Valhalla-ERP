import { ModuloKey } from '@odin6/types';
import { ConfigsService } from '../../modules/configs/configs.service';

/** Lector mínimo de `modulos`: el guard y las tareas programadas solo necesitan esto. */
type LectorDeModulos = Pick<ConfigsService, 'obtener'>;

/** true si el interruptor del módulo está encendido en la configuración del negocio. */
export async function moduloActivo(
  configs: LectorDeModulos,
  modulo: ModuloKey,
): Promise<boolean> {
  const modulos = await configs.obtener('modulos');
  return modulos[modulo] === true;
}

/**
 * Ejecuta `tarea` solo si el módulo está encendido. Para cron y temporizadores: un módulo
 * apagado no hace nada, ni siquiera consultar sus fuentes externas.
 */
export async function ejecutarSiModuloActivo(
  configs: LectorDeModulos,
  modulo: ModuloKey,
  tarea: () => Promise<void> | void,
): Promise<boolean> {
  if (!(await moduloActivo(configs, modulo))) return false;
  await tarea();
  return true;
}
