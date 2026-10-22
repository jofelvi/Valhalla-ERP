import { CONFIG_DEFAULTS, ConfigId } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Member } from '../public/schemas/member.schema';
import { EmailService } from '../sms/email.service';
import { hashVerificationCode } from './verification-code.util';

describe('AuthService - verificacion de email', () => {
  let service: AuthService;
  let userModel: Record<string, jest.Mock>;
  const email = { send: jest.fn().mockResolvedValue({ sent: true }) };

  beforeEach(async () => {
    userModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigsService,
          useValue: {
            obtener: (id: ConfigId) => Promise.resolve(CONFIG_DEFAULTS[id]),
          },
        },
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: getModelToken(Customer.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              lean: () => ({ exec: () => Promise.resolve(null) }),
            }),
            create: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: getModelToken(Member.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              lean: () => ({ exec: () => Promise.resolve(null) }),
            }),
          },
        },
        { provide: JwtService, useValue: { sign: () => 'jwt-token' } },
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    email.send.mockClear();
  });

  it('register crea la cuenta sin verificar y manda el codigo por correo', async () => {
    userModel.findOne.mockResolvedValue(null);
    let createdArg: Record<string, unknown> = {};
    userModel.create.mockImplementation((doc: Record<string, unknown>) => {
      createdArg = doc;
      return Promise.resolve({
        ...doc,
        _id: 'u1',
        toObject: () => ({ ...doc, _id: 'u1' }),
      });
    });

    const res = await service.register({
      name: 'Ana',
      email: 'ana@test.com',
      password: 'secret123',
    });

    expect(createdArg.emailVerified).toBe(false);
    expect(typeof createdArg.verificationCodeHash).toBe('string');
    expect(createdArg.verificationExpiresAt).toBeInstanceOf(Date);
    expect(email.send).toHaveBeenCalledWith(
      'ana@test.com',
      expect.any(String),
      expect.stringContaining('codigo'),
    );
    // El hash guardado no revela el codigo enviado.
    expect(res.user).not.toHaveProperty('verificationCodeHash');
  });

  it('verifyEmail acepta el codigo correcto y marca verificado', async () => {
    const code = '424242';
    const user = {
      _id: 'u1',
      email: 'ana@test.com',
      emailVerified: false,
      verificationCodeHash: hashVerificationCode(code),
      verificationExpiresAt: new Date(Date.now() + 60_000),
      save: jest.fn().mockResolvedValue(true),
      toObject() {
        return { ...this };
      },
    };
    userModel.findOne.mockReturnValue({ exec: () => Promise.resolve(user) });

    const res = await service.verifyEmail('u1', code);

    expect(user.emailVerified).toBe(true);
    expect(user.verificationCodeHash).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
    expect(res.user.emailVerified).toBe(true);
  });

  it('verifyEmail rechaza codigo incorrecto', async () => {
    const user = {
      _id: 'u1',
      emailVerified: false,
      verificationCodeHash: hashVerificationCode('111111'),
      verificationExpiresAt: new Date(Date.now() + 60_000),
      save: jest.fn(),
      toObject() {
        return { ...this };
      },
    };
    userModel.findOne.mockReturnValue({ exec: () => Promise.resolve(user) });

    await expect(service.verifyEmail('u1', '000000')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(user.save).not.toHaveBeenCalled();
  });

  it('resendVerification regenera y reenvia si no esta verificado', async () => {
    const user = {
      _id: 'u1',
      email: 'ana@test.com',
      name: 'Ana',
      emailVerified: false,
      verificationCodeHash: 'old',
      verificationExpiresAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
      toObject() {
        return { ...this };
      },
    };
    userModel.findOne.mockReturnValue({ exec: () => Promise.resolve(user) });

    const res = await service.resendVerification('u1');

    expect(res.alreadyVerified).toBe(false);
    expect(user.verificationCodeHash).not.toBe('old');
    expect(email.send).toHaveBeenCalled();
  });

  it('resendVerification no manda nada si ya esta verificado', async () => {
    const user = {
      _id: 'u1',
      email: 'ana@test.com',
      emailVerified: true,
      save: jest.fn(),
      toObject() {
        return { ...this };
      },
    };
    userModel.findOne.mockReturnValue({ exec: () => Promise.resolve(user) });

    const res = await service.resendVerification('u1');

    expect(res.alreadyVerified).toBe(true);
    expect(email.send).not.toHaveBeenCalled();
  });
});
