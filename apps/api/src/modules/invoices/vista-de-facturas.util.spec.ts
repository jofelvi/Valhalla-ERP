import {
  CAMPOS_DEL_LISTADO,
  proyeccionDeListado,
  proyeccionPedida,
} from './vista-de-facturas.util';

describe('proyeccionPedida', () => {
  it('sin vista: NO proyecta, manda la factura entera', () => {
    // La compatibilidad depende de esto. Un consumidor que hoy lee `items`
    // —el generador de PDF, el bot, un APK viejo— tiene que seguir
    // recibiendolas completas mientras no pida el recorte.
    expect(proyeccionPedida()).toBeNull();
    expect(proyeccionPedida(undefined)).toBeNull();
  });

  it('vista=lista: proyecta los campos de la tabla', () => {
    const p = proyeccionPedida('lista');
    expect(p).toEqual(proyeccionDeListado());
  });

  it('vista con basura o typo: manda de MAS, no de menos', () => {
    // `?vista=listaa` mandando facturas sin lineas seria un PDF vacio sin un
    // solo error. Preferible ignorar el parametro.
    for (const basura of ['listaa', 'LISTA', 'menu', '', '1', 'true']) {
      expect(proyeccionPedida(basura)).toBeNull();
    }
  });
});

describe('proyeccionDeListado', () => {
  it('NO incluye items, que es el 56% del peso medido', () => {
    // 1.339.095 de 2.372.094 bytes en PRE sobre 2.000 facturas.
    expect(proyeccionDeListado()).not.toHaveProperty('items');
  });

  it('NO incluye paymentProofUrls: son URLs que la tabla no pinta', () => {
    expect(proyeccionDeListado()).not.toHaveProperty('paymentProofUrls');
  });

  it('incluye _id: sin el, la fila no sabe adonde navegar', () => {
    // `findAll` mapea `id: invoice._id`. Proyectar sin `_id` dejaria cada
    // fila con id undefined y el boton de ver detalle llevaria a ninguna
    // parte, sin error.
    expect(proyeccionDeListado()._id).toBe(1);
  });

  it('incluye lo que la tabla pinta y lo que la busqueda recorre', () => {
    // invoiceNumber y customerName alimentan `useBusqueda`; total, status y
    // createdAt son columnas; orderId es el enlace a la orden.
    for (const campo of [
      'invoiceNumber',
      'customerName',
      'total',
      'status',
      'createdAt',
      'orderId',
    ]) {
      expect(proyeccionDeListado()[campo]).toBe(1);
    }
  });

  it('todos los campos valen 1: mezclar 0 y 1 en Mongo es un error', () => {
    // Mongo rechaza una proyeccion que mezcle inclusion y exclusion (salvo
    // `_id`). Si alguien agrega un `campo: 0` aca, la consulta revienta.
    expect(Object.values(proyeccionDeListado()).every((v) => v === 1)).toBe(
      true,
    );
    expect(Object.keys(proyeccionDeListado())).toHaveLength(
      CAMPOS_DEL_LISTADO.length,
    );
  });
});
