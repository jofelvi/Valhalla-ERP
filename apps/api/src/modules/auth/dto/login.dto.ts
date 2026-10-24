import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@ejemplo.com',
    description: 'Email del usuario',
  })
  // El teclado del telefono deja un espacio al final o capitaliza la primera letra: se normaliza antes de validar.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Test123!', description: 'Contrasena' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
