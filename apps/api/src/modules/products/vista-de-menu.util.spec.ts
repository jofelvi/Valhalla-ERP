import {
  CAMPOS_DEL_MENU,
  proyeccionDeMenu,
  proyeccionPedida,
  condicionDeVenta,
} from './vista-de-menu.util';

describe('proyeccionDeMenu', () => {
  it('deja fuera los campos gordos que ninguna pantalla de venta usa', () => {
    const p = proyeccionDeMenu();
    // Los tres que pesan y no se muestran al vender. `ingredients` solo son
    // 88 KB de los 484 KB medidos.
    expect(p.ingredients).toBeUndefined();
    expect(p.description).toBeUndefined();
    expect(p.cost).toBeUndefined();
  });

  it('deja fuera la metadata muerta de la migracion de Firebase', () => {
    // 15.860 bytes en cada llamada, por nueve pantallas, para un campo que no
    // lee absolutamente nadie desde que se apago Firebase.
    const p = proyeccionDeMenu();
    expect(p._firestoreCreatedAt).toBeUndefined();
    expect(p._firestoreUpdatedAt).toBeUndefined();
  });

  it('conserva _id: sin el, normalize() del movil deja la pantalla muda', () => {
    // No es teorico: sin `_id` las estaciones decian "todo despachado" con 22
    // items pendientes, y el build estaba en verde.
    expect(proyeccionDeMenu()._id).toBe(1);
  });

  it('conserva lo minimo para mostrar, agrupar, cobrar y despachar', () => {
    const p = proyeccionDeMenu();
    for (const campo of [
      'name', // mostrar
      'price', // cobrar
      'tax', // cobrar
      'categoryId', // agrupar
      'station', // despachar a cocina/barra/pizza
      'imageUrl', // mostrar
    ]) {
      expect(p[campo]).toBe(1);
    }
  });

  it('todos los valores son 1: una proyeccion no mezcla incluir y excluir', () => {
    // Mongo rechaza una proyeccion que mezcle 1 y 0 (salvo _id). Este test
    // existe para que agregar un campo con 0 falle aca y no en produccion.
    expect(Object.values(proyeccionDeMenu()).every((v) => v === 1)).toBe(true);
  });

  it('la proyeccion tiene exactamente los campos de la lista', () => {
    expect(Object.keys(proyeccionDeMenu()).sort()).toEqual(
      [...CAMPOS_DEL_MENU].sort(),
    );
  });
});

describe('proyeccionPedida', () => {
  it('sin vista: documento completo, como siempre', () => {
    // La compatibilidad es el punto: los APK viejos siguen semanas en la calle.
    expect(proyeccionPedida(undefined)).toBeNull();
  });

  it('vista=menu: proyecta', () => {
    expect(proyeccionPedida('menu')).toEqual(proyeccionDeMenu());
  });

  it('vista=pos: el menu mas receta y descripcion', () => {
    // Sin `ingredients` el POS web no deja personalizar ningun producto.
    const p = proyeccionPedida('pos');
    expect(p).toEqual({
      ...proyeccionDeMenu(),
      ingredients: 1,
      description: 1,
    });
  });

  it('vista=menu no trae la receta (lo que baja el APK no engorda)', () => {
    expect(proyeccionPedida('menu')).not.toHaveProperty('ingredients');
  });

  it('vista desconocida: manda de mas, no de menos', () => {
    // Equivocarse mandando todo cuesta bytes; equivocarse recortando deja una
    // pantalla vacia sin un solo error.
    for (const basura of ['MENU', 'menú', 'completo', '', 'x']) {
      expect(proyeccionPedida(basura)).toBeNull();
    }
  });
});

describe('condicionDeVenta', () => {
  it('forSale=true: exige activo Y a la venta', () => {
    // Las dos condiciones que el movil repetia en nueve sitios con un .filter()
    // despues de bajarse los 585 productos.
    expect(condicionDeVenta('true')).toEqual({
      isActive: true,
      isForSale: true,
    });
  });

  it('sin forSale o con cualquier otra cosa: no filtra', () => {
    for (const v of [undefined, 'false', '1', 'TRUE', '']) {
      expect(condicionDeVenta(v)).toBeNull();
    }
  });

  it('no filtra por isForSale sin isActive: un inactivo no se vende', () => {
    // Filtrar solo por isForSale dejaria pasar productos dados de baja que
    // siguen con la bandera puesta, y volverian a aparecer en el menu.
    const c = condicionDeVenta('true');
    expect(c).not.toBeNull();
    expect(Object.keys(c as Record<string, true>).sort()).toEqual([
      'isActive',
      'isForSale',
    ]);
  });
});
