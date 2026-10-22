/**
 * CONTRATO DE CONFIGURACIÓN — fuente única para API, web, móvil e impresión.
 *
 * Cada documento vive en la colección `configs` de Mongo como
 *   { _id: <ConfigId>, valor: <objeto>, updatedAt, updatedBy }
 * y se lee SIEMPRE a través de `normalizeConfig`, que completa lo que falta con el valor neutro
 * y descarta lo inválido: un documento a medias o corrupto nunca rompe una pantalla.
 *
 * Endpoints (ver docs/contrato-config.md):
 *   GET   /api/config/publico        sin sesión · ConfigPublica
 *   GET   /api/configs/:id           ADMIN/MANAGER · ConfigEnvelope<T>
 *   PATCH /api/configs/:id           ADMIN · body { valor: Partial<T> } · ConfigEnvelope<T>
 */
import { MarcaConfig, MARCA_DEFAULT, normalizeMarca } from './marca';
import { ModulosConfig, MODULOS_DEFAULT, normalizeModulos } from './modulos';
import { NegocioConfig, NEGOCIO_DEFAULT, normalizeNegocio } from './negocio';
import { NominaConfig, NOMINA_DEFAULT, normalizeNomina } from './nomina';
import {
  OperacionConfig,
  OPERACION_DEFAULT,
  normalizeOperacion,
} from './operacion';
import { TarifasConfig, TARIFAS_DEFAULT, normalizeTarifas } from './tarifas';
import {
  VocabularioConfig,
  VOCABULARIO_DEFAULT,
  normalizeVocabulario,
} from './vocabulario';

export * from './marca';
export * from './modulos';
export * from './negocio';
export * from './nomina';
export * from './operacion';
export * from './tarifas';
export * from './vocabulario';

export const CONFIG_IDS = [
  'negocio',
  'marca',
  'tarifas',
  'nomina',
  'operacion',
  'vocabulario',
  'modulos',
] as const;
export type ConfigId = (typeof CONFIG_IDS)[number];

export interface ConfigMap {
  negocio: NegocioConfig;
  marca: MarcaConfig;
  tarifas: TarifasConfig;
  nomina: NominaConfig;
  operacion: OperacionConfig;
  vocabulario: VocabularioConfig;
  modulos: ModulosConfig;
}

export const CONFIG_DEFAULTS: ConfigMap = {
  negocio: NEGOCIO_DEFAULT,
  marca: MARCA_DEFAULT,
  tarifas: TARIFAS_DEFAULT,
  nomina: NOMINA_DEFAULT,
  operacion: OPERACION_DEFAULT,
  vocabulario: VOCABULARIO_DEFAULT,
  modulos: MODULOS_DEFAULT,
};

const NORMALIZADORES: { [K in ConfigId]: (raw: unknown) => ConfigMap[K] } = {
  negocio: normalizeNegocio,
  marca: normalizeMarca,
  tarifas: normalizeTarifas,
  nomina: normalizeNomina,
  operacion: normalizeOperacion,
  vocabulario: normalizeVocabulario,
  modulos: normalizeModulos,
};

export const esConfigId = (id: unknown): id is ConfigId =>
  typeof id === 'string' && (CONFIG_IDS as readonly string[]).includes(id);

export function normalizeConfig<K extends ConfigId>(
  id: K,
  raw: unknown,
): ConfigMap[K] {
  return NORMALIZADORES[id](raw) as ConfigMap[K];
}

/** Respuesta de `GET/PATCH /api/configs/:id`. */
export interface ConfigEnvelope<K extends ConfigId = ConfigId> {
  id: K;
  valor: ConfigMap[K];
  /** false mientras nadie la haya guardado: se están sirviendo los valores neutros. */
  configured: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * Respuesta de `GET /api/config/publico`: todo lo que web, móvil e impresión necesitan antes
 * de iniciar sesión o para calcular una cuenta. NO incluye `nomina`.
 */
export interface ConfigPublica {
  /** true cuando `negocio.tradeName` ya tiene valor (la instalación fue configurada). */
  configured: boolean;
  negocio: NegocioConfig;
  marca: MarcaConfig;
  tarifas: TarifasConfig;
  operacion: OperacionConfig;
  vocabulario: VocabularioConfig;
  modulos: ModulosConfig;
}

export const CONFIG_PUBLICA_DEFAULT: ConfigPublica = {
  configured: false,
  negocio: NEGOCIO_DEFAULT,
  marca: MARCA_DEFAULT,
  tarifas: TARIFAS_DEFAULT,
  operacion: OPERACION_DEFAULT,
  vocabulario: VOCABULARIO_DEFAULT,
  modulos: MODULOS_DEFAULT,
};

/**
 * Mezcla un PATCH parcial sobre el valor vigente (objetos anidados se mezclan; arreglos y
 * valores simples se reemplazan) para que se pueda mandar un solo campo.
 */
export function mergeConfig(vigente: unknown, cambios: unknown): unknown {
  const esObj = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!esObj(vigente) || !esObj(cambios)) return cambios ?? vigente;
  const out: Record<string, unknown> = { ...vigente };
  for (const [k, v] of Object.entries(cambios)) {
    out[k] = esObj(v) && esObj(vigente[k]) ? mergeConfig(vigente[k], v) : v;
  }
  return out;
}
