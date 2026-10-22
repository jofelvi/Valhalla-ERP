import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { User } from '../auth/schemas/user.schema';
import { AccountReceivable } from '../accounts-receivable/schemas/account-receivable.schema';
import { EmailService } from '../sms/email.service';
import { AccountDeletionRequest } from './schemas/account-deletion-request.schema';
import {
  AccountDeletionService,
  mensajeDeBaja,
  resumirDeuda,
} from './account-deletion.service';

describe('resumirDeuda', () => {
  it('suma lo que falta en cada cuenta viva', () => {
    expect(
      resumirDeuda([
        { amount: 40, paidAmount: 10 },
        { amount: 20, paidAmount: 0 },
      ]),
    ).toEqual({ deuda: 50, cuentasVivas: 2 });
  });

  it('una cuenta pagada completa no suma deuda', () => {
    expect(resumirDeuda([{ amount: 20, paidAmount: 20 }])).toEqual({
      deuda: 0,
      cuentasVivas: 0,
    });
  });

  it('abonado mayor que el monto no resta deuda de otras cuentas', () => {
    // Dato sucio heredado: no debe compensar contra la otra cuenta.
    expect(
      resumirDeuda([
        { amount: 10, paidAmount: 99 },
        { amount: 30, paidAmount: 0 },
      ]),
    ).toEqual({ deuda: 30, cuentasVivas: 1 });
  });

  it('un centavo no cuenta como cuenta viva', () => {
    expect(resumirDeuda([{ amount: 10, paidAmount: 9.995 }])).toEqual({
      deuda: 0,
      cuentasVivas: 0,
    });
  });
});

describe('mensajeDeBaja', () => {
  it('con saldo: dice que se conserva el dato del cobro y cuánto debe', () => {
    const m = mensajeDeBaja('solo_acceso', 50);
    expect(m).toContain('$50.00');
    expect(m).toContain('conservaremos');
  });

  it('sin saldo: promete eliminar datos personales en 30 días', () => {
    const m = mensajeDeBaja('completa', 0);
    expect(m).toContain('30 días');
    expect(m).not.toContain('saldo pendiente');
  });
});

describe('AccountDeletionService.solicitar', () => {
  let service: AccountDeletionService;
  let solicitudes: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let usuarios: { findOne: jest.Mock };
  let cuentas: { find: jest.Mock };
  let email: { send: jest.Mock };

  const lean = (value: unknown) => ({
    lean: () => ({ exec: async () => value }),
  });

  beforeEach(async () => {
    solicitudes = {
      findOne: jest.fn().mockReturnValue(lean(null)),
      create: jest.fn().mockResolvedValue({ _id: 'sol-1' }),
    };
    usuarios = {
      findOne: jest
        .fn()
        .mockReturnValue(
          lean({
            _id: 'u1',
            email: 'ana@x.com',
            name: 'Ana',
            role: 'CUSTOMER',
          }),
        ),
    };
    cuentas = {
      find: jest.fn().mockReturnValue(lean([])),
    };
    email = { send: jest.fn().mockResolvedValue({ sent: true }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionService,
        {
          provide: getModelToken(AccountDeletionRequest.name),
          useValue: solicitudes,
        },
        { provide: getModelToken(User.name), useValue: usuarios },
        { provide: getModelToken(AccountReceivable.name), useValue: cuentas },
        { provide: EmailService, useValue: email },
        {
          provide: ConfigService,
          useValue: {
            get: (clave: string) =>
              clave === 'ACCOUNT_DELETION_NOTIFY_EMAIL' ? 'avisos@ejemplo.com' : undefined,
          },
        },
      ],
    }).compile();

    service = module.get(AccountDeletionService);
  });

  it('sin deuda: alcance completa y avisa al correo configurado', async () => {
    const r = await service.solicitar('u1');
    expect(r.alcance).toBe('completa');
    expect(r.deuda).toBe(0);
    expect(r.yaExistia).toBe(false);
    expect(email.send).toHaveBeenCalledWith(
      'avisos@ejemplo.com',
      expect.any(String),
      expect.stringContaining('Sin saldo pendiente'),
    );
  });

  it('con deuda: alcance solo_acceso y guarda el saldo del momento', async () => {
    cuentas.find.mockReturnValue(
      lean([
        { amount: 40, paidAmount: 10 },
        { amount: 20, paidAmount: 0 },
      ]),
    );
    const r = await service.solicitar('u1');
    expect(r.alcance).toBe('solo_acceso');
    expect(r.deuda).toBe(50);
    expect(solicitudes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        alcance: 'solo_acceso',
        deuda: 50,
        cuentasVivas: 2,
      }),
    );
  });

  it('si ya hay una pendiente, devuelve esa y no crea otra', async () => {
    solicitudes.findOne.mockReturnValue(
      lean({ _id: 'sol-9', estado: 'pending', alcance: 'completa', deuda: 0 }),
    );
    const r = await service.solicitar('u1');
    expect(r.yaExistia).toBe(true);
    expect(r.id).toBe('sol-9');
    expect(solicitudes.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('usuario inexistente: NotFound, sin crear nada', async () => {
    usuarios.findOne.mockReturnValue(lean(null));
    await expect(service.solicitar('nadie')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(solicitudes.create).not.toHaveBeenCalled();
  });

  it('si el correo falla, la solicitud igual queda registrada', async () => {
    email.send.mockResolvedValue({ sent: false, reason: 'http 500' });
    const r = await service.solicitar('u1');
    expect(r.id).toBe('sol-1');
    expect(solicitudes.create).toHaveBeenCalled();
  });
});
