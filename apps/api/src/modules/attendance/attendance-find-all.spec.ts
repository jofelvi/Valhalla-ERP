/**
 * `onlyOpenEntries` es opt-in: sin el parametro el endpoint devuelve lo de
 * siempre (lo usan nomina, reportes y el APK); con el, solo las entradas sin
 * salida, que es lo unico que necesita la pantalla de marcar entrada.
 */
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AttendanceService } from './attendance.service';
import { Attendance } from './schemas/attendance.schema';
import { AttendanceSettingsService } from './attendance-settings.service';
import { ConfigsService } from '../configs/configs.service';
import { OPERACION_DEFAULT } from '@odin6/types';

/** Consulta falsa que anota cada `where(campo).equals(valor)` pedido. */
const consultaQueAnota = (resultado: unknown[]) => {
  const filtros: Array<[string, unknown]> = [];
  let campo = '';
  const q = {
    where: (c: string) => {
      campo = c;
      return q;
    },
    equals: (v: unknown) => {
      filtros.push([campo, v]);
      return q;
    },
    gte: () => q,
    lte: () => q,
    lt: () => q,
    lean: () => q,
    exec: () => Promise.resolve(resultado),
  };
  return { q, filtros };
};

describe('AttendanceService.findAll — onlyOpenEntries', () => {
  let service: AttendanceService;
  const find = jest.fn();

  beforeEach(async () => {
    find.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getModelToken(Attendance.name), useValue: { find } },
        {
          provide: ConfigsService,
          useValue: { obtener: async () => OPERACION_DEFAULT },
        },
        { provide: AttendanceSettingsService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(AttendanceService);
  });

  it('sin el parametro no filtra por salida (los demas consumidores no cambian)', async () => {
    const { q, filtros } = consultaQueAnota([]);
    find.mockReturnValue(q);

    await service.findAll({ employeeId: 'emp-1' });

    expect(filtros).toEqual([['employeeId', 'emp-1']]);
  });

  it('con el parametro pide solo las entradas sin salida', async () => {
    const { q, filtros } = consultaQueAnota([]);
    find.mockReturnValue(q);

    await service.findAll({ employeeId: 'emp-1', onlyOpenEntries: true });

    expect(filtros).toEqual([
      ['employeeId', 'emp-1'],
      ['checkOut', null],
    ]);
  });

  it('devuelve cada registro con su id', async () => {
    const { q } = consultaQueAnota([{ _id: 'a-1', employeeId: 'emp-1' }]);
    find.mockReturnValue(q);

    const r = await service.findAll({ onlyOpenEntries: true });

    expect(r).toEqual([{ _id: 'a-1', id: 'a-1', employeeId: 'emp-1' }]);
  });
});
