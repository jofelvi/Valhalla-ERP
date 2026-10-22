import { ModuloKey, nombreVisible } from '../shared/contrato';
import { useConfigStore } from './configStore';

/**
 * Hooks de configuración. Equivalentes a los de la web: la app no tiene nombre,
 * tarifas ni vocabulario propios; todo sale de `GET /api/config/publico`.
 */

/** Configuración completa (todos los bloques públicos). */
export const useConfig = () => useConfigStore((s) => s.config);

/** Tarifas: monedas, servicio, impuesto y propinas. */
export const useTarifas = () => useConfigStore((s) => s.config.tarifas);

/** Etiquetas visibles ("Mesonero", "Mesa", "Cocina"…). Los enums no cambian. */
export const useVocab = () => useConfigStore((s) => s.config.vocabulario);

/** true si el módulo opcional está encendido. Apagado = se oculta del menú. */
export const useModulo = (clave: ModuloKey): boolean =>
  useConfigStore((s) => s.config.modulos[clave]);

/** Nombre que ve el usuario: marca, luego nombre comercial, luego genérico. */
export const useNombreApp = (): string =>
  useConfigStore((s) => nombreVisible(s.config.marca, s.config.negocio));
