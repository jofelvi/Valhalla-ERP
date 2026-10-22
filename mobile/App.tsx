import './src/i18n'; // inicializar i18next antes de cualquier componente
import { installGlobalErrorHandler } from './src/utils/globalErrorHandler';

// Instalar handlers globales lo antes posible — antes que cualquier otro
// codigo ejecute, para capturar errores que ocurran durante la inicializacion.
installGlobalErrorHandler();

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppNavigator } from './src/navigation';
import { useAuthStore } from './src/store';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { notificationService } from './src/services/notificationService';
import { startClientLogFlusher } from './src/services/clientLogService';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Monitorear estado de la red (WiFi/celular) en tiempo real
  useNetworkStatus();

  useEffect(() => {
    void initialize();
    // Flusher periodico de la queue de logs (retry de errores ocurridos offline)
    startClientLogFlusher();
  }, [initialize]);

  // Avisos push. Ahora TAMBIEN los clientes: con la migracion a NestJS el
  // cliente es un `users` y el backend guarda su token ahi, asi que Mesa
  // Conectada le entrega estado del pedido y chat. Corre al iniciar sesion y al
  // abrir la app con sesion viva, porque FCM/APNs rotan los tokens.
  useEffect(() => {
    if (isAuthenticated && user) {
      notificationService.registerForPushNotifications().catch(console.error);
    }
  }, [isAuthenticated, user]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
