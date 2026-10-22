import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class AcceptBudgetDto {
  @IsNumber()
  @Min(0)
  abonoAmount: number;

  @IsString()
  abonoMethod: string;

  @IsOptional()
  @IsString()
  abonoReference?: string;
}
