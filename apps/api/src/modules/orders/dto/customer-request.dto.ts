import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCustomerRequestDto {
  @IsEnum(['PRODUCT', 'CALL_WAITER', 'MISC'])
  type: 'PRODUCT' | 'CALL_WAITER' | 'MISC';

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}

export class ResolveCustomerRequestDto {
  @IsEnum(['ACCEPT', 'REJECT', 'ACK'])
  action: 'ACCEPT' | 'REJECT' | 'ACK';

  @IsOptional()
  @IsString()
  @MaxLength(280)
  rejectReason?: string;
}
