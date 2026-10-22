'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/services/api/apiClient';
import { CONFIG_QUERY_KEYS } from '@/shared/config/configService';
import type { ConfigPublica } from '@odin6/types';

/**
 * Whitelist de query keys SEGUROS de persistir en localStorage.
 *
 * SOLO incluye datos de REFERENCIA (lectura) que NO cambien durante la sesión.
 * NUNCA incluir datos TRANSACCIONALES o de DINERO (órdenes, pagos, facturas, etc.)
 *
 * ⚠️ CRÍTICO: si un key contiene dinero o estado transaccional, puede ser peligroso
 * cachear porque la pantalla mostraría valores RANCIO tras reconectar.
 */
const SAFE_QUERY_KEYS_FOR_CACHE = [
  'categories', // Catálogo de categorías de productos
  'category', // Singular
  'products', // Catálogo de productos (precios, datos base)
  'product', // Singular
  'tables', // Configuración de mesas (nombres, capacidad)
  'table', // Singular
  'suppliers', // Listado de proveedores
  'supplier', // Singular
  'employees', // Datos base de empleados (roles, horarios — NO salarios)
  'employee', // Singular
  'customers', // Datos base de clientes (NO cuentas por cobrar, NO deudas)
  'customer', // Singular
  'inventory', // Niveles de inventario base (NO transacciones)
  'almacen', // Datos de almacén
  'bcvRate', // Tasa de cambio BCV (es estática)
];

/**
 * Blacklist de query keys que NUNCA deben persistirse (contienen dinero).
 *
 * Si alguno de estos strings aparece como prefijo en queryKey, se DESCARTA.
 */
const UNSAFE_QUERY_KEY_PREFIXES = [
  'orders', // Órdenes = dinero en movimiento
  'order', // Variante singular
  'payments', // Pagos = dinero
  'payment', // Variante singular
  'invoices', // Facturas = dinero
  'invoice', // Variante singular
  'ar', // cuentasRecibidas (Accounts Receivable)
  'accountsReceivable', // Cuentas por cobrar
  'payroll', // Nómina
  'comisions', // Comisiones = dinero
  'comision', // Variante singular
  'expenses', // Gastos
  'creditRequests', // Solicitudes de crédito
  'credit', // Crédito
  'pagoMovil', // Transacciones de pago móvil
  'paymentReports', // Reportes de pago
  'paymentReport', // Variante singular
  'employeeLoans', // Préstamos a empleados
  'loan', // Préstamo
  'alerts', // Alertas (pueden incluir alertas de dinero/urgencia)
  'alert', // Variante singular
  'attendance', // Asistencia (puede tener impacto en salario)
  'budgets', // Presupuestos
  'budget', // Variante singular
  'purchaseOrders', // Órdenes de compra
  'purchaseOrder', // Variante singular
  'tips', // Propinas = dinero
  'tip', // Variante singular
  'users', // Datos de usuario (sensible, no persistir)
  'user', // Variante singular
  'printLogs', // Logs de impresión (puede tener transacciones)
  'printLog', // Variante singular
  'releases', // Desconocido, jugar seguro
  'release', // Variante singular
];

/**
 * Determina si un query key es seguro para persistir en localStorage.
 *
 * @param queryKey - La query key del cache
 * @returns true si es seguro persistir; false si contiene dinero/transacciones
 */
function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  if (!queryKey || queryKey.length === 0) return false;

  // Primer elemento de la key suele ser el nombre de la colección
  const firstKey = queryKey[0];
  if (typeof firstKey !== 'string') return false;

  // Verificar whitelist explícita
  const isInWhitelist = SAFE_QUERY_KEYS_FOR_CACHE.some(
    (safe) =>
      firstKey === safe || // Exacta (p.ej. 'categories' o 'products')
      firstKey.toLowerCase() === safe.toLowerCase(),
  );

  if (!isInWhitelist) return false;

  // Verificar que NO esté en la blacklist
  const isInBlacklist = UNSAFE_QUERY_KEY_PREFIXES.some(
    (unsafe) =>
      firstKey === unsafe ||
      firstKey.toLowerCase() === unsafe.toLowerCase() ||
      queryKey.some(
        (key) =>
          typeof key === 'string' &&
          (key === unsafe || key.toLowerCase() === unsafe.toLowerCase()),
      ),
  );

  return !isInBlacklist;
}

/**
 * Estructura de datos persistida en localStorage.
 * Incluye versión para invalidar caché si cambia el app.
 */
interface PersistedCache {
  version: number;
  timestamp: number; // Milliseconds desde epoch
  queries: Array<{
    queryKey: unknown;
    data: unknown;
  }>;
}

const CURRENT_CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas
const CACHE_STORAGE_KEY = 'pos:react-query-cache-v1';

/**
 * Carga estado cacheado de localStorage de sesiones anteriores.
 * Recupera queries que fueron guardadas antes del cierre, validando versión y age.
 */
function hydrateCache(client: QueryClient): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!stored) return;

    const cached = JSON.parse(stored) as PersistedCache;

    // Validar versión
    if (cached.version !== CURRENT_CACHE_VERSION) {
      console.debug('[QueryProvider] Cache versión mismatch, descartando');
      localStorage.removeItem(CACHE_STORAGE_KEY);
      return;
    }

    // Validar edad
    const ageMs = Date.now() - cached.timestamp;
    if (ageMs > CACHE_MAX_AGE_MS) {
      console.debug('[QueryProvider] Cache expirado (>24h), descartando');
      localStorage.removeItem(CACHE_STORAGE_KEY);
      return;
    }

    // Hidratar queries
    cached.queries.forEach(({ queryKey, data }) => {
      if (shouldPersistQuery(queryKey as readonly unknown[])) {
        client.setQueryData(queryKey as readonly unknown[], data);
      }
    });

    console.debug(
      `[QueryProvider] Hidratadas ${cached.queries.length} queries del caché offline`,
    );
  } catch (error) {
    // Si localStorage está corrupto o vacío, ignorar silenciosamente
    console.debug('[QueryProvider] Error al hidratar caché:', error);
  }
}

/**
 * Escucha cambios en el cache y los persiste en localStorage.
 * Se ejecuta en useEffect para hidratación SSR segura.
 */
function usePersistCache(client: QueryClient): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Guardar estado actual del cache periodicamente (30s)
    // para capturar datos cacheados sin esperar al unmount
    const interval = setInterval(() => {
      try {
        const cache = client.getQueryCache();
        const queries = cache.getAll();

        // Filtrar a queries:
        // 1. Exitosas con datos (no Loading ni Error)
        // 2. Que pasen el whitelist de seguridad (NO dinero)
        const serializable = queries
          .filter(
            (q) =>
              q.state.status === 'success' &&
              q.state.data !== undefined &&
              q.queryKey &&
              typeof q.queryKey === 'object' &&
              shouldPersistQuery(q.queryKey as readonly unknown[]),
          )
          .map((q) => ({
            queryKey: q.queryKey,
            data: q.state.data,
          }));

        const payload: PersistedCache = {
          version: CURRENT_CACHE_VERSION,
          timestamp: Date.now(),
          queries: serializable,
        };

        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        // Si JSON.stringify falla (datos no serializables), ignorar silenciosamente
        console.debug('[QueryProvider] Error al persistir caché:', error);
      }
    }, 30_000); // cada 30s

    return () => clearInterval(interval);
  }, [client]);
}

/**
 * `configInicial`: la configuración que ya leyó el servidor. Se siembra en la caché para que el
 * primer render del cliente tenga marca y tarifas, sin parpadeo de valores neutros.
 */
export function QueryProvider({
  children,
  configInicial,
}: {
  children: ReactNode;
  configInicial?: ConfigPublica;
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes — products/categories/tables rarely change mid-session
          gcTime: 15 * 60 * 1000, // 15 minutes — aumentado para que persista mas tiempo offline
          // Retry policy defensiva: en errores 4xx no recuperables (auth/forbidden/notfound)
          // no reintentamos. En 429 (rate-limit nginx) no reintentamos para no amplificar.
          // Para timeouts y 5xx, max 2 retries con backoff exponencial.
          retry: (failureCount, error) => {
            if (error instanceof ApiError) {
              if ([401, 403, 404, 429].includes(error.status)) return false;
            }
            return failureCount < 2;
          },
          // Backoff exponencial: 1s, 2s, 4s (cap 8s). Evita amplificar problemas
          // del backend cuando responde lento.
          retryDelay: (attemptIndex) =>
            Math.min(1000 * Math.pow(2, attemptIndex), 8000),
          refetchOnWindowFocus: false,
        },
      },
    });

    // Hidratar cache de localStorage (si esta disponible)
    hydrateCache(client);
    if (configInicial) {
      client.setQueryData(CONFIG_QUERY_KEYS.publico, configInicial);
    }

    return client;
  });

  // Persistir cache periodicamente
  usePersistCache(queryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
