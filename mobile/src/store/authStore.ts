import { create } from 'zustand';
import {
  api,
  setAccessToken,
  getAccessToken,
  setUnauthorizedHandler,
  ApiError,
  NetworkError,
} from '../services/api/apiClient';
import { disconnectSocket } from '../services/api/socketClient';
import { notificationService } from '../services/notificationService';
import { UserRoleEnum } from '../types';

export interface AuthUser {
  id: string;
  uid: string; // alias de id para retrocompat con codigo que venia de Firebase (user.uid)
  name: string;
  displayName?: string | null; // alias de name
  email: string | null;
  phone?: string | null;
  address?: string | null;
  memberNumber?: string | null;
  // El numero de socio real: el backend lo guarda asi en `customers`
  // (2073 clientes lo tienen). `memberNumber` practicamente no se usa.
  memberAction?: string | null;
  role: UserRoleEnum;
  isActive: boolean;
  emailVerified?: boolean;
}

interface LoginResponse {
  accessToken: string;
  user: Omit<AuthUser, 'uid' | 'displayName'>;
}

function hydrateUser(raw: LoginResponse['user']): AuthUser {
  return {
    ...raw,
    uid: raw.id,
    displayName: raw.name,
    role: normalizeRole(raw.role),
  };
}

interface AuthState {
  user: AuthUser | null;
  customer: AuthUser | null; // alias de user para retrocompat (codigo que venia del "customer" separado)
  role: UserRoleEnum;
  isInitializing: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  // true cuando initialize() no pudo validar el token por un fallo de RED
  // (timeout / sin respuesta del servidor), no por token invalido. Sirve
  // para que la UI muestre "sin conexion" en vez de forzar el login.
  isOffline: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    name: string,
    phone?: string,
    memberNumber?: string | null,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    phone?: string | null;
    address?: string | null;
    memberNumber?: string | null;
  }) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendVerification: () => Promise<{ alreadyVerified: boolean }>;
  clearError: () => void;
  initialize: () => Promise<void>;
}

function normalizeRole(role: unknown): UserRoleEnum {
  const raw = String(role ?? '').toLowerCase();
  const valid = Object.values(UserRoleEnum) as string[];
  return valid.includes(raw) ? (raw as UserRoleEnum) : UserRoleEnum.CUSTOMER;
}

/**
 * Detecta si un error es de red (timeout, sin respuesta, ECONNREFUSED, etc.)
 * vs un error de autenticación válido (401, 403).
 * Verifica primero si es NetworkError explícitamente; luego patrones de mensaje.
 */
function isNetworkError(error: unknown): boolean {
  // Detección explícita de NetworkError (desde apiClient)
  if (error instanceof NetworkError) {
    return true;
  }

  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Patrones comunes de error de red en React Native / Node.js
  const networkPatterns = [
    'econnrefused', // Connection refused (servidor no escucha)
    'enotfound', // DNS fallo
    'etimedout', // Socket timeout
    'ehostunreach', // Host no alcanzable
    'enetunreach', // Network no alcanzable
    'timeout', // Timeout genérico
    'network', // "Network error", "Network timeout"
    'unable to connect',
    'connection refused',
    'connection failed',
    'failed to fetch',
    'fetch error',
  ];

  return networkPatterns.some(
    (pattern) => message.includes(pattern) || name.includes(pattern),
  );
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  customer: null,
  role: UserRoleEnum.CUSTOMER,
  isInitializing: true,
  isLoading: false,
  isAuthenticated: false,
  isOffline: false,
  error: null,

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<LoginResponse>('/api/auth/login', {
        email,
        password,
      });
      await setAccessToken(res.accessToken);
      const user = hydrateUser(res.user);
      set({
        user,
        customer: user,
        role: user.role,
        isAuthenticated: true,
        isLoading: false,
        isOffline: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error al iniciar sesion';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  signUp: async (email, password, name, phone, memberNumber) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<LoginResponse>('/api/auth/register', {
        email,
        password,
        name,
        phone: phone ?? null,
        // Socio: el backend crea el doc en `customers` y verifica la accion
        // contra el padron. Nombres alineados con el DTO (memberNumber antes se
        // descartaba por el whitelist del ValidationPipe).
        memberAction: memberNumber ?? null,
        isMemberPrincipal: memberNumber ? true : false,
        role: UserRoleEnum.CUSTOMER,
      });
      await setAccessToken(res.accessToken);
      const user = hydrateUser(res.user);
      set({
        user,
        customer: user,
        role: user.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error al registrarse';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      // Antes de soltar el token de sesion: si no, el backend rechaza la
      // baja y el telefono seguiria recibiendo avisos del usuario anterior.
      await notificationService.unregister();
      await setAccessToken(null);
      await disconnectSocket();
      set({
        user: null,
        customer: null,
        role: UserRoleEnum.CUSTOMER,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error al cerrar sesion';
      set({ error: errorMessage, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const { user } = get();
    if (!user) return;

    set({ isLoading: true, error: null });
    try {
      // Si el usuario es customer, actualizar en /api/customers; si es staff, en /api/users
      const path =
        user.role === UserRoleEnum.CUSTOMER
          ? `/api/customers/${user.id}`
          : `/api/users/${user.id}`;
      const updated = await api.patch<Partial<AuthUser>>(path, data);
      const merged: AuthUser = {
        ...user,
        ...updated,
        uid: user.id,
        displayName: updated.name ?? user.name ?? null,
        role: user.role,
      };
      set({ user: merged, customer: merged, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error al actualizar perfil';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  verifyEmail: async (code: string) => {
    const { user } = get();
    const res = await api.post<{
      verified: boolean;
      user: LoginResponse['user'];
    }>('/api/auth/verify-email', { code: code.trim() });
    const hydrated = hydrateUser(res.user);
    set({ user: hydrated, customer: hydrated, role: hydrated.role });
    if (!res.verified && user) {
      throw new Error('No se pudo verificar');
    }
  },

  resendVerification: async () => {
    return api.post<{ alreadyVerified: boolean }>(
      '/api/auth/resend-verification',
      {},
    );
  },

  forgotPassword: async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) throw new Error('El email es requerido');
    // Endpoint opcional — si no existe en backend, api.post lanza 404
    await api.post('/api/auth/forgot-password', { email: trimmed });
  },

  clearError: () => set({ error: null }),

  initialize: async () => {
    // Handler global para 401 → forzar logout
    setUnauthorizedHandler(async () => {
      await setAccessToken(null);
      await disconnectSocket();
      set({
        user: null,
        customer: null,
        role: UserRoleEnum.CUSTOMER,
        isAuthenticated: false,
      });
    });

    try {
      const token = await getAccessToken();
      if (!token) {
        set({ isInitializing: false });
        return;
      }
      // Validar sesion contra /api/auth/me
      const raw = await api.get<LoginResponse['user']>('/api/auth/me');
      const user = hydrateUser(raw);
      set({
        user,
        customer: user,
        role: user.role,
        isAuthenticated: true,
        isInitializing: false,
        isOffline: false,
      });
    } catch (error: unknown) {
      // Criterio: 401/403 = logout (sesion invalida); todo lo demas = mantener sesion
      // porque puede ser un problema de red (timeout, sin respuesta, 5xx, DNS fallo).
      // Medido: 28 cortes/30d con duraciones de hasta 116 min. No hay que desloguear
      // al personal por un parpadeo de conexion.
      const isAuthError =
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403);

      if (isAuthError) {
        await setAccessToken(null);
        set({
          user: null,
          customer: null,
          role: UserRoleEnum.CUSTOMER,
          isAuthenticated: false,
          isInitializing: false,
          isOffline: false,
        });
        return;
      }

      // Si es error de RED explícito (no un ApiError de estado), marcar offline
      // pero mantener la sesion (token + user) en memoria.
      const netErr = isNetworkError(error);
      if (netErr) {
        set({ isInitializing: false, isOffline: true });
        return;
      }

      // Otros errores (5xx, 4xx no-auth, etc): marcar offline tambien
      // para no perder la sesion en transiciones de red lentas.
      set({ isInitializing: false, isOffline: true });
    }
  },
}));
