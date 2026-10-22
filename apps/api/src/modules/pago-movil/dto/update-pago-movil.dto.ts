import { PartialType } from '@nestjs/swagger';
import { CreatePagoMovilDto } from './create-pago-movil.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class UpdatePagoMovilDto extends PartialType(CreatePagoMovilDto) {}

export class VerifyPagoMovilDto {
  @ApiProperty({ example: '12345678', description: 'Reference number' })
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @ApiProperty({
    example: 100,
    description: 'Actual amount received USD',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  actualAmountUSD?: number;

  @ApiProperty({
    example: 'verified',
    description: 'Verification status',
    required: false,
  })
  @IsString()
  @IsOptional()
  status?: string;
}
