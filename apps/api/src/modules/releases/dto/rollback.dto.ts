import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReleaseAmbitoEnum } from '@odin6/types';

export class RollbackDto {
  @ApiProperty({ enum: ReleaseAmbitoEnum, example: 'api' })
  @IsEnum(ReleaseAmbitoEnum)
  ambito: ReleaseAmbitoEnum;

  @ApiProperty({ example: '1234' })
  @IsString()
  @IsNotEmpty()
  pin: string;
}
