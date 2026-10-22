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

describe('AuthService - crea el customer al registrarse', () => {
  let service: AuthService;
  let userModel: Record<string, jest.Mock>;
  let customerModel: Record<string, jest.Mock>;
  let memberModel: Record<string, jest.Mock>;
  let createdCustomer: Record<string, unknown> | null;
  let padron: Record<string, unknown> | null;

  const lean = (val: unknown) => ({
    lean: () => ({ exec: () => Promise.resolve(val) }),
  });

  beforeEach(async () => {
    createdCustomer = null;
    padron = null;
    userModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((doc: Record<string, unknown>) =>
        Promise.resolve({
          ...doc,
          _id: 'user-1',
          toObject: () => ({ ...doc, _id: 'user-1' }),
        }),
      ),
    };
    customerModel = {
      findOne: jest.fn().mockReturnValue(lean(null)), // no existe aun
      create: jest.fn().mockImplementation((doc: Record<string, unknown>) => {
        createdCustomer = doc;
        return Promise.resolve({ ...doc, toObject: () => ({ ...doc }) });
      }),
    };
    memberModel = {
      findOne: jest.fn().mockImplementation(() => lean(padron)),
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

  it('crea un doc customers con el mismo _id del usuario', async () => {
    await service.register({
      name: 'Ana',
      email: 'ana@t.com',
      password: 'secret1',
      phone: '+58412',
    });
    expect(customerModel.create).toHaveBeenCalledTimes(1);
    expect(createdCustomer?._id).toBe('user-1');
    expect(createdCustomer?.name).toBe('Ana');
    expect(createdCustomer?.email).toBe('ana@t.com');
    expect(createdCustomer?.phone).toBe('+58412');
    expect(createdCustomer?.linkedUserId).toBe('user-1');
  });

  it('socio en el padron -> normaliza a padded, guarda y NO queda sin verificar', async () => {
    padron = { _id: '00590', accion: 590, cedula: 'V-1', nombre: 'Ana' };
    // El movil manda "590"; se normaliza a "00590" y se verifica por _id o accion.
    await service.register({
      name: 'Ana',
      email: 'ana@t.com',
      password: 'secret1',
      memberAction: '590',
      isMemberPrincipal: true,
    });
    expect(memberModel.findOne).toHaveBeenCalledWith({
      $or: [{ _id: '00590' }, { accion: 590 }],
    });
    expect(createdCustomer?.memberAction).toBe('00590');
    expect(createdCustomer?.isMemberPrincipal).toBe(true);
    expect(createdCustomer?.isUnverifiedMember).toBe(false);
  });

  it('socio NO en el padron -> queda isUnverifiedMember=true (sin credito hasta revisar)', async () => {
    padron = null;
    await service.register({
      name: 'Ana',
      email: 'ana@t.com',
      password: 'secret1',
      memberAction: '9999',
      isMemberPrincipal: true,
    });
    expect(createdCustomer?.memberAction).toBe('09999');
    expect(createdCustomer?.isUnverifiedMember).toBe(true);
  });

  it('sin membresia -> customer sin memberAction', async () => {
    await service.register({
      name: 'Ana',
      email: 'ana@t.com',
      password: 'secret1',
    });
    expect(createdCustomer?.memberAction).toBeUndefined();
    expect(memberModel.findOne).not.toHaveBeenCalled();
  });

  it('si ya existe el customer, no lo duplica', async () => {
    customerModel.findOne.mockReturnValue(lean({ _id: 'user-1' }));
    await service.register({
      name: 'Ana',
      email: 'ana@t.com',
      password: 'secret1',
    });
    expect(customerModel.create).not.toHaveBeenCalled();
  });
});
