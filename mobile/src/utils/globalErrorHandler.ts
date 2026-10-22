import { logClientEvent } from '../services/clientLogService';
import { useAuthStore } from '../store';

interface ErrorUtilsShape {
  setGlobalHandler: (handler: (err: Error, isFatal?: boolean) => void) => void;
  getGlobalHandler: () => (err: Error, isFatal?: boolean) => void;
}

// ErrorUtils es una global de React Native que permite capturar errores JS
// no atrapados por componentes (handlers de eventos, callbacks, timers, etc.).
// Existe solo en el entorno nativo; fuera de el no hacemos nada.
function getErrorUtils(): ErrorUtilsShape | null {
  const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsShape };
  return g.ErrorUtils ?? null;
}

let installed = false;

/**
 * Registra handlers globales para:
 *  - errores JS no atrapados (ErrorUtils)
 *  - unhandled promise rejections
 *
 * Cada error se envia al backend via logClientEvent. En modo fatal, tambien
 * delega al handler original para que la app muestre el red screen (dev) o
 * crashee limpio (release).
 */
export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;

  const errorUtils = getErrorUtils();
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      try {
        const authUser = useAuthStore.getState().user;
        void logClientEvent({
          level: 'error',
          source: 'globalErrorHandler',
          message: error?.message ?? 'Unhandled JS error',
          stack: error?.stack ?? null,
          context: {
            name: error?.name,
            isFatal: !!isFatal,
          },
          userId: authUser?.uid ?? null,
          userEmail: authUser?.email ?? null,
        });
      } catch {
        // never throw from the global handler
      }
      // Preservar comportamiento default (red screen en dev, crash nativo en release)
      if (typeof previous === 'function') {
        previous(error, isFatal);
      }
    });
  }

  // Unhandled promise rejections — React Native no los expone por el
  // browser API; usamos el hook que el polyfill de promesas expone.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: number, rejection: unknown) => {
        const err =
          rejection instanceof Error
            ? rejection
            : new Error(
                typeof rejection === 'string'
                  ? rejection
                  : JSON.stringify(rejection).slice(0, 500),
              );
        const authUser = useAuthStore.getState().user;
        void logClientEvent({
          level: 'error',
          source: 'unhandledPromiseRejection',
          message: err.message ?? 'Unhandled promise rejection',
          stack: err.stack ?? null,
          context: { name: err.name ?? 'Unhandled' },
          userId: authUser?.uid ?? null,
          userEmail: authUser?.email ?? null,
        });
      },
      onHandled: () => {
        // noop — ignore late-handled rejections
      },
    });
  } catch {
    // El polyfill no siempre esta disponible (ej: Hermes en ciertos builds).
    // En ese caso nos perdemos unhandled rejections, pero no rompemos.
  }
}
