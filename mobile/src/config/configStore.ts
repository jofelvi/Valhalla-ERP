import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { CONFIG_PUBLICA_DEFAULT, ConfigPublica } from '../shared/contrato';
import { API_URL } from './env';
import {
  CLAVE_CACHE_CONFIG,
  esRespuestaValida,
  leerCacheConfig,
  normalizarConfigPublica,
} from './configPublica';

/** De dónde salió la configuración que se está usando. */
export type OrigenConfig = 'defecto' | 'cache' | 'servidor';

interface ConfigState {
  config: ConfigPublica;
  origen: OrigenConfig;
  aplicar: (config: ConfigPublica, origen: OrigenConfig) => void;
}

/**
 * Configuración del negocio en memoria. Arranca con los valores neutros; luego
 * `precargarConfig` la sustituye por la caché o por la del servidor.
 */
export const useConfigStore = create<ConfigState>()((set) => ({
  config: CONFIG_PUBLICA_DEFAULT,
  origen: 'defecto',
  aplicar: (config, origen) => set({ config, origen }),
}));

/** Configuración actual fuera de React (estilos que se calculan al cargar el módulo). */
export const configActual = (): ConfigPublica =>
  useConfigStore.getState().config;

/** Carga la última configuración guardada. Nunca lanza: sin caché quedan los neutros. */
export async function cargarCacheConfig(): Promise<void> {
  try {
    const texto = await AsyncStorage.getItem(CLAVE_CACHE_CONFIG);
    const cache = leerCacheConfig(texto);
    if (cache) useConfigStore.getState().aplicar(cache, 'cache');
  } catch {
    // Almacenamiento bloqueado o corrupto: se sigue con los valores neutros.
  }
}

/**
 * Pide `GET /api/config/publico` sin sesión, con tope de tiempo. Si la respuesta es
 * válida, la aplica y la guarda como caché. Devuelve false si no hubo cambio.
 */
export async function refrescarConfig(timeoutMs = 5000): Promise<boolean> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}/api/config/publico`, {
      signal: control.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const raw: unknown = await res.json();
    if (!esRespuestaValida(raw)) return false;
    const config = normalizarConfigPublica(raw);
    useConfigStore.getState().aplicar(config, 'servidor');
    try {
      await AsyncStorage.setItem(CLAVE_CACHE_CONFIG, JSON.stringify(config));
    } catch {
      // Sin caché la app igual funciona: la próxima vez se pedirá de nuevo.
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Arranque: primero la caché (instantánea, sin red), luego el servidor con tope.
 * Nunca lanza: un fallo deja la última configuración conocida o la neutra.
 */
export async function precargarConfig(timeoutMs = 4000): Promise<void> {
  await cargarCacheConfig();
  await refrescarConfig(timeoutMs);
}
