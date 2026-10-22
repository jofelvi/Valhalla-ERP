import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { PushService } from '../push/push.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    private readonly push: PushService,
  ) {}

  async createOrGet(dto: CreateChatDto) {
    const existing = await this.chatModel
      .findOne({ _id: dto.orderId })
      .lean()
      .exec();
    if (existing) return this.serialize(existing);

    const created = await this.chatModel.create({
      _id: dto.orderId,
      orderId: dto.orderId,
      customerId: dto.customerId,
      customerName: dto.customerName,
      waiterId: dto.waiterId,
      waiterName: dto.waiterName,
      messages: [],
      status: 'active',
    });
    return this.serialize(created);
  }

  async getByOrderId(orderId: string) {
    const chat = await this.chatModel.findOne({ _id: orderId }).lean().exec();
    if (!chat) return null;
    return this.serialize(chat);
  }

  async sendMessage(orderId: string, dto: SendMessageDto) {
    const chat = await this.chatModel.findOne({ _id: orderId }).exec();
    if (!chat) throw new NotFoundException('Chat no encontrado');

    chat.messages.push({
      senderId: dto.senderId,
      senderName: dto.senderName,
      senderRole: dto.senderRole,
      text: dto.text,
      location: dto.location ?? null,
      timestamp: new Date(),
    });

    const saved = await chat.save();

    // Push al OTRO participante (el que no envio). Fire-and-forget: un fallo de
    // aviso no puede tumbar el envio del mensaje.
    const recipientId =
      dto.senderRole === 'customer' ? chat.waiterId : chat.customerId;
    if (recipientId) {
      void this.push
        .sendToUsers([String(recipientId)], {
          title: dto.senderName,
          body: dto.text.slice(0, 110),
          channelId: 'kitchen',
          data: { type: 'chat', orderId },
        })
        .catch(() => undefined);
    }

    return this.serialize(saved);
  }

  async close(orderId: string) {
    const chat = await this.chatModel
      .findOneAndUpdate({ _id: orderId }, { status: 'closed' }, { new: true })
      .lean()
      .exec();
    if (!chat) throw new NotFoundException('Chat no encontrado');
    return this.serialize(chat);
  }

  private serialize(chat: Chat | Record<string, unknown>) {
    const obj =
      typeof (chat as { toObject?: () => unknown }).toObject === 'function'
        ? (chat as { toObject: () => Record<string, unknown> }).toObject()
        : (chat as Record<string, unknown>);
    return { ...obj, id: String(obj._id) };
  }
}
