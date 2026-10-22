import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../../config/env';
import { getAccessToken } from './apiClient';

let socket: Socket | null = null;
let connecting: Promise<Socket> | null = null;

async function createSocket(): Promise<Socket> {
  const token = await getAccessToken();
  const s = io(`${WS_URL}/pos`, {
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });
  return new Promise<Socket>((resolve, reject) => {
    const onConnect = () => {
      s.off('connect_error', onError);
      resolve(s);
    };
    const onError = (err: Error) => {
      s.off('connect', onConnect);
      reject(err);
    };
    s.once('connect', onConnect);
    s.once('connect_error', onError);
  });
}

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (connecting) return connecting;
  connecting = createSocket()
    .then((s) => {
      socket = s;
      return s;
    })
    .finally(() => {
      connecting = null;
    });
  return connecting;
}

export async function disconnectSocket(): Promise<void> {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

type Unsubscribe = () => void;

export async function on<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): Promise<Unsubscribe> {
  const s = await getSocket();
  s.on(event, handler);
  return () => s.off(event, handler);
}
