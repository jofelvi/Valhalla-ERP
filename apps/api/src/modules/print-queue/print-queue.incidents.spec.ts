import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PrintQueueService } from './print-queue.service';
import { PrintJob, PrintJobStatus } from './schemas/print-job.schema';
import { PrintGateway } from '../websockets/gateways/print.gateway';
import { Product } from '../products/schemas/product.schema';
import { PrintAlertsService } from './print-alerts.service';
import { OrdersService } from '../orders/orders.service';
import {
  PrintIncidentType,
  ReportIncidentDto,
} from './dto/report-incident.dto';
import { ConfigsService } from '../configs/configs.service';
import { CONFIG_DEFAULTS, ConfigId } from '@odin6/types';

/**
 * Los dos huecos por los que se perdieron 493 comandas de barra entre el 9 y el
 * 16 de agosto de 2026, sin que la API se enterara de nada:
 *
 *   1. La PC de la caja botaba tickets de la cola de Windows y nadie lo sabia:
 *      el job ya estaba marcado 'done' porque el spooler acepto los bytes.
 *   2. Un job que se quedaba en 'processing' no lo reintentaba ni lo cerraba
 *      nadie — el print-service solo pide los 'pending'. Habia 6 colgados, el
 *      mas viejo desde hacia 36 horas.
 */
describe('PrintQueueService - incidentes de impresion', () => {
  let service: PrintQueueService;
  let notifyIncident: jest.Mock;
  let notifyFailure: jest.Mock;
  let updateMany: jest.Mock;
  let find: jest.Mock;

  const build = async (trabados: Record<string, unknown>[]) => {
    notifyIncident = jest.fn();
    notifyFailure = jest.fn();
    updateMany = jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) });
    find = jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(trabados) }),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrintQueueService,
        {
          // Configuración neutra del contrato: el ticket se completa con defaults.
          provide: ConfigsService,
          useValue: {
            obtener: (id: ConfigId) => Promise.resolve(CONFIG_DEFAULTS[id]),
          },
        },
        {
          provide: getModelToken(PrintJob.name),
          useValue: { find, updateMany },
        },
        {
          // El servicio traduce los ingredientes quitados (ids) a nombre para
          // que la comanda no diga "SIN prod-botella-a". Sin catalogo
          // en las pruebas, devuelve vacio y se imprime lo que vino.
          provide: getModelToken(Product.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              lean: () => ({ exec: () => Promise.resolve([]) }),
            }),
          },
        },
        {
          provide: PrintGateway,
          useValue: { emitNewJob: jest.fn(), emitStatusChanged: jest.fn() },
        },
        {
          provide: PrintAlertsService,
          useValue: { notifyIncident, notifyFailure },
        },
        { provide: OrdersService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(PrintQueueService);
  };

  const incidente = (
    extra: Partial<ReportIncidentDto> = {},
  ): ReportIncidentDto =>
    ({
      tipo: PrintIncidentType.REDIRECCION,
      impresora: 'POS-BARRA',
      ...extra,
    }) as ReportIncidentDto;

  describe('reportIncident', () => {
    it('dispara la alerta con el incidente recibido', async () => {
      await build([]);
      const inc = incidente({ destino: 'POS-COCINA', orderNumber: 'D5656B36' });

      const res = service.reportIncident(inc);

      expect(res).toEqual({ registrado: true });
      expect(notifyIncident).toHaveBeenCalledWith(inc);
    });

    it('alerta tambien cuando el watchdog bota tickets de la cola', async () => {
      await build([]);
      const inc = incidente({
        tipo: PrintIncidentType.PURGA,
        trabajos: [
          {
            id: '41',
            papel: 'comanda',
            enviado: '2026-08-16T20:26:00',
            estado: 'Error',
          },
        ],
      });

      service.reportIncident(inc);

      expect(notifyIncident).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: PrintIncidentType.PURGA }),
      );
    });
  });

  describe('cierre de jobs trabados en processing', () => {
    it('cierra como fallidos los que pasan de 10 min y avisa', async () => {
      await build([
        { _id: 'job-viejo-1', status: PrintJobStatus.PROCESSING },
        { _id: 'job-viejo-2', status: PrintJobStatus.PROCESSING },
      ]);

      await service['cerrarTrabados']();

      expect(updateMany).toHaveBeenCalledWith(
        { _id: { $in: ['job-viejo-1', 'job-viejo-2'] } },
        expect.objectContaining({ status: PrintJobStatus.FAILED }),
      );
      expect(notifyFailure).toHaveBeenCalled();
    });

    it('NO los reencola a pending: reimprimir una comanda vieja es peor', async () => {
      await build([{ _id: 'job-viejo-1', status: PrintJobStatus.PROCESSING }]);

      await service['cerrarTrabados']();

      const [, cambios] = updateMany.mock.calls[0] as [
        unknown,
        { status: string },
      ];
      expect(cambios.status).not.toBe(PrintJobStatus.PENDING);
    });

    it('solo mira los processing mas viejos que el limite', async () => {
      await build([]);

      await service['cerrarTrabados']();

      const [filtro] = find.mock.calls[0] as [
        { status: string; updatedAt: { $lt: Date } },
      ];
      expect(filtro.status).toBe(PrintJobStatus.PROCESSING);
      expect(filtro.updatedAt.$lt.getTime()).toBeLessThanOrEqual(
        Date.now() - 10 * 60 * 1000,
      );
    });

    it('no toca nada ni alerta si no hay trabados', async () => {
      await build([]);

      await service['cerrarTrabados']();

      expect(updateMany).not.toHaveBeenCalled();
      expect(notifyFailure).not.toHaveBeenCalled();
    });
  });
});
