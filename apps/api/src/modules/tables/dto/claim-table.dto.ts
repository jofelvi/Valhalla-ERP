import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClaimTableDto {
  @ApiProperty({ example: 'waiter-uid-123' })
  @IsString()
  waiterId: string;

  @ApiPropertyOptional({ example: 'Juan Perez' })
  @IsOptional()
  @IsString()
  waiterName?: string;
}

export class ReleaseTableDto {
  @ApiProperty({ example: 'waiter-uid-123' })
  @IsString()
  waiterId: string;
}

export class HeartbeatTableDto {
  @ApiProperty({ example: 'waiter-uid-123' })
  @IsString()
  waiterId: string;
}
