import {
  ConfigEnvelope,
  ConfigId,
  ConfigMap,
  ConfigPublica,
} from '@odin6/types';
import { api } from '@/services/api/apiClient';

/** Acceso HTTP al contrato de configuración (docs/contrato-config.md). */

export const CONFIG_QUERY_KEYS = {
  publico: ['config', 'publico'] as const,
  doc: (id: ConfigId) => ['config', id] as const,
};

export const fetchConfigPublica = (): Promise<ConfigPublica> =>
  api.get<ConfigPublica>('/api/config/publico');

export const fetchConfig = <K extends ConfigId>(
  id: K,
): Promise<ConfigEnvelope<K>> =>
  api.get<ConfigEnvelope<K>>(`/api/configs/${id}`);

/** `valor` es parcial: se mezcla sobre lo vigente en el servidor y se normaliza. */
export const patchConfig = <K extends ConfigId>(
  id: K,
  valor: DeepPartial<ConfigMap[K]>,
): Promise<ConfigEnvelope<K>> =>
  api.patch<ConfigEnvelope<K>>(`/api/configs/${id}`, { valor });

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T;
