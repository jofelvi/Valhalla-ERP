import { entradaAlInventario, type UnidadDeInventario } from './unidades-inventario';
import type { DraftLine } from './draft';

const kilo: UnidadDeInventario = { presentation: 'Kilogramo', presentationQuantity: 1, base: 'GR' };
const litro: UnidadDeInventario = { presentation: 'Litro', presentationQuantity: 1, base: 'ML' };
const huevo: UnidadDeInventario = { presentation: 'Unidad', presentationQuantity: 30, base: 'UND' };
const linea = (quantity: number, unit: DraftLine['unit'], unitsPerPack: number | null = null): DraftLine => ({
  invoiceText: '', productId: 'p', productName: 'x', quantity, unit, unitCost: 1, unitsPerPack, confirmed: false,
});

describe('entradaAlInventario (prueba real Viveluso, 18/09/2026)', () => {
  it('15 "und" de papas en un producto que se lleva en kilos: se avisa antes de confirmar', () => {
    const r = entradaAlInventario(linea(15, 'und'), kilo);
    expect(r).toEqual({ ok: false, texto: expect.stringContaining('se lleva en kg') });
  });

  it('los kilos entran como kilos', () => {
    expect(entradaAlInventario(linea(28.16, 'kg'), kilo)).toEqual({ ok: true, texto: '→ inventario: 28,16 kg' });
  });

  it('una caja con contenido de la factura: 0,834 cajas de 12 litros', () => {
    expect(entradaAlInventario(linea(0.834, 'unidad-compra', 12), litro)).toEqual({ ok: true, texto: '→ inventario: 10,008 L' });
  });

  it('sin contenido en la factura usa el del catalogo, y lo muestra para que se vea si esta mal', () => {
    // 1 caja de 12 cartones de huevos: el catalogo dice 30 por caja.
    expect(entradaAlInventario(linea(1, 'unidad-compra'), huevo)).toEqual({ ok: true, texto: '→ inventario: 30 und' });
  });

  it('sin producto elegido no dice nada', () => {
    expect(entradaAlInventario(linea(1, 'und'), undefined)).toBeNull();
  });
});
