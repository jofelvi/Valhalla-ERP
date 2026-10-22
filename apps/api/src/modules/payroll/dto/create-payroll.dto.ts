import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  ValidateNested,
  IsIn,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PeriodDto {
  @ApiProperty({ example: '2026-02-01' })
  @IsDateString()
  startDate: Date;

  @ApiProperty({ example: '2026-02-28' })
  @IsDateString()
  endDate: Date;

  @ApiProperty({ example: 2 })
  @IsNumber()
  month: number;

  @ApiProperty({ example: 2026 })
  @IsNumber()
  year: number;
}

class SalaryDto {
  @ApiProperty({ example: 2000 })
  @IsNumber()
  baseSalary: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  overtime: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  bonuses?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  commissions?: number;
}

class DeductionsDto {
  @ApiProperty({ example: 300 })
  @IsNumber()
  taxes: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  socialSecurity: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  insurance?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  other?: number;
}

export class CreatePayrollDto {
  @ApiProperty({ example: 'emp-123' })
  @IsString()
  employeeId: string;

  @ApiProperty({ type: PeriodDto })
  @ValidateNested()
  @Type(() => PeriodDto)
  period: PeriodDto;

  @ApiProperty({ type: SalaryDto })
  @ValidateNested()
  @Type(() => SalaryDto)
  salary: SalaryDto;

  @ApiProperty({ type: DeductionsDto })
  @ValidateNested()
  @Type(() => DeductionsDto)
  deductions: DeductionsDto;

  @ApiProperty({ example: 2200 })
  @IsNumber()
  grossPay: number;

  @ApiProperty({ example: 1750 })
  @IsNumber()
  netPay: number;

  @ApiPropertyOptional({ example: 160 })
  @IsOptional()
  @IsNumber()
  hoursWorked?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  overtimeHours?: number;

  @ApiPropertyOptional({ example: 'draft' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  paymentDate?: Date;

  @ApiPropertyOptional({ example: 'Sin notas' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proofUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  expenseDeductions?: Array<{
    accountReceivableId: string;
    amount: number;
    description: string;
  }>;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  daysWorked?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  dailyRate?: number;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  tips?: number;

  @ApiPropertyOptional({ example: 'WAITER' })
  @IsOptional()
  @IsIn(['WAITER', 'STAFF'])
  kind?: 'WAITER' | 'STAFF';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paidOrderIds?: string[];

  @ApiPropertyOptional({
    description:
      'Ajustes manuales: prestamos (DEDUCTION), propinas por fuera (ADDITION), etc.',
  })
  @IsOptional()
  @IsArray()
  adjustments?: Array<{
    type: 'ADDITION' | 'DEDUCTION';
    concept: string;
    amount: number;
    currency: 'USD' | 'BS';
    amountUsd: number;
  }>;
}
