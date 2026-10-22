import { OperacionConfig, OPERACION_DEFAULT } from '@odin6/types';
import {
  celularE164,
  diaDeNegocio,
  fechaCalendario,
  finDeDiaCalendario,
  finDeJornada,
  formatearFecha,
  inicioDeJornada,
  inicioDeJornadaDe,
  inicioDeSemana,
  instanteDePared,
  medianocheDe,
  paredEnZona,
  toE164,
} from './operacion.util';

const caracas: OperacionConfig = { ...OPERACION_DEFAULT };
const nuevaYork: OperacionConfig = {
  ...OPERACION_DEFAULT,
  country: 'US',
  timezone: 'America/New_York',
  locale: 'en-US',
  phonePrefix: '1',
  businessDayStartHour: 0,
  weekStartsOn: 0,
};

describe('operacion: jornada y día de negocio', () => {
  it('antes de la hora de arranque cuenta para el día anterior', () => {
    // Caracas es UTC-4: 05:59 local = 09:59Z (día 03); 06:00 local = 10:00Z (día 04).
    expect(diaDeNegocio(new Date('2026-08-04T09:59:00Z'), caracas)).toBe(
      '2026-08-03',
    );
    expect(diaDeNegocio(new Date('2026-08-04T10:00:00Z'), caracas)).toBe(
      '2026-08-04',
    );
  });

  it('la jornada arranca a la hora configurada, en la zona de la operación', () => {
    expect(inicioDeJornada('2026-08-04', caracas).toISOString()).toBe(
      '2026-08-04T10:00:00.000Z',
    );
    expect(
      inicioDeJornadaDe(
        new Date('2026-08-04T12:00:00Z'),
        caracas,
      ).toISOString(),
    ).toBe('2026-08-04T10:00:00.000Z');
  });

  it('la jornada termina 1 ms antes del arranque del día siguiente', () => {
    expect(finDeJornada('2026-08-04', caracas).toISOString()).toBe(
      '2026-08-05T09:59:59.999Z',
    );
  });

  it('respeta una hora de arranque distinta (cierre de madrugada)', () => {
    const cierre3am: OperacionConfig = { ...caracas, businessDayStartHour: 3 };
    // 02:30 local del 5 de agosto (06:30Z) todavía es la jornada del 4.
    expect(diaDeNegocio(new Date('2026-08-05T06:30:00Z'), cierre3am)).toBe(
      '2026-08-04',
    );
  });

  it('la fecha calendario ignora la jornada', () => {
    expect(fechaCalendario(new Date('2026-08-04T09:59:00Z'), caracas)).toBe(
      '2026-08-04',
    );
  });
});

describe('operacion: semana de negocio', () => {
  it('empieza el día weekStartsOn a la hora de la jornada', () => {
    // Miércoles 21/10/2026 (Caracas) → semana del lunes 19/10 a las 06:00 locales.
    const inicio = inicioDeSemana(new Date('2026-10-21T15:00:00Z'), caracas);
    expect(inicio.toISOString()).toBe('2026-10-19T10:00:00.000Z');
  });

  it('con weekStartsOn=0 la semana arranca el domingo', () => {
    const inicio = inicioDeSemana(new Date('2026-10-21T15:00:00Z'), nuevaYork);
    expect(inicio.toISOString()).toBe('2026-10-18T04:00:00.000Z');
  });
});

describe('operacion: zona horaria con horario de verano', () => {
  it('medianoche de Nueva York antes y después del cambio de hora', () => {
    // El 8/3/2026 el cambio es a las 02:00: la medianoche aún es EST (UTC-5).
    expect(medianocheDe('2026-03-08', nuevaYork).toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    // Después del cambio, EDT (UTC-4).
    expect(medianocheDe('2026-03-09', nuevaYork).toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
  });

  it('fin de día calendario inclusive', () => {
    expect(finDeDiaCalendario('2026-08-04', caracas).toISOString()).toBe(
      '2026-08-05T03:59:59.999Z',
    );
  });

  it('instanteDePared y paredEnZona son inversas', () => {
    const instante = instanteDePared(2026, 7, 4, 13, 45, 'Europe/Berlin');
    expect(paredEnZona(instante, 'Europe/Berlin')).toMatchObject({
      anio: 2026,
      mes: 7,
      dia: 4,
      hora: 13,
      minuto: 45,
    });
  });

  it('formatea en la zona y el locale de la operación', () => {
    const texto = formatearFecha(new Date('2026-08-04T10:00:00Z'), caracas, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    expect(texto).toContain('04');
    expect(texto).toContain('06:00');
  });
});

describe('toE164', () => {
  it('convierte el formato local con 0 inicial', () => {
    expect(toE164('0414-0000003', '58')).toBe('+584140000003');
  });

  it('acepta el número ya con prefijo, con o sin +', () => {
    expect(toE164('+58 414 0000005', '58')).toBe('+584140000005');
    expect(toE164('584140000005', '58')).toBe('+584140000005');
  });

  it('usa el prefijo de la operación, no uno fijo', () => {
    expect(toE164('(212) 555-0100', '1')).toBe('+12125550100');
    expect(toE164('00 34 91 123 45 67', '1')).toBe('+34911234567');
  });

  it('devuelve null si no hay dígitos suficientes', () => {
    expect(toE164('123', '58')).toBeNull();
    expect(toE164('', '58')).toBeNull();
  });
});

describe('celularE164 (SMS: solo celulares del país de la operación)', () => {
  const VE: OperacionConfig = {
    ...OPERACION_DEFAULT,
    country: 'VE',
    phonePrefix: '58',
  };
  const PAIS_SIN_TABLA: OperacionConfig = {
    ...OPERACION_DEFAULT,
    country: 'XX',
    phonePrefix: '99',
  };

  it('convierte el celular venezolano en sus formas habituales', () => {
    expect(celularE164('0414-0000006', VE)).toBe('+584140000006');
    expect(celularE164('04140000006', VE)).toBe('+584140000006');
    expect(celularE164('4140000005', VE)).toBe('+584140000005');
    expect(celularE164('584140000005', VE)).toBe('+584140000005');
    expect(celularE164('+58 414 0000005', VE)).toBe('+584140000005');
  });

  it('no envía a fijos ni a números no reconocidos', () => {
    expect(celularE164('0212-5551234', VE)).toBeNull();
    expect(celularE164('sin telefono', VE)).toBeNull();
    expect(celularE164(null, VE)).toBeNull();
  });

  it('un país sin tabla de celulares no recibe SMS locales: solo un + internacional', () => {
    expect(celularE164('0414-0000006', PAIS_SIN_TABLA)).toBeNull();
    expect(celularE164('+1 555 0100 200', PAIS_SIN_TABLA)).toBe('+15550100200');
  });
});
