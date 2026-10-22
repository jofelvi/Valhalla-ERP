import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsPhoneNumber,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'juan@example.com' })
  // Los forms envian '' cuando el campo queda vacio; sin esto @IsEmail() da 400
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+15550100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Calle 5, Apt 10' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '12345678' })
  @IsOptional()
  @IsString()
  identificationId?: string;

  @ApiPropertyOptional({ example: 'V' })
  @IsOptional()
  @IsString()
  identificationType?: string;

  @ApiPropertyOptional({ example: 'J-90000003-0' })
  @IsOptional()
  @IsString()
  rif?: string;

  @ApiPropertyOptional({ example: 'user-123' })
  @IsOptional()
  @IsString()
  linkedUserId?: string;

  @ApiPropertyOptional({ example: '00590' })
  @IsOptional()
  @IsString()
  memberAction?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isMemberPrincipal?: boolean;

  // Alta manual de socio cuya acción no está en el padrón del club: queda
  // marcada para revisión y sin crédito.
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isUnverifiedMember?: boolean;

  @ApiPropertyOptional({ example: ['laura tenis'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nameAliases?: string[];

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  memberCreditLimit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  memberCreditUsed?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  memberCreditMonthsPaid?: number;
}
