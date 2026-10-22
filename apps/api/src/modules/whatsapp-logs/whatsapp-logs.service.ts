import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WhatsappMessageLog,
  WhatsappMessageLogDocument,
  WhatsappMessageStatus,
} from './schemas/whatsapp-message-log.schema';

interface CreateLogInput {
  messageId: string;
  to: string;
  template?: string;
  accountReceivableId?: string;
  customerName?: string;
  orderCode?: string;
  amount?: string;
}

interface UpdateStatusInput {
  messageId: string;
  status: WhatsappMessageStatus;
  timestamp?: Date;
  errorCode?: number;
  errorTitle?: string;
  errorMessage?: string;
  raw?: Record<string, unknown>;
}

@Injectable()
export class WhatsappLogsService {
  private readonly logger = new Logger(WhatsappLogsService.name);

  constructor(
    @InjectModel(WhatsappMessageLog.name)
    private readonly model: Model<WhatsappMessageLogDocument>,
  ) {}

  async create(input: CreateLogInput): Promise<WhatsappMessageLogDocument> {
    const doc = await this.model.create({
      ...input,
      status: 'sent' as WhatsappMessageStatus,
      sentAt: new Date(),
    });
    return doc;
  }

  async updateStatus(input: UpdateStatusInput): Promise<void> {
    const update: Record<string, unknown> = {
      status: input.status,
      lastWebhookRaw: input.raw,
    };
    const ts = input.timestamp ?? new Date();
    if (input.status === 'delivered') update.deliveredAt = ts;
    if (input.status === 'read') update.readAt = ts;
    if (input.status === 'failed') {
      update.failedAt = ts;
      if (input.errorCode !== undefined) update.errorCode = input.errorCode;
      if (input.errorTitle) update.errorTitle = input.errorTitle;
      if (input.errorMessage) update.errorMessage = input.errorMessage;
    }

    const res = await this.model.updateOne(
      { messageId: input.messageId },
      { $set: update },
    );
    if (res.matchedCount === 0) {
      this.logger.warn(
        `updateStatus: no log found for messageId=${input.messageId} (status=${input.status})`,
      );
    }
  }

  findByAccount(accountReceivableId: string, limit = 20) {
    return this.model
      .find({ accountReceivableId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  findRecent(limit = 100, filter: Record<string, unknown> = {}) {
    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async stats() {
    const agg = await this.model.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const base: Record<string, number> = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      unknown: 0,
    };
    for (const row of agg) base[row._id] = row.count;
    return base;
  }
}
