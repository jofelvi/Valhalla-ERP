import { api } from './api/apiClient';
import { AppState } from 'react-native';
import { encuestarEnPrimerPlano } from './encuestaEnPrimerPlano';

/**
 * Una sesion de caja se abre y se cierra un par de veces al dia: preguntarlo
 * cada 5 s era sondear un dato que casi nunca cambia. 20 s sigue siendo
 * inmediato para lo que hay que ver, y al volver del segundo plano se consulta
 * al instante.
 */
const CADA_MS_DE_LA_SESION = 20_000;

// --- Tipos ---

export type CashRegisterSessionStatus = 'open' | 'closed';

export interface PaymentMethodSummary {
  method: string;
  methodLabel: string;
  count: number;
  amount: number;
}

export interface SessionSummary {
  totalOrders: number;
  totalAmount: number;
  totalAmountBs: number;
  byPaymentMethod: PaymentMethodSummary[];
}

export interface CashRegisterSession {
  id: string;
  userId: string;
  userName: string;
  status: CashRegisterSessionStatus;
  openedAt: Date | null;
  closedAt: Date | null;
  summary: SessionSummary | null;
}

export type CashRegisterEventType =
  | 'session_opened'
  | 'session_closed'
  | 'order_created'
  | 'payment_processed'
  | 'table_freed'
  | 'comanda_printed';

export interface CashRegisterEvent {
  id: string;
  sessionId: string;
  type: CashRegisterEventType;
  description: string;
  orderId: string | null;
  amount: number | null;
  createdAt: Date | null;
}

// --- Unsubscribe type (retrocompat con firma anterior) ---

export type Unsubscribe = () => void;

// --- Raw API types ---

interface RawSession {
  id?: string;
  _id?: string;
  userId: string;
  userName: string;
  status: CashRegisterSessionStatus;
  openedAt?: string | null;
  closedAt?: string | null;
  summary?: SessionSummary | null;
}

interface RawEvent {
  id?: string;
  _id?: string;
  sessionId: string;
  type: CashRegisterEventType;
  description: string;
  orderId?: string | null;
  amount?: number | null;
  createdAt?: string | null;
}

// --- Parsers ---

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseSession(raw: RawSession): CashRegisterSession {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    userId: raw.userId,
    userName: raw.userName,
    status: raw.status,
    openedAt: parseDate(raw.openedAt),
    closedAt: parseDate(raw.closedAt),
    summary: raw.summary ?? null,
  };
}

function parseEvent(raw: RawEvent): CashRegisterEvent {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    sessionId: raw.sessionId,
    type: raw.type,
    description: raw.description,
    orderId: raw.orderId ?? null,
    amount: raw.amount ?? null,
    createdAt: parseDate(raw.createdAt),
  };
}

// --- Servicio ---

export const cashRegisterService = {
  /**
   * Abre una nueva sesion de caja. Retorna el id de la sesion creada.
   */
  async openSession(userId: string, userName: string): Promise<string> {
    const raw = await api.post<RawSession>('/api/cash-register/sessions', {
      userId,
      userName,
    });
    return parseSession(raw).id;
  },

  /**
   * Cierra una sesion de caja con su resumen.
   */
  async closeSession(
    sessionId: string,
    summary: SessionSummary,
  ): Promise<void> {
    await api.patch<RawSession>(
      `/api/cash-register/sessions/${sessionId}/close`,
      { summary },
    );
  },

  /**
   * Busca la sesion abierta del usuario (puede haber max 1).
   */
  async getActiveSession(userId: string): Promise<CashRegisterSession | null> {
    const raw = await api.get<RawSession | null>('/api/cash-register/active', {
      userId,
    });
    return raw ? parseSession(raw) : null;
  },

  /**
   * "Suscripcion" en tiempo real a la sesion activa del usuario.
   * Implementado como polling cada 5s. Retorna funcion de cleanup.
   */
  subscribeToActiveSession(
    userId: string,
    callback: (session: CashRegisterSession | null) => void,
  ): Unsubscribe {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const session = await this.getActiveSession(userId);
        if (!cancelled) callback(session);
      } catch (error) {
        if (!cancelled) {
          console.error('Error en subscribeToActiveSession:', error);
          callback(null);
        }
      }
    };

    // Se duerme cuando el telefono no esta en pantalla. Ver
    // `encuestaEnPrimerPlano.ts`: antes esto corria igual en el bolsillo.
    const parar = encuestarEnPrimerPlano(tick, {
      cadaMs: CADA_MS_DE_LA_SESION,
      appState: AppState,
    });

    return () => {
      cancelled = true;
      parar();
    };
  },

  /**
   * Historial de sesiones cerradas del usuario, ordenadas por fecha desc.
   */
  async getSessionHistory(
    userId: string,
    maxResults = 20,
  ): Promise<CashRegisterSession[]> {
    const raws = await api.get<RawSession[]>('/api/cash-register/sessions', {
      userId,
      limit: String(maxResults),
    });
    return raws.map(parseSession);
  },

  /**
   * Registra un evento en el timeline de la sesion.
   */
  async logEvent(
    sessionId: string,
    event: {
      type: CashRegisterEventType;
      description: string;
      orderId?: string;
      amount?: number;
    },
  ): Promise<void> {
    await api.post<RawEvent>(
      `/api/cash-register/sessions/${sessionId}/events`,
      {
        type: event.type,
        description: event.description,
        orderId: event.orderId,
        amount: event.amount,
      },
    );
  },

  /**
   * Obtiene todos los eventos de una sesion, ordenados cronologicamente.
   */
  async getSessionEvents(sessionId: string): Promise<CashRegisterEvent[]> {
    const raws = await api.get<RawEvent[]>(
      `/api/cash-register/sessions/${sessionId}/events`,
    );
    return raws.map(parseEvent);
  },
};
