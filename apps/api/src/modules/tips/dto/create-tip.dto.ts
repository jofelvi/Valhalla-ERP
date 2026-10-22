import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateTipDto {
  @ApiProperty({ example: 'order123', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'waiter123', description: 'Waiter ID' })
  @IsString()
  @IsNotEmpty()
  waiterId: string;

  @ApiProperty({ example: 'Juan Perez', description: 'Waiter name' })
  @IsString()
  @IsNotEmpty()
  waiterName: string;

  @ApiProperty({ example: 10.5, description: 'Tip amount' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 'user123', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
