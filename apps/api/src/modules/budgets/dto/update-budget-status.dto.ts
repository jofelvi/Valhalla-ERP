import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBudgetStatusDto {
  @ApiProperty({
    example: 'sent',
    enum: ['draft', 'sent', 'approved', 'rejected', 'expired'],
  })
  @IsString()
  @IsEnum(['draft', 'sent', 'approved', 'rejected', 'expired'])
  status: string;
}
