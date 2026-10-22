import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MergeAccountsDto {
  @ApiProperty({ example: ['acc-1', 'acc-2', 'acc-3'] })
  @IsArray()
  @IsString({ each: true })
  accountIds: string[];
}

export class UnmergeAccountDto {
  @ApiProperty({ example: 'acc-consolidated-123' })
  @IsString()
  accountId: string;
}
