import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { EventReservationsService } from './event-reservations.service';
import { EventReservation } from './schemas/event-reservation.schema';
import { ExchangeService } from '../exchange/exchange.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateEventReservationDto } from './dto/create-event-reservation.dto';

const baseDto: CreateEventReservationDto = {
  eventSlug: 'golazo-llanero',
  tableNumber: 5,
  package: 'RON',
  cedula: 'V-90000002-0',
  firstName: 'Juan',
  lastName: 'Pérez',
  phone: '+584120000007',
  paymentReference: '123456',
};

describe('EventReservationsService', () => {
  let service: EventReservationsService;
  const modelMock = {
    create: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };
  const exchangeMock = {
    getBcvRate: jest
      .fn()
      .mockResolvedValue({ rate: 100, source: 'test', timestamp: '' }),
  };
  const notificationsMock = {
    sendReservationAlert: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventReservationsService,
        { provide: getModelToken(EventReservation.name), useValue: modelMock },
        { provide: ExchangeService, useValue: exchangeMock },
        { provide: NotificationsService, useValue: notificationsMock },
      ],
    }).compile();
    service = moduleRef.get(EventReservationsService);
  });

  it('calcula montos server-side según el paquete (RON $50)', async () => {
    modelMock.create.mockImplementation((doc: Record<string, unknown>) =>
      Promise.resolve(doc),
    );
    const result = await service.create(baseDto);
    expect(result.amountUsd).toBe(50);
    expect(result.amountBs).toBe(5000);
    expect(result.bcvRate).toBe(100);
  });

  it('calcula $100 para paquete WHISKY', async () => {
    modelMock.create.mockImplementation((doc: Record<string, unknown>) =>
      Promise.resolve(doc),
    );
    const result = await service.create({ ...baseDto, package: 'WHISKY' });
    expect(result.amountUsd).toBe(100);
  });

  it('mapea E11000 (mesa duplicada) a ConflictException', async () => {
    const dupError = Object.assign(new Error('dup'), { code: 11000 });
    modelMock.create.mockRejectedValue(dupError);
    await expect(service.create(baseDto)).rejects.toThrow(ConflictException);
  });

  it('availability devuelve solo mesas PENDING/CONFIRMED', async () => {
    modelMock.find.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([{ tableNumber: 3 }, { tableNumber: 7 }]),
    });
    const result = await service.getAvailability('golazo-llanero');
    expect(result).toEqual({ takenTables: [3, 7] });
    expect(modelMock.find).toHaveBeenCalledWith(
      {
        eventSlug: 'golazo-llanero',
        status: { $in: ['PENDING', 'CONFIRMED'] },
      },
      { tableNumber: 1 },
    );
  });
});
