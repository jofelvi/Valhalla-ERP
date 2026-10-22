/**
 * El boton de revertir ejecuta un despliegue en el VPS. Este spec fija lo que
 * NUNCA debe pasar: que corra sin ADMIN, con PIN malo, con un sha manipulado,
 * o dos a la vez.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ReleaseAmbitoEnum } from '@odin6/types';
import { ReleasesService } from './releases.service';
import { Release } from './schemas/release.schema';
import { RollbackLock } from './schemas/rollback-lock.schema';
import { AuthService } from '../auth/auth.service';

const ENTRADA = {
  _id: 'r-1',
  fecha: new Date('2026-09-01T12:00:00Z'),
  ambito: [ReleaseAmbitoEnum.API],
  shas: { api: 'a1b2c3d' },
  migroDatos: false,
  titulo: 'Un cambio',
  cambios: [],
  commits: [],
  createdBy: 'u-1',
};

interface Armado {
  service: ReleasesService;
  ejecutados: string[][];
}

describe('ReleasesService.revertir', () => {
  let ejecutados: string[][];
  let verifyAdminPin: jest.Mock;
  let lockModel: Record<string, jest.Mock>;

  const armar = async (
    entrada: Record<string, unknown> = ENTRADA,
    posteriores: Record<string, unknown>[] = [],
  ): Promise<Armado> => {
    const releaseModel = {
      findById: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(entrada) }),
      }),
      find: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(posteriores) }),
      }),
      create: jest
        .fn()
        .mockImplementation((d: Record<string, unknown>) =>
          Promise.resolve({ toObject: () => ({ _id: 'r-nueva', ...d }) }),
        ),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ReleasesService,
        { provide: getModelToken(Release.name), useValue: releaseModel },
        { provide: getModelToken(RollbackLock.name), useValue: lockModel },
        { provide: AuthService, useValue: { verifyAdminPin } },
        {
          provide: 'EJECUTOR_ROLLBACK',
          useValue: (args: string[]) => {
            ejecutados.push(args);
            return Promise.resolve({ ok: true, salida: 'listo' });
          },
        },
      ],
    }).compile();
    return { service: moduleRef.get(ReleasesService), ejecutados };
  };

  beforeEach(() => {
    ejecutados = [];
    verifyAdminPin = jest.fn().mockResolvedValue({
      valid: true,
      adminName: 'Jefe',
      adminId: 'u-1',
      adminRole: 'admin',
    });
    lockModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ _id: 'lock' }) }),
      }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      findById: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ enCurso: false }) }),
      }),
    };
  });

  it('revierte y deja registro de lo que hizo', async () => {
    const { service } = await armar();
    const r = await service.revertir(
      'r-1',
      ReleaseAmbitoEnum.API,
      '1234',
      'u-1',
    );
    expect(ejecutados).toEqual([['api', 'a1b2c3d']]);
    expect(r.entradaCreada).toBeDefined();
  });

  it('rechaza el PIN invalido y NO ejecuta nada', async () => {
    verifyAdminPin.mockResolvedValue({ valid: false, adminName: null });
    const { service } = await armar();
    await expect(
      service.revertir('r-1', ReleaseAmbitoEnum.API, '0000', 'u-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ejecutados).toHaveLength(0);
  });

  it('rechaza el PIN de un MANAGER: revertir es solo de ADMIN', async () => {
    // verifyAdminPin da por bueno el PIN de ADMIN *y* de MANAGER.
    verifyAdminPin.mockResolvedValue({
      valid: true,
      adminName: 'Gerente',
      adminId: 'u-9',
      adminRole: 'manager',
    });
    const { service } = await armar();
    await expect(
      service.revertir('r-1', ReleaseAmbitoEnum.API, '1234', 'u-9'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ejecutados).toHaveLength(0);
  });

  it('rechaza un sha con caracteres raros sin ejecutar nada (inyeccion)', async () => {
    const { service } = await armar({
      ...ENTRADA,
      shas: { api: 'a1b2c3d; rm -rf /' },
    });
    await expect(
      service.revertir('r-1', ReleaseAmbitoEnum.API, '1234', 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ejecutados).toHaveLength(0);
  });

  it('BLOQUEA si una entrada posterior movio datos, sin ejecutar nada', async () => {
    const { service } = await armar(ENTRADA, [
      {
        _id: 'r-2',
        fecha: new Date('2026-09-03T12:00:00Z'),
        ambito: [ReleaseAmbitoEnum.API],
        shas: { api: 'bbbbbbb' },
        migroDatos: true,
        titulo: 'Inventario al entregar',
      },
    ]);
    await expect(
      service.revertir('r-1', ReleaseAmbitoEnum.API, '1234', 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ejecutados).toHaveLength(0);
  });

  it('rechaza el segundo rollback simultaneo', async () => {
    lockModel.findOneAndUpdate.mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(null) }),
    });
    const { service } = await armar();
    await expect(
      service.revertir('r-1', ReleaseAmbitoEnum.API, '1234', 'u-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ejecutados).toHaveLength(0);
  });
});
