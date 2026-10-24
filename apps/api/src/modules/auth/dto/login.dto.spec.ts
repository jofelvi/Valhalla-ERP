import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('acepta el correo con espacios al borde (teclado del telefono)', async () => {
    const dto = plainToInstance(LoginDto, {
      email: '  Usuario@Correo.com ',
      password: 'secreto1',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('Usuario@Correo.com');
  });

  it('sigue rechazando lo que no es un correo', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'no-es-correo',
      password: 'secreto1',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
