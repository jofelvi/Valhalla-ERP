import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RESERVATION_PACKAGES } from '../schemas/event-reservation.schema';
import type { ReservationPackage } from '../schemas/event-reservation.schema';

export class CreateEventReservationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  eventSlug: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  tableNumber: number;

  @IsIn(RESERVATION_PACKAGES)
  package: ReservationPackage;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[VEve]?-?\d{5,10}$/, { message: 'Cédula inválida' })
  cedula: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{10,14}$/, { message: 'Teléfono inválido' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  paymentReference: string;
}
