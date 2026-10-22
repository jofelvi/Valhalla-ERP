import {
  IsString,
  IsNumber,
  IsNotEmpty,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para crear una solicitud de transferencia de mesa entre camareros.
 * El toWaiterId y porcentajes se envían en el body, pero la identidad
 * (fromWaiterId) siempre viene del JWT (req.user.id).
 */
export class CreateTransferRequestDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'ID del camarero que recibe la mesa',
  })
  @IsNotEmpty({ message: 'toWaiterId es obligatorio' })
  @IsString()
  toWaiterId: string;

  @ApiProperty({
    example: 40,
    description: 'Porcentaje de comisión para quien cede (fromWaiter)',
  })
  @IsNotEmpty({ message: 'fromPct es obligatorio' })
  @IsNumber()
  @Min(0, { message: 'fromPct no puede ser negativo' })
  @Max(100, { message: 'fromPct no puede exceder 100' })
  fromPct: number;

  @ApiProperty({
    example: 60,
    description: 'Porcentaje de comisión para quien recibe (toWaiter)',
  })
  @IsNotEmpty({ message: 'toPct es obligatorio' })
  @IsNumber()
  @Min(0, { message: 'toPct no puede ser negativo' })
  @Max(100, { message: 'toPct no puede exceder 100' })
  toPct: number;
}

/**
 * DTO para aceptar una solicitud de transferencia.
 * No requiere body — solo validamos que req.user.id sea el toWaiterId.
 */
export class AcceptTransferRequestDto {
  // Body vacío — identidad viene del JWT
}

/**
 * DTO para rechazar una solicitud de transferencia.
 * No requiere body — solo validamos que req.user.id sea el toWaiterId.
 */
export class RejectTransferRequestDto {
  @ApiProperty({
    example: 'Prefiero no tomarla en este momento',
    description: 'Motivo opcional del rechazo',
    required: false,
  })
  @ValidateIf((o) => o.reason !== undefined)
  @IsString()
  reason?: string;
}

/**
 * DTO para cancelar una solicitud de transferencia.
 * No requiere body — solo validamos que req.user.id sea el fromWaiterId.
 */
export class CancelTransferRequestDto {
  @ApiProperty({
    example: 'Cambié de idea',
    description: 'Motivo opcional de la cancelación',
    required: false,
  })
  @ValidateIf((o) => o.reason !== undefined)
  @IsString()
  reason?: string;
}
