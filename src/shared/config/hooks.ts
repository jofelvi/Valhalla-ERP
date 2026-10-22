'use client';

import {
  CONFIG_PUBLICA_DEFAULT,
  ConfigId,
  ConfigMap,
  ConfigPublica,
  ModuloKey,
  VocabKey,
  nombreVisible,
} from '@odin6/types';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  CONFIG_QUERY_KEYS,
  DeepPartial,
  fetchConfig,
  fetchConfigPublica,
  patchConfig,
} from './configService';

/**
 * Configuración pública (sin sesión). Mientras carga o si la API no responde sirve los
 * valores neutros, así que NUNCA es undefined: ninguna pantalla tiene que preguntar por ello.
 */
export function useConfig(): ConfigPublica & { isLoading: boolean } {
  const q = useQuery({
    queryKey: CONFIG_QUERY_KEYS.publico,
    queryFn: fetchConfigPublica,
    staleTime: 5 * 60 * 1000,
    placeholderData: CONFIG_PUBLICA_DEFAULT,
  });
  return { ...(q.data ?? CONFIG_PUBLICA_DEFAULT), isLoading: q.isPending };
}

export const useNegocio = () => useConfig().negocio;
export const useMarca = () => useConfig().marca;
export const useTarifas = () => useConfig().tarifas;
export const useOperacion = () => useConfig().operacion;

/** Nombre de la app / del negocio a mostrar: marca → negocio → "Punto de venta". */
export function useNombreApp(): string {
  const { marca, negocio } = useConfig();
  return nombreVisible(marca, negocio);
}

/** `const t = useVocab(); t('waiter')` → "Mesonero" (o lo que haya configurado el cliente). */
export function useVocab(): (key: VocabKey) => string {
  const { vocabulario } = useConfig();
  return useCallback((key: VocabKey) => vocabulario[key], [vocabulario]);
}

/** ¿Está encendido este módulo opcional? */
export function useModulo(key: ModuloKey): boolean {
  return useConfig().modulos[key];
}

/** Lectura de un documento completo (requiere sesión; `nomina` solo ADMIN/MANAGER). */
export function useConfigDoc<K extends ConfigId>(
  id: K,
): UseQueryResult<{ valor: ConfigMap[K]; configured: boolean }> {
  return useQuery({
    queryKey: CONFIG_QUERY_KEYS.doc(id),
    queryFn: () => fetchConfig(id),
    staleTime: 60 * 1000,
  });
}

/** Guarda un cambio parcial y refresca la configuración pública y el documento. */
export function useGuardarConfig<K extends ConfigId>(id: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (valor: DeepPartial<ConfigMap[K]>) => patchConfig(id, valor),
    onSuccess: () => {
      // El servidor de Next guarda 60 s la config pública (título, manifest, tema): se invalida
      // ya para que recargar muestre lo recién guardado.
      void fetch('/api/revalidar-config', { method: 'POST' }).catch(() => {});
      void qc.invalidateQueries({ queryKey: CONFIG_QUERY_KEYS.publico });
      void qc.invalidateQueries({ queryKey: CONFIG_QUERY_KEYS.doc(id) });
    },
  });
}
