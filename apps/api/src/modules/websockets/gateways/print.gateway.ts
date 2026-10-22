import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  decidePrintServiceKey,
  PRINT_SERVICE_KEY_HEADER,
} from '../../../common/guards/print-service-key';

@WebSocketGateway({
  cors: true,
  namespace: '/print',
})
export class PrintGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PrintGateway.name);

  @WebSocketServer() server: Server;

  // Cada job lleva el qrData de la ficha: este namespace se lo reparte a quien
  // se conecte, asi que el print-service se identifica con su clave.
  handleConnection(client: Socket) {
    const auth = client.handshake.auth as { key?: unknown } | undefined;
    const clave =
      auth?.key ?? client.handshake.headers[PRINT_SERVICE_KEY_HEADER];
    const decision = decidePrintServiceKey(clave, process.env);
    const origen = client.handshake.address;
    if (decision.action === 'deny') {
      this.logger.warn(
        `[print-key] RECHAZADO socket ${client.id} desde ${origen}: ${decision.reason}`,
      );
      client.disconnect(true);
      return;
    }
    if (decision.action === 'audit') {
      this.logger.warn(
        `[print-key] auditoria socket ${client.id} desde ${origen}: ${decision.reason}`,
      );
    }
    this.logger.log(`Print client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Print client disconnected: ${client.id}`);
  }

  emitNewJob(job: any) {
    this.logger.debug(`Broadcasting print:new-job for ${job.id}`);
    this.server.emit('print:new-job', job);
  }

  emitStatusChanged(job: any) {
    this.logger.debug(
      `Broadcasting print:status-changed for ${job.id} → ${job.status}`,
    );
    this.server.emit('print:status-changed', job);
  }

  /**
   * Numero de print-services conectados ahora mismo al namespace /print.
   * Usado por GET /api/print-queue/service-status para que la web sepa
   * si hay alguien al otro lado que consuma la cola antes de encolar.
   */
  getConnectedCount(): number {
    if (!this.server) return 0;
    // Namespace.sockets es Map<SocketId, Socket>. El cast evita quejas
    // de tipos porque @types/socket.io tipa server como Namespace cuyo
    // sockets es un Map pero el TS strict no lo resuelve bien.
    const sockets = (
      this.server as unknown as { sockets?: Map<string, unknown> }
    ).sockets;
    return sockets?.size ?? 0;
  }
}
