'use client';

import { useEffect } from 'react';

/**
 * Registra el Service Worker en el navegador.
 *
 * El SW cachea estáticos (_next/static, manifest, iconos) con cache-first
 * y HTML/API con network-first. Invalida caches viejos cuando el buildId cambia
 * (lo que ocurre en cada deploy).
 *
 * Este componente:
 * 1. Registra el SW en /public/sw.js
 * 2. Envía el buildId actual al SW para que lo use en el cacheName
 * 3. Logea advertencias si el registro falla
 *
 * Colocado en <Providers> para que corra una vez por sesión.
 */
export function SwRegisterer() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // En desarrollo los chunks no llevan hash estable: un SW con cache-first
    // dejaria codigo viejo pegado mientras se edita.
    if (process.env.NODE_ENV !== 'production') return;

    // Verificar soporte
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service Workers no soportados en este navegador');
      return;
    }

    async function registerSw() {
      try {
        // Registrar el SW
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // Siempre chequear la versión del SW
        });

        // Obtener el buildId actual (inyectado por next.config.ts)
        const buildId = process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown';

        console.debug(`[SW] Registrado correctamente. buildId=${buildId}`);

        // Enviar buildId al SW. Se ejecuta una sola vez en la instalación.
        if (registration.active) {
          registration.active.postMessage({
            type: 'SET_BUILD_ID',
            buildId,
          });
        } else if (registration.installing) {
          // Si el SW todavía está instalándose, esperar a que esté listo
          const sw = registration.installing;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed') {
              sw.postMessage({
                type: 'SET_BUILD_ID',
                buildId,
              });
            }
          });
        }

        // Escuchar actualizaciones del SW (nuevo código disponible tras deploy)
        registration.addEventListener('updatefound', () => {
          const newSw = registration.installing;
          if (newSw) {
            newSw.addEventListener('statechange', () => {
              if (
                newSw.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // Un SW nuevo está listo. Notificar al usuario que puede recargar.
                console.info(
                  '[SW] Actualización disponible. La página cargará la versión nueva en el siguiente refresh.',
                );
                // No auto-recargar: la decisión es del usuario (evita perder datos en formularios)
              }
            });
          }
        });
      } catch (error) {
        console.error('[SW] Error al registrar Service Worker:', error);
      }
    }

    registerSw();
  }, []);

  return null; // Este componente no renderiza nada
}
