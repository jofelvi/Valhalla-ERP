import {
  CAMPOS_DEL_LISTADO,
  condicionDeActivos,
  proyeccionDeListado,
  proyeccionPedida,
  TOPE_DE_CLIENTES,
} from './vista-de-clientes.util';

describe('proyeccionPedida', () => {
  it('sin vista: manda la ficha completa', () => {
    // La pantalla de detalle necesita credito, direccion y fechas; el APK lee
    // fichas enteras por /search y /by-member. Recortar por defecto las
    // dejaria en blanco sin un solo error.
    expect(proyeccionPedida()).toBeNull();
    expect(proyeccionPedida(undefined)).toBeNull();
  });

  it('vista=lista: recorta a lo que pintan los listados', () => {
    expect(proyeccionPedida('lista')).toEqual(proyeccionDeListado());
  });

  it('typo o basura: manda de MAS, no de menos', () => {
    for (const basura of ['listaa', 'LISTA', 'menu', '', 'true', '1']) {
      expect(proyeccionPedida(basura)).toBeNull();
    }
  });
});

describe('proyeccionDeListado', () => {
  it('deja fuera la metadata muerta de Firebase', () => {
    // ~190 KB entre valores y nombres de campo repetidos 2.955 veces. Firebase
    // esta apagado: nadie los lee.
    const p = proyeccionDeListado();
    expect(p).not.toHaveProperty('_firestoreCreatedAt');
    expect(p).not.toHaveProperty('_firestoreUpdatedAt');
  });

  it('deja fuera lo que ninguna de las cinco pantallas lee', () => {
    const p = proyeccionDeListado();
    for (const campo of [
      'createdAt',
      'updatedAt',
      'address',
      'memberCreditLimit',
      'memberCreditUsed',
      'memberCreditGrantedAt',
    ]) {
      expect(p).not.toHaveProperty(campo);
    }
  });

  it('incluye los cinco campos que recorre el buscador', () => {
    // `/private/customers` busca por estos. Si falta uno, buscar por cedula
    // deja de encontrar y parece que el cliente no existe.
    const p = proyeccionDeListado();
    for (const campo of [
      'name',
      'phone',
      'email',
      'identificationId',
      'memberAction',
    ]) {
      expect(p[campo]).toBe(1);
    }
  });

  it('incluye _id: sin el, la fila no sabe adonde navegar', () => {
    // `findAll` mapea `id: customer._id`. Sin `_id` cada fila tendria id
    // undefined y el enlace al detalle no llevaria a ninguna parte.
    expect(proyeccionDeListado()._id).toBe(1);
  });

  it('incluye isActive: la pantalla cuenta "N activos" con el', () => {
    expect(proyeccionDeListado().isActive).toBe(1);
  });

  it('todos los campos valen 1: mezclar 0 y 1 revienta la consulta', () => {
    const p = proyeccionDeListado();
    expect(Object.values(p).every((v) => v === 1)).toBe(true);
    expect(Object.keys(p)).toHaveLength(CAMPOS_DEL_LISTADO.length);
  });
});

describe('condicionDeActivos', () => {
  it('sin el parametro: no filtra', () => {
    expect(condicionDeActivos()).toBeNull();
    expect(condicionDeActivos('false')).toBeNull();
  });

  it('activos=true usa $ne:false, NO isActive:true', () => {
    // Las fichas viejas no traen `isActive`. Con `isActive: true` a secas
    // desapareceria gente que hoy SI aparece, porque el normalize del cliente
    // rellena `true` cuando falta.
    expect(condicionDeActivos('true')).toEqual({ isActive: { $ne: false } });
  });
});

describe('TOPE_DE_CLIENTES', () => {
  it('el defecto NO es menor que el techo, a proposito', () => {
    // Al reves que en facturas. Esto es un directorio que se busca EN EL
    // NAVEGADOR: un defecto de 500 sobre 2.955 no pagina, esconde 2.455
    // personas del buscador, y el que busca a alguien concluye que no esta
    // registrado. El techo solo frena el crecimiento ilimitado.
    expect(TOPE_DE_CLIENTES.defecto).toBe(TOPE_DE_CLIENTES.duro);
  });

  it('el techo deja margen sobre el padron de hoy (2.955)', () => {
    expect(TOPE_DE_CLIENTES.duro).toBeGreaterThan(2955);
  });
});
