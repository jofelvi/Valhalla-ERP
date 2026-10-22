import { IsString, IsBoolean, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTableStatusDto {
  @ApiProperty({ example: 'OCCUPIED' })
  @IsString()
  status: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isAvailable: boolean;

  // La APK envia `orderId: null` al liberar la mesa tras un cobro.
  // IsOptional solo salta validacion si la key falta — con null explicito
  // dispara IsString. ValidateIf permite null.
  @ApiPropertyOptional({ example: 'order-id-123', nullable: true })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  orderId?: string | null;
}
