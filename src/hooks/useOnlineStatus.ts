import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

/**
 * Si el navegador tiene conexion, en vivo.
 *
 * Se cuelga del `onlineManager` de React Query y NO agrega listeners
 * propios: la libreria ya escucha `window.online` y `window.offline` por su
 * cuenta (query-core, `onlineManager.ts`). Una version de esto cableaba esos
 * mismos eventos otra vez en el QueryProvider — codigo duplicado que el que
 * venga despues tiene que leer dos veces para entender que no hace nada.
 *
 * OJO con lo que se le dice a la gente a partir de esto: que no haya red no
 * significa que lo que guarden se vaya a reintentar. La web todavia no tiene
 * cola de escrituras. Ver `OfflineAlert`.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Inicializar con el estado actual
    setIsOnline(onlineManager.isOnline());

    // Escuchar cambios del onlineManager
    const unsubscribe = onlineManager.subscribe((_isOnline) => {
      setIsOnline(_isOnline);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return isOnline;
}
