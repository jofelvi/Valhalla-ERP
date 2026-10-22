import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Que el controller PASE los filtros al service.
 *
 * Este spec existe por un error concreto: al agregar `forSale` y `vista` deje
 * el service preparado para recibirlos y **me olvide del controller**. El
 * build quedaba en verde, los tests del util pasaban, y `?forSale=true` no
 * hacia absolutamente nada: la API seguia devolviendo los 585 productos
 * enteros mientras el movil creia estar pidiendo 368 recortados.
 *
 * No hay forma de que un test del util lo detecte —el util estaba bien—, y un
 * build tampoco: un parametro de query que nadie lee no es un error de tipos.
 * Se detecta aca o se detecta en produccion.
 */

interface FiltrosRecibidos {
  active?: boolean;
  categoryId?: string;
  supplierId?: string;
  station?: string;
  forSale?: string;
  vista?: string;
  q?: string;
}

function armar() {
  const recibidos: FiltrosRecibidos[] = [];
  const service = {
    findAll: (f: FiltrosRecibidos) => {
      recibidos.push(f);
      return Promise.resolve([]);
    },
  } as unknown as ProductsService;
  return { controller: new ProductsController(service), recibidos };
}

const REQ = { user: { role: 'ADMIN' } } as Parameters<
  ProductsController['findAll']
>[0];

describe('ProductsController.findAll — los filtros llegan al service', () => {
  it('pasa forSale y vista, que es lo que se olvido la primera vez', () => {
    const { controller, recibidos } = armar();
    void controller.findAll(REQ, undefined, undefined, undefined, undefined, 'true', 'menu');
    expect(recibidos[0]).toMatchObject({ forSale: 'true', vista: 'menu' });
  });

  it('sin forSale ni vista: llegan undefined, no un valor inventado', () => {
    // La compatibilidad depende de esto: si el controller mandara 'true' por
    // defecto, cada APK viejo empezaria a recibir un catalogo recortado.
    const { controller, recibidos } = armar();
    void controller.findAll(REQ);
    expect(recibidos[0].forSale).toBeUndefined();
    expect(recibidos[0].vista).toBeUndefined();
  });

  it('sigue pasando los filtros que ya existian', () => {
    const { controller, recibidos } = armar();
    void controller.findAll(REQ, 'true', 'cat-1', 'prov-1');
    expect(recibidos[0]).toMatchObject({
      active: true,
      categoryId: 'cat-1',
      supplierId: 'prov-1',
    });
  });

  it('pasa el texto buscado, que es lo que hace la busqueda del servidor', () => {
    // Mismo error que con `forSale`: si el controller no lee `?q=`, la web y
    // el APK creen estar buscando y reciben el catalogo entero.
    const { controller, recibidos } = armar();
    void controller.findAll(
      REQ,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'te de jamaica',
    );
    expect(recibidos[0].q).toBe('te de jamaica');
  });

  it('sin texto llega undefined: buscar es OPT-IN', () => {
    // Un APK viejo que no manda `q` tiene que seguir recibiendo lo de siempre.
    const { controller, recibidos } = armar();
    void controller.findAll(REQ);
    expect(recibidos[0].q).toBeUndefined();
  });

  it('el blindaje por estacion sigue en pie: el rol manda sobre lo pedido', () => {
    // Cocina no puede espiar el catalogo de barra pidiendo ?station=BAR.
    const { controller, recibidos } = armar();
    const reqCocina = { user: { role: 'KITCHEN' } } as Parameters<
      ProductsController['findAll']
    >[0];
    void controller.findAll(reqCocina, undefined, undefined, undefined, 'BAR');
    expect(recibidos[0].station).not.toBe('BAR');
  });
});
