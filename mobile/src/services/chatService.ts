import { api } from './api/apiClient';
import { Chat, ChatMessage, ChatStatusEnum, GpsCoordinates } from '../types';
import { AppState } from 'react-native';
import { encuestarEnPrimerPlano } from './encuestaEnPrimerPlano';

/**
 * El chat es lo unico de los tres donde el retardo se nota: el cliente
 * pregunta y espera respuesta. Se conserva en 3 s **mientras la pantalla esta
 * encendida**; en segundo plano no cuesta nada.
 */
const CADA_MS_DEL_CHAT = 3_000;

export type Unsubscribe = () => void;

interface RawMessage {
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'waiter';
  text: string;
  location?: GpsCoordinates | null;
  timestamp?: string | null;
}

interface RawChat {
  id?: string;
  _id?: string;
  orderId: string;
  customerId: string;
  customerName: string;
  waiterId: string;
  waiterName: string;
  messages?: RawMessage[];
  status: string;
  createdAt?: string | null;
}

function parseDate(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function parseChat(raw: RawChat): Chat {
  const messages: ChatMessage[] = (raw.messages ?? []).map((m) => ({
    senderId: m.senderId,
    senderName: m.senderName,
    senderRole: m.senderRole,
    text: m.text,
    location: m.location ?? undefined,
    timestamp: parseDate(m.timestamp),
  }));
  return {
    id: String(raw.id ?? raw._id ?? raw.orderId),
    orderId: raw.orderId,
    customerId: raw.customerId,
    customerName: raw.customerName,
    waiterId: raw.waiterId,
    waiterName: raw.waiterName,
    messages,
    status: raw.status as ChatStatusEnum,
    createdAt: parseDate(raw.createdAt),
  };
}

export const chatService = {
  /**
   * Crea un chat para una orden (idempotente). El id del chat es el orderId.
   */
  async createChat(
    orderId: string,
    customerId: string,
    customerName: string,
    waiterId: string,
    waiterName: string,
  ): Promise<void> {
    await api.post<RawChat>('/api/chat', {
      orderId,
      customerId,
      customerName,
      waiterId,
      waiterName,
    });
  },

  /**
   * Envia un mensaje al chat.
   */
  async sendMessage(
    orderId: string,
    message: {
      senderId: string;
      senderName: string;
      senderRole: 'customer' | 'waiter';
      text: string;
      location?: GpsCoordinates;
    },
  ): Promise<void> {
    await api.post<RawChat>(`/api/chat/${orderId}/messages`, message);
  },

  /**
   * "Suscripcion" real-time al chat — polling 3s.
   */
  subscribeToChat(
    orderId: string,
    callback: (chat: Chat | null) => void,
  ): Unsubscribe {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const raw = await api.get<RawChat | null>(`/api/chat/${orderId}`);
        if (!cancelled) callback(raw ? parseChat(raw) : null);
      } catch (error) {
        if (!cancelled) {
          console.error('Error en subscribeToChat:', error);
          callback(null);
        }
      }
    };

    // Se duerme cuando el telefono no esta en pantalla. Ver
    // `encuestaEnPrimerPlano.ts`: antes esto corria igual en el bolsillo.
    const parar = encuestarEnPrimerPlano(tick, {
      cadaMs: CADA_MS_DEL_CHAT,
      appState: AppState,
    });

    return () => {
      cancelled = true;
      parar();
    };
  },

  /**
   * Cierra un chat (marca como CLOSED).
   */
  async closeChat(orderId: string): Promise<void> {
    await api.patch<RawChat>(`/api/chat/${orderId}/close`, {});
  },
};
