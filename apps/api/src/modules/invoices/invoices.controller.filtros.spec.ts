import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import type { FiltrosDeFacturas } from './filtros-de-facturas.util';

/**
 * Que el controller PASE los filtros al service.
 *
 * Este spec existe por un error concreto y reciente: al agregar `forSale` y
 * `vista` a productos deje el service preparado para recibirlos y **me olvide
 * del controller**. El build quedaba en verde, los tests del util pasaban, y
 * `?forSale=true` no hacia absolutamente nada.
 *
 * No hay forma de que un test del util lo detecte —el util estaba bien— ni de
 * que un build lo vea: un parametro de query que nadie lee no es un error de
 * tipos. Se detecta aca o se detecta en produccion.
 */

function armar() {
  const recibidos: Array<FiltrosDeFacturas | undefined> = [];
  const service = {
    findAll: (f?: FiltrosDeFacturas) => {
      recibidos.push(f);
      return Promise.resolve([]);
    },
  } as unknown as InvoicesService;
  return { controller: new InvoicesController(service), recibidos };
}

describe('InvoicesController.findAll — los filtros llegan al service', () => {
  it('pasa los 7 parametros', () => {
    const { controller, recibidos } = armar();
    void controller.findAll(
      'o-1',
      'c-2',
      '2026-09-01',
      '2026-09-30',
      '50',
      '2',
      'lista',
    );
    expect(recibidos[0]).toEqual({
      orderId: 'o-1',
      customerId: 'c-2',
      from: '2026-09-01',
      to: '2026-09-30',
      limit: '50',
      page: '2',
      vista: 'lista',
    });
  });

  it('sin parametros: llegan undefined, no valores inventados', () => {
    // Si el controller mandara 'lista' por defecto, el generador de PDF
    // empezaria a recibir facturas sin lineas y sacaria la tabla vacia sin un
    // solo error.
    const { controller, recibidos } = armar();
    void controller.findAll();
    expect(recibidos[0]).toEqual({
      orderId: undefined,
      customerId: undefined,
      from: undefined,
      to: undefined,
      limit: undefined,
      page: undefined,
      vista: undefined,
    });
  });

  it('orderId solo: es la llamada de la pantalla de recibo', () => {
    // Imprimir un ticket. Antes esta llamada mandaba `orderId` a un endpoint
    // que no lo leia y recibia las 4.735 facturas del negocio.
    const { controller, recibidos } = armar();
    void controller.findAll('o-9');
    expect(recibidos[0]?.orderId).toBe('o-9');
    expect(recibidos[0]?.limit).toBeUndefined();
  });
});
