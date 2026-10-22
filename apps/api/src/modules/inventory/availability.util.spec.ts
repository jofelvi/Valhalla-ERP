import {
  InsumoConStock,
  evaluarDisponibilidad,
  esCritico,
} from './availability.util';

const insumo = (
  _id: string,
  name: string,
  stock: number,
  extra: Partial<InsumoConStock> = {},
): InsumoConStock => ({
  _id,
  name,
  stock,
  contadoAlgunaVez: true,
  ...extra,
});

const almacen = (...xs: InsumoConStock[]) =>
  new Map(xs.map((x) => [String(x._id), x]));

const HAMBURGUESA = { _id: 'ham' };

describe('esCritico', () => {
  it('solo ALTA y MEDIA frenan la venta', () => {
    expect(esCritico('ALTA')).toBe(true);
    expect(esCritico('MEDIA')).toBe(true);
    expect(esCritico('BAJA')).toBe(false);
    // Sin criticidad cargada NO se asume crítico: la sal está en 31 recetas y
    // pondría "agotado" en medio catálogo.
    expect(esCritico(null)).toBe(false);
    expect(esCritico(undefined)).toBe(false);
  });
});

describe('evaluarDisponibilidad', () => {
  it('con stock de sobra dice OK y cuántas salen', () => {
    const r = evaluarDisponibilidad(
      HAMBURGUESA,
      [{ insumoId: 'carne', qtyBase: 150 }],
      almacen(insumo('carne', 'Carne', 1500, { criticality: 'ALTA' })),
    );
    expect(r.estado).toBe('OK');
    expect(r.maxPorciones).toBe(10);
    expect(r.faltantes).toEqual([]);
  });

  it('falta un insumo CRÍTICO ⇒ AGOTADO', () => {
    const r = evaluarDisponibilidad(
      HAMBURGUESA,
      [{ insumoId: 'carne', qtyBase: 150 }],
      almacen(
        insumo('carne', 'Carne de Res Molida', 0, { criticality: 'ALTA' }),
      ),
    );
    expect(r.estado).toBe('AGOTADO');
    expect(r.faltantes[0].name).toBe('Carne de Res Molida');
    expect(r.maxPorciones).toBe(0);
  });

  it('falta solo un insumo de criticidad BAJA ⇒ AVISO, no AGOTADO', () => {
    // La sal aparece en 31 recetas: si frenara, no se vendería nada.
    const r = evaluarDisponibilidad(
      HAMBURGUESA,
      [
        { insumoId: 'carne', qtyBase: 150 },
        { insumoId: 'sal', qtyBase: 3 },
      ],
      almacen(
        insumo('carne', 'Carne', 1500, { criticality: 'ALTA' }),
        insumo('sal', 'Sal', 0, { criticality: 'BAJA' }),
      ),
    );
    expect(r.estado).toBe('AVISO');
    expect(r.faltantes.map((f) => f.name)).toEqual(['Sal']);
  });

  it('un insumo SIN criticidad cargada tampoco agota', () => {
    const r = evaluarDisponibilidad(
      HAMBURGUESA,
      [{ insumoId: 'x', qtyBase: 1 }],
      almacen(insumo('x', 'Algo', 0)),
    );
    expect(r.estado).toBe('AVISO');
  });

  it('insumo nunca contado ⇒ SIN_LINEA_BASE, nunca AGOTADO', () => {
    // Cocina lleva la Papa en −13.776 g porque nunca se contó, no porque
    // falte: decir "agotado" ahí sería mentirle al mesonero en cada plato.
    const r = evaluarDisponibilidad(
      HAMBURGUESA,
      [{ insumoId: 'papa', qtyBase: 250 }],
      almacen(
        insumo('papa', 'Papa', -13776, {
          criticality: 'ALTA',
          contadoAlgunaVez: false,
        }),
      ),
    );
    expect(r.estado).toBe('SIN_LINEA_BASE');
  });

  it('un servicio siempre está disponible', () => {
    const r = evaluarDisponibilidad(
      { _id: 'alquiler', esServicio: true },
      [],
      almacen(),
    );
    expect(r.estado).toBe('OK');
  });

  it('un producto sin naturaleza decidida es SIN_CONTROL', () => {
    const r = evaluarDisponibilidad(
      { _id: 'x', naturalezaPendiente: true },
      [],
      almacen(),
    );
    expect(r.estado).toBe('SIN_CONTROL');
  });

  it('un ingrediente que ya no existe avisa, pero no dice "agotado"', () => {
    // El problema es la receta rota, no el stock: mandar al mesonero a buscar
    // algo que no existe no le sirve de nada.
    const r = evaluarDisponibilidad(
      HAMBURGUESA,
      [{ insumoId: 'fantasma', qtyBase: 1 }],
      almacen(),
    );
    expect(r.estado).toBe('AVISO');
    expect(r.faltantes[0].name).toBe('ingrediente desconocido');
  });

  it('las porciones las manda el ingrediente que primero se acaba', () => {
    const r = evaluarDisponibilidad(
      HAMBURGUESA,
      [
        { insumoId: 'carne', qtyBase: 150 },
        { insumoId: 'pan', qtyBase: 1 },
      ],
      almacen(
        insumo('carne', 'Carne', 1500), // da para 10
        insumo('pan', 'Pan', 4), // da para 4
      ),
    );
    expect(r.estado).toBe('OK');
    expect(r.maxPorciones).toBe(4);
  });

  it('el stock justo para uno todavía es OK', () => {
    const r = evaluarDisponibilidad(
      HAMBURGUESA,
      [{ insumoId: 'carne', qtyBase: 150 }],
      almacen(insumo('carne', 'Carne', 150, { criticality: 'ALTA' })),
    );
    expect(r.estado).toBe('OK');
    expect(r.maxPorciones).toBe(1);
  });

  it('stock NEGATIVO no es "agotado": es que no se cargó la compra', () => {
    // Cocina lleva 86 de 87 filas en negativo por consumo sin reposición. Con
    // ese número no se puede afirmar que falte, y marcar 95 platos "agotados"
    // entrenaría a todos a ignorar el aviso.
    const r = evaluarDisponibilidad(
      HAMBURGUESA,
      [{ insumoId: 'papa', qtyBase: 250 }],
      almacen(insumo('papa', 'Papa', -13776, { criticality: 'ALTA' })),
    );
    expect(r.estado).toBe('SIN_LINEA_BASE');
  });
});
