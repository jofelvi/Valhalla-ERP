import { PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  // ───── Candado anti-fraude ─────
  // Eliminar o reducir un item YA COMANDADO (sentQty > 0) exige PIN de
  // admin/manager + motivo. Sin esto el PATCH se rechaza con 428.
  @IsOptional()
  @IsString()
  editPin?: string;

  @IsOptional()
  @IsString()
  editReason?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    example: 'READY',
    description: 'New status',
  })
  @IsString()
  @IsNotEmpty()
  status: string;
}

export class AddOrderItemDto {
  @ApiProperty({ example: 'prod456', description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 'Fries', description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1, description: 'Quantity' })
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ example: 5, description: 'Unit price' })
  @IsNotEmpty()
  unitPrice: number;

  @ApiProperty({ example: 5, description: 'Total amount' })
  @IsNotEmpty()
  total: number;

  @ApiProperty({ example: 'Extra salt', description: 'Notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 'KITCHEN', description: 'Station', required: false })
  @IsString()
  @IsOptional()
  station?: string;

  @ApiProperty({ example: 'user123', description: 'Added by', required: false })
  @IsString()
  @IsOptional()
  addedBy?: string;
}
