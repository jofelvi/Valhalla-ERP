import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EventReservation,
  EventReservationDocument,
  ReservationPackage,
} from './schemas/event-reservation.schema';
import { CreateEventReservationDto } from './dto/create-event-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { ExchangeService } from '../exchange/exchange.service';
import { NotificationsService } from '../notifications/notifications.service';

const PACKAGE_PRICES_USD: Record<ReservationPackage, number> = {
  RON: 50,
  WHISKY: 100,
};

@Injectable()
export class EventReservationsService {
  private readonly logger = new Logger(EventReservationsService.name);

  constructor(
    @InjectModel(EventReservation.name)
    private readonly reservationModel: Model<EventReservationDocument>,
    private readonly exchangeService: ExchangeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getAvailability(eventSlug: string): Promise<{ takenTables: number[] }> {
    const active = await this.reservationModel
      .find(
        { eventSlug, status: { $in: ['PENDING', 'CONFIRMED'] } },
        { tableNumber: 1 },
      )
      .lean();
    return { takenTables: active.map((r) => r.tableNumber) };
  }

  async create(dto: CreateEventReservationDto) {
    const amountUsd = PACKAGE_PRICES_USD[dto.package];
    const { rate } = await this.exchangeService.getBcvRate();
    const amountBs = Math.round(amountUsd * rate * 100) / 100;

    try {
      const created = await this.reservationModel.create({
        ...dto,
        amountUsd,
        amountBs,
        bcvRate: rate,
        status: 'PENDING',
      });

      // Fire-and-forget: la notificación nunca bloquea la reserva
      this.notificationsService
        .sendReservationAlert({
          tableNumber: dto.tableNumber,
          packageLabel:
            dto.package === 'RON'
              ? 'Servicio de Ron ($50)'
              : "Buchanan's 12 ($100)",
          customerName: `${dto.firstName} ${dto.lastName}`,
          cedula: dto.cedula,
          phone: dto.phone,
          paymentReference: dto.paymentReference,
          amountUsd,
          amountBs,
        })
        .catch((err: unknown) =>
          this.logger.warn(`WhatsApp reservation alert fallo: ${err}`),
        );

      return created;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `La mesa ${dto.tableNumber} ya fue reservada. Elige otra mesa.`,
        );
      }
      throw error;
    }
  }

  async findAll(eventSlug?: string) {
    const filter = eventSlug ? { eventSlug } : {};
    return this.reservationModel.find(filter).sort({ tableNumber: 1 }).lean();
  }

  async updateStatus(id: string, dto: UpdateReservationStatusDto) {
    const updated = await this.reservationModel.findByIdAndUpdate(
      id,
      { status: dto.status },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException(`Reserva ${id} no encontrada`);
    }
    return updated;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: number }).code === 11000
    );
  }
}
