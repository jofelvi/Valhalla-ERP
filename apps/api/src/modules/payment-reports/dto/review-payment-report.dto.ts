import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApprovePaymentReportDto {
  @ApiPropertyOptional({ example: 'Pago verificado correctamente' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectPaymentReportDto {
  @ApiProperty({ example: 'Comprobante inválido' })
  @IsString()
  rejectionReason: string;

  @ApiPropertyOptional({ example: 'Favor reenviар comprobante válido' })
  @IsOptional()
  @IsString()
  notes?: string;
}
