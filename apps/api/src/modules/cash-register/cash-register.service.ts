import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CashRegisterSession,
  CashRegisterSessionDocument,
  SessionSummary,
} from './schemas/cash-register-session.schema';
import {
  CashRegisterEvent,
  CashRegisterEventDocument,
} from './schemas/cash-register-event.schema';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { LogEventDto } from './dto/log-event.dto';
import {
  pipelineDeResumenDeCaja,
  armarResumenDeCaja,
  type FilaPorMetodo,
  type ResumenDeCaja,
} from './resumen-de-caja.util';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';

@Injectable()
export class CashRegisterService {
  constructor(
    @InjectModel(CashRegisterSession.name)
    private sessionModel: Model<CashRegisterSessionDocument>,
    @InjectModel(CashRegisterEvent.name)
    private eventModel: Model<CashRegisterEventDocument>,
    // Solo para el resumen del cierre: se agrega en Mongo, no se traen los
    // documentos. Ver `getResumenDeSesion`.
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
  ) {}

  async openSession(dto: OpenSessionDto) {
    const existing = await this.sessionModel
      .findOne({ userId: dto.userId, status: 'open' })
      .lean()
      .exec();
    if (existing) {
      throw new BadRequestException('El usuario ya tiene una caja abierta');
    }

    const created = await this.sessionModel.create({
      userId: dto.userId,
      userName: dto.userName,
      status: 'open',
      openedAt: new Date(),
      closedAt: null,
      summary: null,
    });

    await this.eventModel.create({
      sessionId: created._id,
      type: 'session_opened',
      description: `Caja abierta por ${dto.userName}`,
      orderId: null,
      amount: null,
      createdAt: new Date(),
    });

    return this.serializeSession(created);
  }

  async closeSession(sessionId: string, dto: CloseSessionDto) {
    const session = await this.sessionModel.findById(sessionId).exec();
    if (!session) {
      throw new NotFoundException('Sesion no encontrada');
    }
    if (session.status === 'closed') {
      throw new BadRequestException('La sesion ya esta cerrada');
    }

    session.status = 'closed';
    session.closedAt = new Date();
    session.summary = dto.summary as SessionSummary;
    await session.save();

    await this.eventModel.create({
      sessionId: session._id,
      type: 'session_closed',
      description: `Caja cerrada — ${dto.summary.totalOrders} ordenes, $${dto.summary.totalAmount.toFixed(2)}`,
      orderId: null,
      amount: dto.summary.totalAmount,
      createdAt: new Date(),
    });

    return this.serializeSession(session);
  }

  async getActiveSession(userId: string) {
    const session = await this.sessionModel
      .findOne({ userId, status: 'open' })
      .lean()
      .exec();
    if (!session) return null;
    return this.serializeSession(session);
  }

  async getSessionHistory(userId: string, limit = 20) {
    const sessions = await this.sessionModel
      .find({ userId, status: 'closed' })
      .sort({ closedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
    return sessions.map((s) => this.serializeSession(s));
  }

  async getSessionById(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId).lean().exec();
    if (!session) throw new NotFoundException('Sesion no encontrada');
    return this.serializeSession(session);
  }

  /**
   * El resumen del cierre, calculado aca y no en el telefono.
   *
   * Ver `resumen-de-caja.util.ts` para el porque: la pantalla se bajaba los
   * 4.336 pagos del negocio (247 KB) para sumar los de una sesion, y ademas
   * leia el campo de metodo con el nombre equivocado.
   */
  async getResumenDeSesion(sessionId: string): Promise<ResumenDeCaja> {
    const session = await this.sessionModel.findById(sessionId).lean().exec();
    if (!session) throw new NotFoundException('Sesion no encontrada');

    const desde = session.openedAt ? new Date(session.openedAt) : new Date(0);
    // Una sesion abierta se suma "hasta ahora"; una cerrada, hasta su cierre.
    const hasta = session.closedAt ? new Date(session.closedAt) : new Date();

    const filas = await this.paymentModel
      .aggregate<FilaPorMetodo>(pipelineDeResumenDeCaja(desde, hasta))
      .exec();

    return armarResumenDeCaja(filas, desde, hasta);
  }

  async logEvent(sessionId: string, dto: LogEventDto) {
    const session = await this.sessionModel.findById(sessionId).lean().exec();
    if (!session) throw new NotFoundException('Sesion no encontrada');

    const event = await this.eventModel.create({
      sessionId,
      type: dto.type,
      description: dto.description,
      orderId: dto.orderId ?? null,
      amount: dto.amount ?? null,
      createdAt: new Date(),
    });

    return this.serializeEvent(event);
  }

  async getSessionEvents(sessionId: string) {
    const events = await this.eventModel
      .find({ sessionId })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return events.map((e) => this.serializeEvent(e));
  }

  private serializeSession(
    session: CashRegisterSession | Record<string, unknown>,
  ) {
    const obj =
      typeof (session as { toObject?: () => unknown }).toObject === 'function'
        ? (session as { toObject: () => Record<string, unknown> }).toObject()
        : (session as Record<string, unknown>);
    return {
      ...obj,
      id: String(obj._id),
    };
  }

  private serializeEvent(event: CashRegisterEvent | Record<string, unknown>) {
    const obj =
      typeof (event as { toObject?: () => unknown }).toObject === 'function'
        ? (event as { toObject: () => Record<string, unknown> }).toObject()
        : (event as Record<string, unknown>);
    return {
      ...obj,
      id: String(obj._id),
    };
  }
}
