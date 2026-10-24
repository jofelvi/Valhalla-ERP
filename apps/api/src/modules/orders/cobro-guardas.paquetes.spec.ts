import { PisoDeLinea, primerPrecioBajo } from './cobro-guardas.util';

// 24/10/2026, evento: "Tequeños (12 unidades)" a $8 llegaba como 12 unidades a $0.6667 y el
// servidor lo rechazaba con "Precio inválido" porque comparaba contra los $8 del paquete.
describe('primerPrecioBajo con productos por paquete', () => {
  const pisos = new Map<string, PisoDeLinea>([
    [
      'teq',
      { nombre: 'Tequeños (12 unidades)', piso: 8, precio: 8, combo: false },
    ],
    ['ron', { nombre: 'Ron', piso: 5, precio: 5, combo: false }],
  ]);
  const linea = (o: Record<string, unknown>) => ({ productId: 'teq', ...o });

  it('acepta 1 y 2 paquetes repartidos por unidad', () => {
    expect(
      primerPrecioBajo(
        [linea({ quantity: 12, unitPrice: 8 / 12, presentationQty: 12 })],
        pisos,
        [],
      ),
    ).toBeNull();
    expect(
      primerPrecioBajo(
        [linea({ quantity: 24, unitPrice: 8 / 12, presentationQty: 12 })],
        pisos,
        [],
      ),
    ).toBeNull();
  });

  it('rechaza un paquete por debajo de su precio', () => {
    expect(
      primerPrecioBajo(
        [linea({ quantity: 12, unitPrice: 0.5, presentationQty: 12 })],
        pisos,
        [],
      ),
    ).toBe('Tequeños (12 unidades)');
  });

  it('rechaza unidades sueltas que no completan paquetes', () => {
    expect(
      primerPrecioBajo(
        [linea({ quantity: 1, unitPrice: 8 / 1000, presentationQty: 1000 })],
        pisos,
        [],
      ),
    ).toBe('Tequeños (12 unidades)');
  });

  it('sin paquete sigue exigiendo el precio completo', () => {
    expect(
      primerPrecioBajo(
        [{ productId: 'ron', quantity: 1, unitPrice: 4 }],
        pisos,
        [],
      ),
    ).toBe('Ron');
  });
});
