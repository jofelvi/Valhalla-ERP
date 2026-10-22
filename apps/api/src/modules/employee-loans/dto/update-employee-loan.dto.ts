import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmployeeLoanDto {
  @ApiPropertyOptional({ enum: ['pending', 'deducted', 'cancelled'] })
  @IsOptional()
  @IsIn(['pending', 'deducted', 'cancelled'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deductedPayrollId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deductedAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
