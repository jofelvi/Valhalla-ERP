import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ExpensesReportService } from './expenses-report.service';

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let expensesService: Record<string, jest.Mock>;
  let reportService: Record<string, jest.Mock>;

  beforeEach(async () => {
    expensesService = {
      porPagar: jest.fn().mockResolvedValue([]),
      reembolsosPendientes: jest.fn().mockResolvedValue([]),
      listar: jest.fn().mockResolvedValue([]),
      marcarPagado: jest.fn(),
      marcarReembolsado: jest.fn(),
    };

    reportService = {
      semana: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [
        {
          provide: ExpensesService,
          useValue: expensesService,
        },
        {
          provide: ExpensesReportService,
          useValue: reportService,
        },
      ],
    }).compile();

    controller = module.get<ExpensesController>(ExpensesController);
  });

  describe('listar', () => {
    it('debe convertir parametros from y to a fechas validas', () => {
      const from = '2026-09-01';
      const to = '2026-09-30';

      controller.listar(from, to);

      expect(expensesService.listar).toHaveBeenCalledWith(
        expect.objectContaining({
          desde: expect.any(Date),
          hasta: expect.any(Date),
        }),
      );
    });

    it('rechaza si from o to son inválidos (antes arrojaba 500)', () => {
      const from = 'invalid-date';
      const to = '2026-09-30';

      expect(() => {
        controller.listar(from, to);
      }).toThrow(BadRequestException);
      expect(() => {
        controller.listar(from, to);
      }).toThrow(/inválida/);
    });

    it('rechaza si no se pasan from y to', () => {
      expect(() => {
        controller.listar(undefined as never, '2026-09-30');
      }).toThrow(BadRequestException);
      expect(() => {
        controller.listar('2026-09-01', undefined as never);
      }).toThrow(BadRequestException);
    });

    it('rechaza si from o to es string vacío', () => {
      expect(() => {
        controller.listar('', '2026-09-30');
      }).toThrow(BadRequestException);
    });

    it('acepta fechas en ISO 8601', () => {
      const from = '2026-09-01T00:00:00Z';
      const to = '2026-09-30T23:59:59Z';

      controller.listar(from, to);

      expect(expensesService.listar).toHaveBeenCalled();
    });
  });
});
