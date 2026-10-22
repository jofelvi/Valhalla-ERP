import { IsIn } from 'class-validator';

export class UpdateReservationStatusDto {
  @IsIn(['CONFIRMED', 'CANCELLED'])
  status: 'CONFIRMED' | 'CANCELLED';
}
