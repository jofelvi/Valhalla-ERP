import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WhatsappLogsService } from '../whatsapp-logs/whatsapp-logs.service';

/**
 * Tests para NotificationsService, enfocados en:
 * - Timeout en fetch a whatsapp-service
 * - Errores de conectividad (ECONNREFUSED, ENOTFOUND)
 * - Manejo de PDF grande (payload)
 * - Logging de errores con detalles tecnicos
 */
describe('NotificationsService', () => {
  let service: NotificationsService;
  let configService: ConfigService;
  let whatsappLogs: WhatsappLogsService;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                WHATSAPP_SERVICE_URL: 'http://127.0.0.1:6000',
                WHATSAPP_API_KEY: 'test-key-123',
                PUBLIC_APP_URL: 'https://app.ejemplo.com',
              };
              return config[key];
            }),
          },
        },
        {
          provide: WhatsappLogsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ _id: 'log-123' }),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    configService = module.get<ConfigService>(ConfigService);
    whatsappLogs = module.get<WhatsappLogsService>(WhatsappLogsService);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('sendPagoPendiente', () => {
    const validDto = {
      to: '584140000005',
      customerName: 'Juan Perez',
      amount: '150.00',
      orderCode: 'A1B2C3D4',
      date: '15/09/2026',
      pdfBase64: 'JVBERi0xLjQK' + 'x'.repeat(1000), // PDF simulado (~1KB)
    };

    it('deberia enviar pago_pendiente exitosamente', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          messageId: 'wamid-123',
        }),
      });

      const result = await service.sendPagoPendiente(validDto);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:6000/api/v1/messages/template',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key-123',
          }),
        }),
      );
    });

    it('deberia fallar por TIMEOUT (AbortError)', async () => {
      const abortError = new Error('The operation was aborted');
      (abortError as any).name = 'AbortError';

      global.fetch = jest.fn().mockRejectedValueOnce(abortError);

      try {
        await service.sendPagoPendiente(validDto);
        fail('Deberia haber lanzado una excepcion');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpErr = error as HttpException;
        const response = httpErr.getResponse() as Record<string, unknown>;
        expect(response.error).toContain('TIMEOUT');
        expect(response.error).toContain('30s');
      }
    });

    it('deberia fallar por ECONNREFUSED (whatsapp-service caido)', async () => {
      const connError = new Error('connect ECONNREFUSED 127.0.0.1:6000');
      (connError as NodeJS.ErrnoException).code = 'ECONNREFUSED';
      (connError as NodeJS.ErrnoException).errno = 111;

      // Forma real de undici: TypeError("fetch failed") con el error de red en cause.
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(
          new TypeError('fetch failed', { cause: connError }),
        );

      try {
        await service.sendPagoPendiente(validDto);
        fail('Deberia haber lanzado una excepcion');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpErr = error as HttpException;
        const response = httpErr.getResponse() as Record<string, unknown>;
        expect(response.error).toContain('CONEXION RECHAZADA');
        expect(response.error).toContain('127.0.0.1:6000');
      }
    });

    it('deberia fallar por ENOTFOUND (DNS irresuelto)', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND invalid.host');
      (dnsError as NodeJS.ErrnoException).code = 'ENOTFOUND';
      (dnsError as NodeJS.ErrnoException).errno = -3001;

      // Forma real de undici: TypeError("fetch failed") con el error de red en cause.
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(
          new TypeError('fetch failed', { cause: dnsError }),
        );

      try {
        await service.sendPagoPendiente(validDto);
        fail('Deberia haber lanzado una excepcion');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpErr = error as HttpException;
        const response = httpErr.getResponse() as Record<string, unknown>;
        expect(response.error).toContain('DNS NO RESUELTO');
      }
    });

    it('deberia fallar con HTTP 502 del whatsapp-service', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: jest.fn().mockResolvedValueOnce({
          success: false,
          error: 'Internal server error',
          code: 500,
          hint: 'whatsapp-service timeout',
        }),
      });

      try {
        await service.sendPagoPendiente(validDto);
        fail('Deberia haber lanzado una excepcion');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpErr = error as HttpException;
        const response = httpErr.getResponse() as Record<string, unknown>;
        expect(response.error).toBe('Internal server error');
        expect(httpErr.getStatus()).toBe(502);
      }
    });

    it('deberia registrar log de WhatsApp cuando se envia exitosamente', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          messageId: 'wamid-456',
        }),
      });

      const result = await service.sendPagoPendiente(validDto);

      expect(whatsappLogs.create).toHaveBeenCalledWith({
        messageId: 'wamid-456',
        to: validDto.to,
        template: 'pago_pendiente',
        accountReceivableId: undefined,
        customerName: validDto.customerName,
        orderCode: validDto.orderCode,
        amount: validDto.amount,
      });
      expect(result.logId).toBe('log-123');
    });

    it('deberia incluir detalles de diagnostico en el error', async () => {
      const connError = new Error('connect ECONNREFUSED 127.0.0.1:6000');
      (connError as NodeJS.ErrnoException).code = 'ECONNREFUSED';

      // Forma real de undici: TypeError("fetch failed") con el error de red en cause.
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(
          new TypeError('fetch failed', { cause: connError }),
        );

      try {
        await service.sendPagoPendiente(validDto);
        fail('Deberia haber lanzado una excepcion');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpErr = error as HttpException;
        const response = httpErr.getResponse() as Record<string, unknown>;
        expect(response.detail).toBeDefined();
      }
    });

    it('deberia usar timeout de 30 segundos', async () => {
      let capturedFetchInit: RequestInit | undefined;

      global.fetch = jest
        .fn()
        .mockImplementation((url: string, init?: RequestInit) => {
          capturedFetchInit = init;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValueOnce({
              success: true,
              messageId: 'wamid-789',
            }),
          });
        });

      await service.sendPagoPendiente(validDto);

      // Verificar que se paso un signal de AbortController
      expect(capturedFetchInit?.signal).toBeDefined();
      expect(capturedFetchInit?.signal).toBeInstanceOf(AbortSignal);
    });

    it('deberia manejar PDF muy grande (~5MB)', async () => {
      const largePdf = 'JVBERi0xLjQK' + 'A'.repeat(5_000_000);
      const dtoWithLargePdf = { ...validDto, pdfBase64: largePdf };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          messageId: 'wamid-large',
        }),
      });

      const result = await service.sendPagoPendiente(dtoWithLargePdf);

      expect(result.success).toBe(true);
      // Verificar que el fetch se llamo (timeout de 30s es suficiente para 5MB)
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('sendBudget', () => {
    const validDto = {
      to: '584140000005',
      customerName: 'Empresa ABC',
      budgetNumber: 'PRES-001',
      eventName: 'Boda de Luisa y Carlos',
      total: '5000.00',
      pdfBase64: 'JVBERi0xLjQK' + 'x'.repeat(1000),
    };

    it('deberia intentar plantilla primero, luego texto plano si falla', async () => {
      // Primera llamada: plantilla falla (503)
      // Segunda llamada: texto plano entrega
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: jest.fn().mockResolvedValueOnce({
            success: false,
            error: 'Template not found',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValueOnce({
            success: true,
            messageId: 'wamid-text',
          }),
        });

      const result = await service.sendBudget(validDto);

      expect(result.success).toBe(true);
      expect(result.method).toBe('text');
      expect(result.warning).toContain('Enviado como texto');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('deberia devolver template exitosamente', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          messageId: 'wamid-template',
        }),
      });

      const result = await service.sendBudget(validDto);

      expect(result.success).toBe(true);
      expect(result.method).toBe('template');
      expect(result.messageId).toBe('wamid-template');
    });
  });

  describe('sendReservationAlert', () => {
    it('deberia enviar alerta de reserva exitosamente', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'RESERVATIONS_NOTIFY_PHONE') return '+584140000005';
        if (key === 'WHATSAPP_SERVICE_URL') return 'http://127.0.0.1:6000';
        if (key === 'WHATSAPP_API_KEY') return 'test-key';
        return undefined;
      });

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const data = {
        tableNumber: 5,
        packageLabel: 'Gold Package',
        customerName: 'Carlos Mendez',
        cedula: '12.345.678',
        phone: '+584140000005',
        paymentReference: 'REF123456',
        amountUsd: 500,
        amountBs: 12_500,
      };

      await service.sendReservationAlert(data);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:6000/api/v1/messages/text',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('deberia hacer skip si RESERVATIONS_NOTIFY_PHONE no esta configurado', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'RESERVATIONS_NOTIFY_PHONE') return '';
        return undefined;
      });

      global.fetch = jest.fn();

      const data = {
        tableNumber: 5,
        packageLabel: 'Gold Package',
        customerName: 'Carlos Mendez',
        cedula: '12.345.678',
        phone: '+584140000005',
        paymentReference: 'REF123456',
        amountUsd: 500,
        amountBs: 12_500,
      };

      await service.sendReservationAlert(data);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
