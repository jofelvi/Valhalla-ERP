import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePayrollStatusDto {
  @ApiProperty({
    example: 'approved',
    enum: ['draft', 'approved', 'paid', 'cancelled'],
  })
  @IsString()
  @IsEnum(['draft', 'approved', 'paid', 'cancelled'])
  status: string;
}
