import { CONFIG_DEFAULTS, ConfigId } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Member } from '../public/schemas/member.schema';
import { EmailService } from '../sms/email.service';

/**
 * UNA CUENTA SIN CLAVE NO ADOPTA LA QUE SE ESCRIBA.
 *
 * El login traia esto de la migracion: si el usuario no tenia passwordHash
 * (los que vinieron de Firebase llegaron asi), guardaba como clave definitiva
 * lo que se tecleara en ese intento. Quien supiera el correo de un empleado
 * entraba con la clave que se inventara y se quedaba con la cuenta.
 *
 * En produccion quedaban 7 cuentas asi, 3 activas, y una de rol ADMIN
 * (medido el 06/09/2026, ninguna habia entrado nunca).
 */
describe('AuthService — login de cuentas migradas sin clave', () => {
  let service: AuthService;
  let guardado: boolean;

  const construir = async (usuario: Record<string, unknown> | null) => {
    guardado = false;
    const doc = usuario
      ? {
          ...usuario,
          save: jest.fn().mockImplementation(() => {
            guardado = true;
            return Promise.resolve();
          }),
          toObject: () => ({ ...usuario }),
        }
      : null;

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigsService,
          useValue: {
            obtener: (id: ConfigId) => Promise.resolve(CONFIG_DEFAULTS[id]),
          },
        },
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: { findOne: jest.fn().mockResolvedValue(doc) },
        },
        { provide: getModelToken(Customer.name), useValue: {} },
        { provide: getModelToken(Member.name), useValue: {} },
        { provide: JwtService, useValue: { sign: () => 'jwt' } },
        { provide: EmailService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    return doc;
  };

  const BASE = {
    _id: 'u1',
    email: 'orlando@negocio.test',
    name: 'Orlando',
    role: 'admin',
    isActive: true,
  };

  it('sin passwordHash NO entra, aunque teclee cualquier cosa', async () => {
    await construir({ ...BASE });
    await expect(
      service.login({ email: BASE.email, password: 'lo-que-sea' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('y tampoco le graba esa clave: la cuenta queda como estaba', async () => {
    // Lo peligroso no era solo dejar pasar: era QUEDARSE con la cuenta.
    const doc = await construir({ ...BASE });
    await service
      .login({ email: BASE.email, password: 'me-la-invento' })
      .catch(() => null);
    expect(guardado).toBe(false);
    expect(doc?.passwordHash).toBeUndefined();
  });

  it('el mensaje dice que hacer, no "credenciales invalidas"', async () => {
    await construir({ ...BASE });
    await expect(
      service.login({ email: BASE.email, password: 'x' }),
    ).rejects.toThrow(/administracion/i);
  });

  it('con clave correcta entra normal', async () => {
    const hash = await bcrypt.hash('LaBuena123', 10);
    await construir({ ...BASE, passwordHash: hash });
    const r = await service.login({
      email: BASE.email,
      password: 'LaBuena123',
    });
    expect(r.accessToken).toBe('jwt');
  });

  it('con clave equivocada sigue siendo "credenciales invalidas"', async () => {
    const hash = await bcrypt.hash('LaBuena123', 10);
    await construir({ ...BASE, passwordHash: hash });
    await expect(
      service.login({ email: BASE.email, password: 'otra' }),
    ).rejects.toThrow(/invalidas/i);
  });

  it('una cuenta desactivada no entra ni con la clave buena', async () => {
    const hash = await bcrypt.hash('LaBuena123', 10);
    await construir({ ...BASE, isActive: false, passwordHash: hash });
    await expect(
      service.login({ email: BASE.email, password: 'LaBuena123' }),
    ).rejects.toThrow(/desactivado/i);
  });
});
