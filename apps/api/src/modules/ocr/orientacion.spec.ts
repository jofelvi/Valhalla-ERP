import { puntajeDeLectura, PUNTAJE_MINIMO_DERECHA } from './orientacion';

describe('puntajeDeLectura', () => {
  it('una foto acostada no lee nada: por debajo del minimo', () => {
    expect(puntajeDeLectura('')).toBeLessThan(PUNTAJE_MINIMO_DERECHA);
    expect(puntajeDeLectura('ss\n:e30N _,\nop oJuou 9')).toBeLessThan(
      PUNTAJE_MINIMO_DERECHA,
    );
  });

  it('un Pago Movil derecho pasa el minimo y no gasta giros', () => {
    const pago =
      'PagomóvilBDV Personas\n52.541,54 Bs\nFecha: 17/09/2026\nOperación: 007369741836\nOrigen: 0102\nDestino: 04140000008\nBanco: 0134 - BANESCO\nConcepto: panes perro';
    expect(puntajeDeLectura(pago)).toBeGreaterThanOrEqual(
      PUNTAJE_MINIMO_DERECHA,
    );
  });

  it('la lectura derecha le gana a la leida al reves', () => {
    // Fragmentos reales de la misma foto de Viveluso girada a 270 y a 90.
    const derecha =
      'Presupuesto: 97024114\nDescripción Cantidad Unid, Precio Unit\nA0148 ACEIT SOL Y OLIVA CARBONEL CAJA 0.201 CAJ 146.61\nQ0243 QUESO MOZZARELLA PALMIRA KILO 30.480 KG 10.24';
    const reves =
      '2qup oJUauIMDog 9359\n) cobed ap eu.\n-o5ed ¡PP eJP ¡PP o\nEZ Ñ V5108 VASVAV YO 14 TIVY DAS ONINODIA 3NO';
    expect(puntajeDeLectura(derecha)).toBeGreaterThan(puntajeDeLectura(reves));
  });
});
