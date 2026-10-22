import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const CACHE_STORAGE_KEY = 'pos:react-query-cache-v1';

/**
 * Hook para ejecutar logout limpio: resetea sesión, caché local y Service Worker.
 *
 * Llama esto ANTES de hacer signOut() en NextAuth o similar.
 * Asegura que no quedan datos sensibles del usuario anterior.
 *
 * Flujo:
 * 1. Invalida TODAS las queries de React Query
 * 2. Elimina el localStorage del QueryCache
 * 3. Limpia TODOS los caches del Service Worker
 * 4. Retorna para que el caller haga signOut() o redirectUser()
 *
 * Ejemplo:
 * ```tsx
 * const handleLogout = useLogout();
 *
 * async function logout() {
 *   await handleLogout();
 *   await signOut({ redirect: true });
 * }
 * ```
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      console.debug('[Logout] Iniciando limpieza de sesión...');

      // 1. Invalidar TODAS las queries en memoria
      queryClient.clear();
      console.debug('[Logout] Queries de React Query invalidadas');

      // 2. Eliminar localStorage del QueryCache
      try {
        localStorage.removeItem(CACHE_STORAGE_KEY);
        console.debug('[Logout] localStorage del QueryCache eliminado');
      } catch (error) {
        console.warn('[Logout] Error al eliminar localStorage:', error);
      }

      // 3. Limpiar todos los caches del Service Worker
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          console.debug(`[Logout] Caché eliminada: ${cacheName}`);
        }
      }

      console.info('[Logout] Limpieza completada. Seguro de sesión.');
    } catch (error) {
      console.error('[Logout] Error durante limpieza:', error);
      // No lanzar el error: el logout debe completarse incluso si algo falla
    }
  }, [queryClient]);
}
