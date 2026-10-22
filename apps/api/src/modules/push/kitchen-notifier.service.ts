import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { OrderStatusEnum } from '@odin6/types';
import { PushService } from './push.service';
import {
  buildDeliveryMessage,
  DeliveredItem,
  OrderContext,
} from './push-message';
import { buildCustomerStatusMessage } from './customer-status-message';

/**
 * Avisa al mesonero que su comida esta lista.
 *
 * Cocina entrega de forma dinamica: puede escanear un producto, luego otro, y
 * otro mas de la misma orden. Sin agrupar, el mesonero recibiria una vibracion
 * por cada escaneo. Por eso se acumula por orden durante una ventana corta y
 * sale UN aviso con todo lo despachado.
 */

const WINDOW_MS = 20_000;

interface PendingBatch {
  order: OrderContext;
  items: DeliveredItem[];
  /** Quien entrego: no tiene sentido notificarse a si mismo. */
  actorIds: Set<string>;
  timer: NodeJS.Timeout;
}

@Injectable()
export class KitchenNotifierService implements OnModuleDestroy {
  private readonly logger = new Logger(KitchenNotifierService.name);
  private readonly batches = new Map<string, PendingBatch>();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly push: PushService,
  ) {}

  onModuleDestroy(): void {
    for (const batch of this.batches.values()) clearTimeout(batch.timer);
    this.batches.clear();
  }

  /**
   * Punto de entrada desde OrdersService. Fire-and-forget por contrato: si
   * algo falla aqui, la entrega en cocina ya ocurrio y no debe verse afectada.
   */
  itemsDelivered(
    order: OrderContext & { waiterId?: string | null; waiterShares?: unknown },
    items: DeliveredItem[],
    actorId: string,
  ): void {
    if (!this.push.enabled || items.length === 0) return;

    try {
      const key = order.orderId;
      const existing = this.batches.get(key);

      if (existing) {
        existing.items.push(...items);
        existing.actorIds.add(actorId);
        existing.order = { ...existing.order, ...order };
        return;
      }

      const batch: PendingBatch = {
        order,
        items: [...items],
        actorIds: new Set([actorId]),
        timer: setTimeout(() => {
          this.batches.delete(key);
          void this.flush(key, order, batch).catch((err) =>
            this.logger.warn(
              `Aviso de cocina fallido: ${(err as Error).message}`,
            ),
          );
        }, WINDOW_MS),
      };
      this.batches.set(key, batch);
    } catch (err) {
      this.logger.warn(
        `No se pudo encolar el aviso: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Avisa al CLIENTE vinculado que su pedido cambio de estado (en preparacion /
   * va en camino). Fire-and-forget: si falla, la operacion de la orden no se
   * afecta. El customerId de una orden de cliente vinculado es su _id en
   * `users`, donde viven sus pushTokens.
   */
  notifyCustomerStatus(order: {
    orderId: string;
    customerId?: string | null;
    status: OrderStatusEnum;
    tableName?: string | null;
    sector?: string | null;
  }): void {
    if (!this.push.enabled || !order.customerId) return;
    const message = buildCustomerStatusMessage(order.status, order);
    if (!message) return;
    void this.push
      .sendToUsers([String(order.customerId)], {
        ...message,
        channelId: 'kitchen',
        data: {
          type: 'order-status',
          orderId: order.orderId,
          status: String(order.status),
        },
      })
      .catch((err) =>
        this.logger.warn(
          `Aviso de estado al cliente fallido: ${(err as Error).message}`,
        ),
      );
  }

  /**
   * Avisa al MESONERO que un cliente se unio a su orden por QR. Fire-and-forget.
   */
  notifyWaiterCustomerJoined(order: {
    orderId: string;
    waiterId?: string | null;
    customerName: string;
    tableName?: string | null;
    sector?: string | null;
  }): void {
    if (!this.push.enabled || !order.waiterId) return;
    const where = order.tableName ?? order.sector ?? 'la mesa';
    void this.push
      .sendToUsers([String(order.waiterId)], {
        title: 'Cliente conectado',
        body: `${order.customerName} se unio a ${where}`,
        channelId: 'kitchen',
        data: { type: 'customer-joined', orderId: order.orderId },
      })
      .catch((err) =>
        this.logger.warn(`Aviso de union fallido: ${(err as Error).message}`),
      );
  }

  /** Push al MESONERO por una solicitud del cliente. */
  notifyWaiterRequest(
    order: {
      orderId: string;
      waiterId?: string | null;
      customerName: string;
      tableName?: string | null;
      sector?: string | null;
    },
    req: {
      type: 'PRODUCT' | 'CALL_WAITER' | 'MISC';
      productName?: string;
      quantity?: number;
      note?: string;
    },
  ): void {
    if (!this.push.enabled || !order.waiterId) return;
    const where = order.tableName ?? order.sector ?? 'la mesa';
    let body: string;
    if (req.type === 'PRODUCT') {
      body = `${order.customerName} pide ${req.quantity ?? 1}x ${req.productName ?? 'un producto'}`;
    } else if (req.type === 'CALL_WAITER') {
      body = `${order.customerName} te llama en ${where}`;
    } else {
      body = `${order.customerName}: ${req.note ?? 'solicitud'}`;
    }
    void this.push
      .sendToUsers([String(order.waiterId)], {
        title:
          req.type === 'PRODUCT' ? 'Nueva solicitud' : `Cliente en ${where}`,
        body,
        channelId: 'kitchen',
        data: {
          type: 'customer-request',
          orderId: order.orderId,
          requestType: req.type,
        },
      })
      .catch((err) =>
        this.logger.warn(
          `Aviso de solicitud fallido: ${(err as Error).message}`,
        ),
      );
  }

  /** Push al CLIENTE cuando el mesonero resuelve su solicitud de producto. */
  notifyCustomerRequestResolved(
    order: { orderId: string; customerId?: string | null },
    req: {
      type: string;
      status: string;
      productName?: string;
      rejectReason?: string;
    },
  ): void {
    if (!this.push.enabled || !order.customerId || req.type !== 'PRODUCT')
      return;
    const isAccepted = req.status === 'ACCEPTED';
    void this.push
      .sendToUsers([String(order.customerId)], {
        title: isAccepted ? 'Solicitud aceptada' : 'Solicitud rechazada',
        body: isAccepted
          ? `Tu mesonero agrego ${req.productName ?? 'el producto'}`
          : `No se pudo agregar ${req.productName ?? 'el producto'}${req.rejectReason ? `: ${req.rejectReason}` : ''}`,
        channelId: 'kitchen',
        data: {
          type: 'request-resolved',
          orderId: order.orderId,
          status: req.status,
        },
      })
      .catch((err) =>
        this.logger.warn(
          `Aviso de resolucion fallido: ${(err as Error).message}`,
        ),
      );
  }

  /** Push al MESONERO cuando el cliente pide la cuenta. */
  notifyWaiterBillRequested(order: {
    orderId: string;
    waiterId?: string | null;
    customerName: string;
    tableName?: string | null;
    sector?: string | null;
  }): void {
    if (!this.push.enabled || !order.waiterId) return;
    const where = order.tableName ?? order.sector ?? 'la mesa';
    void this.push
      .sendToUsers([String(order.waiterId)], {
        title: 'Piden la cuenta',
        body: `${order.customerName} pide la cuenta en ${where}`,
        channelId: 'kitchen',
        data: { type: 'bill-requested', orderId: order.orderId },
      })
      .catch((err) =>
        this.logger.warn(`Aviso de cuenta fallido: ${(err as Error).message}`),
      );
  }

  private async flush(
    orderId: string,
    order: OrderContext & { waiterId?: string | null; waiterShares?: unknown },
    batch: PendingBatch,
  ): Promise<void> {
    const recipients = await this.resolveRecipients(order, batch.actorIds);
    if (recipients.length === 0) return;

    const message = buildDeliveryMessage(batch.order, batch.items);
    const sent = await this.push.sendToUsers(recipients, {
      ...message,
      channelId: 'kitchen',
      data: { type: 'items-ready', orderId },
    });
    if (sent > 0) {
      this.logger.log(`Aviso de cocina enviado a ${sent} dispositivo(s)`);
    }
  }

  /**
   * Mesonero de la orden + con quienes la comparte + gerencia (admin/cashier),
   * menos quien acaba de entregar.
   */
  private async resolveRecipients(
    order: { waiterId?: string | null; waiterShares?: unknown },
    actorIds: Set<string>,
  ): Promise<string[]> {
    const ids = new Set<string>();
    if (order.waiterId) ids.add(String(order.waiterId));

    // waiterShares: [{ waiterId, ... }] — traspasos y ordenes compartidas.
    const shares = Array.isArray(order.waiterShares)
      ? (order.waiterShares as Array<{ waiterId?: string }>)
      : [];
    for (const s of shares) {
      if (s?.waiterId) ids.add(String(s.waiterId));
    }

    const staff = await this.userModel
      .find(
        {
          role: { $in: ['admin', 'cashier'] },
          isActive: { $ne: false },
          'pushTokens.0': { $exists: true },
        },
        { _id: 1 },
      )
      .lean()
      .exec();
    for (const u of staff) ids.add(String(u._id));

    for (const actor of actorIds) ids.delete(actor);
    return [...ids];
  }
}
