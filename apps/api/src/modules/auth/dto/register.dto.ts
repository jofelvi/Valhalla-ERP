import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Juan Perez', description: 'Nombre del usuario' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'juan@ejemplo.com',
    description: 'Email del usuario',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Test123!', description: 'Contrasena (min 6 chars)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    example: 'customer',
    description: 'Rol del usuario (default: customer)',
  })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: '+15550100', description: 'Telefono' })
  @IsString()
  @IsOptional()
  phone?: string;

  // ── Socio del club (opcional) ──
  // El movil busca la accion en el padron y, si el cliente se declara socio,
  // manda estos campos. Se persisten en el doc `customers` que se crea al
  // registrarse; sin el DTO, el ValidationPipe (whitelist) los descartaba.
  @ApiPropertyOptional({
    example: '00590',
    description: 'Numero de accion del socio',
  })
  @IsString()
  @IsOptional()
  memberAction?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Se declara socio principal',
  })
  @IsBoolean()
  @IsOptional()
  isMemberPrincipal?: boolean;
}
