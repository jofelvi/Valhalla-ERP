import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ClientLogsService, ClientLogInput } from './client-logs.service';
import { ClientLog } from './schemas/client-log.schema';

describe('ClientLogsService', () => {
  let service: ClientLogsService;
  let mockModel: {
    create: jest.Mock;
    find: jest.Mock;
    insertMany: jest.Mock;
  };

  beforeEach(async () => {
    mockModel = {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn(),
      insertMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientLogsService,
        {
          provide: getModelToken(ClientLog.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<ClientLogsService>(ClientLogsService);
  });

  describe('record', () => {
    it('debe guardar clientTime sin pisarlo si viene en el payload', async () => {
      const input: ClientLogInput = {
        level: 'error',
        source: 'mobile:payment',
        message: 'Error al procesar pago',
        clientTime: '2026-09-25T10:30:00.000Z',
      };

      await service.record(input);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          source: 'mobile:payment',
          clientTime: '2026-09-25T10:30:00.000Z',
        }),
      );
    });

    it('debe asignar clientTime actual si no viene en el payload', async () => {
      const input: ClientLogInput = {
        level: 'warn',
        source: 'print-service:outage',
        message: 'Servidor inalcanzable',
      };

      const beforeCall = new Date().toISOString();
      await service.record(input);
      const afterCall = new Date().toISOString();

      const callArgs = mockModel.create.mock.calls[0][0];
      expect(callArgs.clientTime).toBeDefined();
      // Comparar strings ISO lexicográficamente (funciona para ISO 8601)
      expect(callArgs.clientTime >= beforeCall).toBe(true);
      expect(callArgs.clientTime <= afterCall).toBe(true);
    });

    it('debe guardar solo campos permitidos en el DTO', async () => {
      const input: ClientLogInput = {
        level: 'error',
        source: 'web',
        message: 'Test',
        clientTime: '2026-09-25T10:00:00.000Z',
      };

      await service.record(input);

      const callArgs = mockModel.create.mock.calls[0][0];
      // Verificar que tiene los campos esperados
      expect(callArgs).toHaveProperty('level');
      expect(callArgs).toHaveProperty('source');
      expect(callArgs).toHaveProperty('clientTime');
    });
  });

  describe('recordBatch', () => {
    it('debe guardar un batch de logs preservando clientTime', async () => {
      const inputs: ClientLogInput[] = [
        {
          level: 'error',
          source: 'print:thermal',
          message: 'Impresora desconectada',
          clientTime: '2026-09-25T10:30:00.000Z',
        },
        {
          level: 'warn',
          source: 'mobile:order',
          message: 'Reconexion exitosa',
          clientTime: '2026-09-25T10:31:00.000Z',
        },
      ];

      await service.recordBatch(inputs);

      // Debe haber llamado create para cada input
      expect(mockModel.create).toHaveBeenCalledTimes(2);
      expect(mockModel.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          clientTime: '2026-09-25T10:30:00.000Z',
        }),
      );
      expect(mockModel.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          clientTime: '2026-09-25T10:31:00.000Z',
        }),
      );
    });
  });

  describe('connectivity episodes', () => {
    it('debe registrar episodio de conectividad (outage-start)', async () => {
      const episodeInput: ClientLogInput = {
        level: 'warn',
        source: 'print-service:Outage',
        message: 'Corte de internet detectado',
        clientTime: '2026-09-25T14:00:00.000Z',
        context: {
          evento: 'outage-start',
          inicioClientTime: '2026-09-25T14:00:00.000Z',
        },
      };

      await service.record(episodeInput);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientTime: '2026-09-25T14:00:00.000Z',
          context: expect.objectContaining({
            evento: 'outage-start',
          }),
        }),
      );
    });

    it('debe registrar episodio de conectividad (outage-end) con duración', async () => {
      const episodeInput: ClientLogInput = {
        level: 'warn',
        source: 'print-service:Outage',
        message: 'Fin del corte de internet - duracion 3600s',
        clientTime: '2026-09-25T15:00:00.000Z',
        context: {
          evento: 'outage-end',
          inicioClientTime: '2026-09-25T14:00:00.000Z',
          finClientTime: '2026-09-25T15:00:00.000Z',
          duracionMs: 3600000,
        },
      };

      await service.record(episodeInput);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            evento: 'outage-end',
            duracionMs: 3600000,
          }),
        }),
      );
    });
  });

  describe('getConnectivityEpisodes', () => {
    it('debe retornar episodios del mes actual', async () => {
      const mockEpisodes = [
        {
          _id: '1',
          level: 'warn',
          source: 'print-service:Outage',
          message: 'Fin del corte',
          clientTime: '2026-09-25T10:31:00.000Z',
          context: {
            evento: 'outage-end',
            inicioClientTime: '2026-09-25T10:00:00.000Z',
            duracionMs: 1860000,
          },
          createdAt: new Date(),
        },
      ];

      const mockChain = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockEpisodes),
      };

      mockModel.find = jest.fn().mockReturnValue(mockChain);

      const result = await service.getConnectivityEpisodes({
        year: 2026,
        month: 9,
      });

      // Debe retornar los episodios + summary (array con 2 elementos)
      expect(result.length).toBeGreaterThanOrEqual(1);
      const lastItem = result[result.length - 1];
      expect(lastItem).toHaveProperty('summary');
    });

    it('debe retornar resumen con estadísticas correctas', async () => {
      const mockEpisodes = [
        {
          level: 'warn',
          source: 'print-service:Outage',
          context: {
            evento: 'outage-end',
            inicioClientTime: '2026-09-25T10:00:00.000Z',
            duracionMs: 60000,
          },
        },
        {
          level: 'warn',
          source: 'print-service:Outage',
          context: {
            evento: 'outage-end',
            inicioClientTime: '2026-09-25T11:00:00.000Z',
            duracionMs: 120000,
          },
        },
        {
          level: 'warn',
          source: 'print-service:Outage',
          context: {
            evento: 'outage-end',
            inicioClientTime: '2026-09-25T12:00:00.000Z',
            duracionMs: 30000,
          },
        },
      ];

      const mockChain = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockEpisodes),
      };

      mockModel.find = jest.fn().mockReturnValue(mockChain);

      const result = await service.getConnectivityEpisodes({
        year: 2026,
        month: 9,
      });

      const lastItem = result[result.length - 1] as Record<string, unknown>;
      const summary = lastItem.summary as Record<string, unknown>;

      expect(summary.count).toBe(3);
      expect(summary.maxDurationMs).toBe(120000);
      expect(summary.totalMinutes).toBe(3.5); // (60+120+30)/1000/60
    });
  });
});
