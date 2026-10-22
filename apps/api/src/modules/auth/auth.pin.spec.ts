import { CONFIG_DEFAULTS, ConfigId } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Member } from '../public/schemas/member.schema';
import { EmailService } from '../sms/email.service';

/**
 * PIN de admin/manager: antes se comparaba en texto plano con un findOne
 * directo (`pin: trimmed`). Ahora vive hasheado en `pinHash` (bcrypt), con
 * compatibilidad hacia atras para los PIN historicos en texto plano — que
 * se migran solos al primer acierto.
 */
describe('AuthService.verifyAdminPin', () => {
  let service: AuthService;
  let userModel: { find: jest.Mock };

  function candidate(overrides: Record<string, unknown>) {
    return {
      _id: 'admin-1',
      name: 'Rosa',
      role: 'admin',
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  async function setup(candidates: unknown[]) {
    userModel = {
      find: jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve(candidates) }),
    };
    const customerModel = { findOne: jest.fn(), create: jest.fn() };
    const memberModel = { findOne: jest.fn() };
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
        { provide: getModelToken(Customer.name), useValue: customerModel },
        { provide: getModelToken(Member.name), useValue: memberModel },
        { provide: JwtService, useValue: { sign: () => 'jwt' } },
        { provide: EmailService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  }

  it('PIN correcto en texto plano (dato historico) -> valido y migra a pinHash', async () => {
    const admin = candidate({ pin: '1234' });
    await setup([admin]);

    const result = await service.verifyAdminPin('1234');

    expect(result).toEqual({
      valid: true,
      adminName: 'Rosa',
      adminId: 'admin-1',
      adminRole: 'admin',
    });
    expect(admin.save).toHaveBeenCalledTimes(1);
    expect(admin.pin).toBeUndefined();
    expect(typeof admin.pinHash).toBe('string');
    expect(admin.pinHash).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare('1234', admin.pinHash)).resolves.toBe(true);
  });

  it('PIN correcto ya hasheado en pinHash -> valido, no reescribe nada', async () => {
    const hash = await bcrypt.hash('4321', 10);
    const admin = candidate({ pinHash: hash });
    await setup([admin]);

    const result = await service.verifyAdminPin('4321');

    expect(result.valid).toBe(true);
    expect(admin.save).not.toHaveBeenCalled();
  });

  it('PIN incorrecto -> invalido (no rechaza con excepcion, valid:false)', async () => {
    const admin = candidate({ pin: '1234' });
    await setup([admin]);

    const result = await service.verifyAdminPin('0000');

    expect(result.valid).toBe(false);
    expect(result.adminName).toBeNull();
    expect(admin.save).not.toHaveBeenCalled();
  });

  it('PIN en blanco -> invalido sin tocar la base', async () => {
    await setup([]);
    const result = await service.verifyAdminPin('   ');
    expect(result.valid).toBe(false);
    expect(userModel.find).not.toHaveBeenCalled();
  });

  it('sin admin/manager con ese PIN -> invalido', async () => {
    await setup([candidate({ pin: '1234' })]);
    const result = await service.verifyAdminPin('9999');
    expect(result.valid).toBe(false);
  });
});
