import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Reseteo de contraseña por un admin (no exige la contraseña anterior).
 *
 * Va en su propio DTO y su propia ruta a proposito: `UpdateUserDto` corre bajo
 * el ValidationPipe global con whitelist, que descarta en silencio cualquier
 * campo no declarado. Si `newPassword` viajara en el update normal se perderia
 * sin error — que es justo el bug que tenia la pantalla de reset.
 */
export class ResetPasswordDto {
  @ApiProperty({ example: 'nuevaClave123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  newPassword: string;
}
