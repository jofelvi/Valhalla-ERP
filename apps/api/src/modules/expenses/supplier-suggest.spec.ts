import { sugerirProveedores, distancia, normalizar } from './supplier-suggest';

const proveedores = [
  { id: 'v', name: 'Viveluso', taxId: 'J-90000004-0' },
  { id: 'p', name: 'Polar', taxId: null },
  { id: 'm', name: 'Makro', taxId: 'J-90000003-0' },
  { id: 'q', name: 'Mercado Municipal' },
];

describe('normalizar', () => {
  it('quita acentos, puntuacion y mayusculas', () => {
    expect(normalizar('DISTRIBUIDORA VIVELUSO C.A.')).toBe(
      'distribuidora viveluso c a',
    );
  });
});

describe('distancia', () => {
  it('es cero para iguales y cuenta erratas', () => {
    expect(distancia('polar', 'polar')).toBe(0);
    expect(distancia('polar', 'p0lar')).toBe(1);
  });
});

describe('sugerirProveedores', () => {
  it('el RIF exacto manda aunque el nombre no se parezca', () => {
    const r = sugerirProveedores(
      { rif: 'J-90000004-0', vendor: 'DISTRIB. VVLSO' },
      proveedores,
    );
    expect(r[0].id).toBe('v');
  });

  it('el RIF no cruza persona/empresa: la letra importa, no solo los digitos', () => {
    const conLetraDistinta = [
      { id: 'v', name: 'Viveluso', taxId: 'V-90000005-0' },
      { id: 'j', name: 'Otra', taxId: 'J-90000004-0' },
    ];
    const r = sugerirProveedores(
      { rif: 'J-90000004-0', vendor: null },
      conLetraDistinta,
    );
    expect(r).toEqual([conLetraDistinta[1]]);
  });

  it('encuentra al proveedor cuando su nombre esta dentro de la razon social', () => {
    const r = sugerirProveedores(
      { rif: null, vendor: 'DISTRIBUIDORA VIVELUSO C.A.' },
      proveedores,
    );
    expect(r[0].id).toBe('v');
  });

  it('tolera una errata del OCR en el nombre', () => {
    const r = sugerirProveedores(
      { rif: null, vendor: 'P0LAR DISTRIBUCION' },
      proveedores,
    );
    expect(r[0].id).toBe('p');
  });

  it('sin parecido devuelve vacio, nunca inventa', () => {
    expect(
      sugerirProveedores(
        { rif: null, vendor: 'FERRETERIA EL TORNILLO' },
        proveedores,
      ),
    ).toEqual([]);
  });

  it('devuelve como mucho 3', () => {
    const muchos = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      name: `Polar ${i}`,
    }));
    expect(
      sugerirProveedores({ rif: null, vendor: 'POLAR' }, muchos).length,
    ).toBe(3);
  });
});
