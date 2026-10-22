import {
  costoManoDeObra,
  costoPorMinuto,
  costoTotalDelPlato,
} from './labor-cost.helper';

describe('costoPorMinuto', () => {
  // Nohelia (cocinera principal) gana $360 al mes. En la nomina eso es $90 a la
  // semana y $12,857 al dia; con jornada de 8 horas, $1,607 la hora.
  it('convierte el sueldo MENSUAL a minuto con la misma cuenta de la nomina', () => {
    expect(costoPorMinuto(360, 8)).toBeCloseTo(0.0268, 4);
    expect(costoPorMinuto(250, 8)).toBeCloseTo(0.0186, 4);
  });

  it('una jornada mas larga abarata el minuto', () => {
    expect(costoPorMinuto(360, 12)).toBeLessThan(costoPorMinuto(360, 8));
  });

  // Sin sueldo cargado el costo es CERO, no NaN: un NaN se propagaria al costo
  // del plato y dejaria el margen del menu en blanco sin que nadie se entere.
  it('devuelve 0 con datos ausentes o absurdos', () => {
    expect(costoPorMinuto(0, 8)).toBe(0);
    expect(costoPorMinuto(NaN, 8)).toBe(0);
    expect(costoPorMinuto(360, 0)).toBe(0);
    expect(costoPorMinuto(-100, 8)).toBe(0);
  });
});

describe('costoManoDeObra', () => {
  it('una pizza de 12 min del pizzero ($250/mes) cuesta $0,22 de mano de obra', () => {
    expect(costoManoDeObra(12, 250, 8)).toBeCloseTo(0.2232, 4);
  });

  it('un plato de 10 min de la jefa de cocina ($360/mes) cuesta $0,27', () => {
    expect(costoManoDeObra(10, 360, 8)).toBeCloseTo(0.2679, 4);
  });

  it('sin tiempo de preparacion no hay mano de obra', () => {
    expect(costoManoDeObra(0, 360, 8)).toBe(0);
    expect(costoManoDeObra(-5, 360, 8)).toBe(0);
  });
});

describe('costoTotalDelPlato', () => {
  // El costo de ingredientes queda intacto a proposito: es lo que vale la
  // materia prima en el kardex. La mano de obra se suma SOLO para el margen.
  it('suma ingredientes y mano de obra sin perder centavos', () => {
    expect(costoTotalDelPlato(1.85, 0.2232)).toBe(2.0732);
  });

  it('tolera faltantes', () => {
    expect(costoTotalDelPlato(1.85, 0)).toBe(1.85);
    expect(costoTotalDelPlato(0, 0.5)).toBe(0.5);
  });
});
