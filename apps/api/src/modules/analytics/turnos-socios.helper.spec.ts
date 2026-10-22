import { inicioDeSemana, socioDe, TurnosSocios } from './turnos-socios.helper';

// Mismo default que hoy usa cobros-incompletos: martes 25/08/2026 la
// administro Jonathan y el ciclo es Daisy -> Orlando -> Jonathan.
const turnos: TurnosSocios = {
  ciclo: ['Daisy', 'Orlando', 'Jonathan'],
  ancla: '2026-05-05T10:00:00.000Z',
  anclaIndice: 1,
  excepciones: {},
};

describe('inicioDeSemana', () => {
  it('un martes a las 6am VE arranca su propia semana', () => {
    const d = new Date('2026-05-05T10:00:00.000Z');
    expect(inicioDeSemana(d, turnos.ancla).toISOString()).toBe(
      '2026-05-05T10:00:00.000Z',
    );
  });

  it('un martes a las 5:59am VE todavia es de la semana anterior', () => {
    const d = new Date('2026-05-12T09:59:00.000Z');
    expect(inicioDeSemana(d, turnos.ancla).toISOString()).toBe(
      '2026-05-05T10:00:00.000Z',
    );
  });

  it('un lunes a las 10am VE pertenece a la semana que empezo el martes anterior', () => {
    const d = new Date('2026-09-07T14:00:00.000Z'); // lunes 7 sep 10am VE
    expect(inicioDeSemana(d, turnos.ancla).toISOString()).toBe(
      '2026-09-01T10:00:00.000Z',
    );
  });
});

describe('socioDe', () => {
  it('la semana del ancla es del socio en anclaIndice', () => {
    expect(socioDe(new Date('2026-05-05T10:00:00.000Z'), turnos)).toEqual({
      socio: 'Orlando',
      estimado: true,
    });
  });

  it('la semana del 25/08/2026 es de Jonathan (lo que confirmo el dueno)', () => {
    expect(socioDe(new Date('2026-08-25T10:00:00.000Z'), turnos).socio).toBe(
      'Jonathan',
    );
  });

  it('una excepcion manual pisa la rotacion y deja de ser estimada', () => {
    const conCambio = { ...turnos, excepciones: { '2026-08-25': 'Daisy' } };
    expect(socioDe(new Date('2026-08-25T10:00:00.000Z'), conCambio)).toEqual({
      socio: 'Daisy',
      estimado: false,
    });
  });
});
