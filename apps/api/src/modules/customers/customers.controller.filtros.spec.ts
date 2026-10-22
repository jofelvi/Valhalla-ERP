import { CustomersController } from './customers.controller';
import type {
  CustomersService,
  FiltrosDeClientes,
} from './customers.service';

/**
 * Que el controller PASE los filtros al service.
 *
 * Existe por un error que ya cometi una vez: deje el service de productos
 * listo para recibir `forSale`/`vista` y me olvide del controller. Build
 * verde, tests del util verdes, y el parametro no hacia nada. Un test del util
 * no puede verlo —el util estaba bien— y el compilador tampoco: un query param
 * que nadie lee no es un error de tipos.
 */

function armar() {
  const recibidos: Array<FiltrosDeClientes | undefined> = [];
  const service = {
    findAll: (f?: FiltrosDeClientes) => {
      recibidos.push(f);
      return Promise.resolve([]);
    },
  } as unknown as CustomersService;
  return { controller: new CustomersController(service), recibidos };
}

describe('CustomersController.findAll — los filtros llegan al service', () => {
  it('pasa vista, activos, limit y page', () => {
    const { controller, recibidos } = armar();
    void controller.findAll('lista', 'true', '100', '2');
    expect(recibidos[0]).toEqual({
      vista: 'lista',
      activos: 'true',
      limit: '100',
      page: '2',
    });
  });

  it('sin parametros: undefined, no valores inventados', () => {
    // Si el controller mandara 'lista' por defecto, la pantalla de detalle se
    // quedaria sin credito ni direccion y el APK sin media ficha, sin un solo
    // error.
    const { controller, recibidos } = armar();
    void controller.findAll();
    expect(recibidos[0]).toEqual({
      vista: undefined,
      activos: undefined,
      limit: undefined,
      page: undefined,
    });
  });
});
