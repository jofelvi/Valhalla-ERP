import { CONFIG_DEFAULTS, ConfigId } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Member } from '../public/schemas/member.schema';
import { EmailService } from '../sms/email.service';

describe('AuthService.register — no acepta rol arbitrario', () => {
  let service: AuthService;
  let userModel: Record<string, jest.Mock>;
  let createdUser: Record<string, unknown> | null;

  const lean = (val: unknown) => ({
    lean: () => ({ exec: () => Promise.resolve(val) }),
  });

  beforeEach(async () => {
    createdUser = null;
    userModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((doc: Record<string, unknown>) => {
        createdUser = doc;
        return Promise.resolve({
          ...doc,
          _id: 'user-1',
          toObject: () => ({ ...doc, _id: 'user-1' }),
        });
      }),
    };
    const customerModel = {
      findOne: jest.fn().mockReturnValue(lean(null)),
      create: jest.fn().mockResolvedValue({}),
    };
    const memberModel = { findOne: jest.fn().mockReturnValue(lean(null)) };
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
        {
          provide: EmailService,
          useValue: { send: jest.fn().mockResolvedValue({ sent: true }) },
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('registro anonimo con role:"admin" en el payload -> queda CUSTOMER', async () => {
    await service.register({
      name: 'Ana',
      email: 'ana@t.com',
      password: 'secret1',
      role: 'admin',
    });
    expect(createdUser?.role).toBe('customer');
  });

  it('registro con actor autenticado pero NO admin (ej. waiter) -> ignora el role pedido', async () => {
    await service.register(
      { name: 'Ana', email: 'ana@t.com', password: 'secret1', role: 'admin' },
      { id: 'waiter-1', role: 'waiter' },
    );
    expect(createdUser?.role).toBe('customer');
  });

  it('registro sin role en el payload -> CUSTOMER por defecto', async () => {
    await service.register({
      name: 'Ana',
      email: 'ana@t.com',
      password: 'secret1',
    });
    expect(createdUser?.role).toBe('customer');
  });

  it('alta de personal por un ADMIN autenticado -> respeta el role pedido', async () => {
    await service.register(
      {
        name: 'Carlos',
        email: 'carlos@t.com',
        password: 'secret1',
        role: 'cashier',
      },
      { id: 'admin-1', role: 'admin' },
    );
    expect(createdUser?.role).toBe('cashier');
  });

  it('ADMIN autenticado con un role invalido -> igual cae a CUSTOMER', async () => {
    await service.register(
      {
        name: 'Carlos',
        email: 'carlos@t.com',
        password: 'secret1',
        role: 'superadmin',
      },
      { id: 'admin-1', role: 'admin' },
    );
    expect(createdUser?.role).toBe('customer');
  });
});
