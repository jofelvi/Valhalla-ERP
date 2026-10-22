import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../store/authStore';

/**
 * Hook que monitorea el estado de la red y actualiza authStore.isOffline
 * cuando la conexión se pierde.
 *
 * Uso en App root:
 *   const unsubscribe = useNetworkStatus();
 *   useEffect(() => unsubscribe, [unsubscribe]);
 *
 * Retorna unsubscribe para cleanup.
 */
export function useNetworkStatus(): () => void {
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Monitorear cambios de conectividad en tiempo real
    const subscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      const { isOffline, isAuthenticated } = useAuthStore.getState();

      // Si recuperamos conectividad y estábamos offline, actualizar el estado
      if (isConnected && isOffline) {
        useAuthStore.setState({ isOffline: false });
      }
      // Si perdemos conectividad y estamos autenticados, marcar offline
      else if (!isConnected && isAuthenticated && !isOffline) {
        useAuthStore.setState({ isOffline: true });
      }
    });

    unsubscribeRef.current = subscribe;

    return () => {
      subscribe?.();
    };
  }, []);

  return () => unsubscribeRef.current?.();
}
