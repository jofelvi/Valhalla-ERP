import { IsString, IsOptional, IsNotEmpty, MinLength } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateCreditRequestDto {
  @ApiPropertyOptional({
    example: 'Pago el viernes',
    description: 'Nota opcional del mesonero',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ApproveCreditRequestDto {
  @ApiProperty({
    example: '1234',
    description: 'PIN del administrador para aprobar la solicitud',
  })
  @IsNotEmpty({ message: 'PIN es obligatorio' })
  @IsString()
  pin: string;
}

export class RejectCreditRequestDto {
  @ApiProperty({
    example: 'Cliente no tiene saldo de crédito',
    description: 'Motivo del rechazo',
  })
  @IsNotEmpty({ message: 'Motivo del rechazo es obligatorio' })
  @IsString()
  @MinLength(1, { message: 'El motivo no puede estar vacío' })
  reason: string;
}
