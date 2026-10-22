import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

// Coalescing: si emitimos el mismo evento para la misma entidad (id) varias
// veces en una ventana corta, solo se envia el ultimo payload. Esto evita
// tormentas de WS cuando un flujo dispara muchas escrituras seguidas (ej:
// cobrar una orden toca orden + mesa + orden de nuevo en <100ms).
const COALESCE_WINDOW_MS = 40;

@WebSocketGateway({
  cors: true,
  namespace: '/pos',
})
export class PosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PosGateway.name);

  @WebSocketServer() server: Server;

  private pending = new Map<string, { payload: any; timer: NodeJS.Timeout }>();

  handleConnection(client: Socket) {
    this.logger.log(`POS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`POS client disconnected: ${client.id}`);
  }

  /**
   * Agrupa emits para la misma clave (event:entityId). Solo sale al aire el
   * ultimo payload recibido dentro de la ventana.
   */
  private coalescedEmit(key: string, event: string, payload: any) {
    const existing = this.pending.get(key);
    if (existing) {
      existing.payload = payload;
      return;
    }
    const timer = setTimeout(() => {
      const entry = this.pending.get(key);
      this.pending.delete(key);
      if (entry) {
        this.server.emit(event, entry.payload);
      }
    }, COALESCE_WINDOW_MS);
    this.pending.set(key, { payload, timer });
  }

  notifyOrderCreated(order: any) {
    this.logger.debug(`Broadcasting order:created for ${order.id}`);
    // created nunca se coalescea con updated del mismo id — son eventos
    // distintos en el cliente.
    this.coalescedEmit(`order:created:${order.id}`, 'order:created', order);
  }

  notifyOrderUpdated(order: any) {
    this.logger.debug(`Broadcasting order:updated for ${order.id}`);
    this.coalescedEmit(`order:updated:${order.id}`, 'order:updated', order);
  }

  notifyOrderDeleted(orderId: string) {
    this.logger.debug(`Broadcasting order:deleted for ${orderId}`);
    // Si habia un updated pendiente para este id, descartarlo: la orden ya no existe.
    const pendingUpdate = this.pending.get(`order:updated:${orderId}`);
    if (pendingUpdate) {
      clearTimeout(pendingUpdate.timer);
      this.pending.delete(`order:updated:${orderId}`);
    }
    this.server.emit('order:deleted', { id: orderId });
  }

  notifyTableUpdated(table: any) {
    this.logger.debug(`Broadcasting table:updated for ${table.id}`);
    this.coalescedEmit(`table:updated:${table.id}`, 'table:updated', table);
  }
}
