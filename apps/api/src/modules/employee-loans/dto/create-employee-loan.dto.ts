import { IsString, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeLoanDto {
  @ApiProperty({ example: 'emp-123' })
  @IsString()
  employeeId: string;

  @ApiProperty({ example: 20, description: 'Monto en USD' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'Préstamo personal' })
  @IsString()
  concept: string;

  @ApiPropertyOptional({ example: 652.97 })
  @IsOptional()
  @IsNumber()
  bcvRateAtLoan?: number;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  grantedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
