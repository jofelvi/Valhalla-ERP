import { descriptionStep, esGastoDePersonal } from './description.step';
import { resumenDe } from './summary.step';
import { draftVacio, EmpleadoRef, ExpenseDraft, StepDeps } from '../draft';

/**
 * UN PRESTAMO NO SE DESCRIBE, SE LE ASIGNA A ALGUIEN.
 *
 * "es un prestamo y porque me pregunta cual es el concepto?? no tiene sentido"
 * (dueño, 17/09/2026). Habia cargado un prestamo de Bs 12.711,66 y el bot le
 * pregunto "¿Que se compro?"; el escribio "Es un préstamo", que es justo lo
 * que ya decia la categoria. Lo que faltaba saber es A QUIEN, porque de eso
 * depende poder cobrarselo.
 */
const PLANTILLA: EmpleadoRef[] = [
  { id: '1', name: 'Abby Andreina Cabeza Barreto', position: 'mesera' },
  { id: '2', name: 'Carlos Andrade', position: 'Bartender' },
  { id: '3', name: 'Daniel Jose Vargas Campero', position: 'PIZZERO' },
  { id: '4', name: 'Geraldin', position: 'MESONERA' },
  { id: '5', name: 'Jostin Vasquez', position: 'Bartender' },
  { id: '6', name: 'jhan frank vasquez', position: 'MESONERO' },
];

const deps = (empleados = PLANTILLA): StepDeps =>
  ({
    listActiveEmployees: jest.fn().mockResolvedValue(empleados),
  }) as unknown as StepDeps;

const header = {
  total: 12711.66,
  currency: 'BS' as const,
  date: null,
  rif: null,
  vendor: null,
  amounts: [],
  totalCandidates: [],
  esPago: false,
  concepto: null,
};

const prestamo = (): ExpenseDraft => ({
  ...draftVacio('u', '', header),
  kind: 'GENERAL',
  category: 'Préstamos al personal',
});

describe('esGastoDePersonal', () => {
  it('reconoce las categorias donde el gasto va a una persona', () => {
    expect(esGastoDePersonal('Préstamos al personal')).toBe(true);
    expect(esGastoDePersonal('Personal (sueldos y bonos)')).toBe(true);
    expect(esGastoDePersonal('Adelanto de nómina')).toBe(true);
  });

  it('no se mete donde no debe', () => {
    expect(esGastoDePersonal('Transporte y delivery')).toBe(false);
    expect(esGastoDePersonal('Gastos bancarios')).toBe(false);
    expect(esGastoDePersonal(null)).toBe(false);
  });
});

describe('descriptionStep — prestamo al personal', () => {
  it('pregunta a quien, no que se compro', async () => {
    const r = await descriptionStep.prompt(prestamo(), deps());
    expect(r.text).toMatch(/a qui[ée]n se le prest[óo]/i);
    expect(r.text).not.toMatch(/qu[ée] se compr[óo]/i);
    const datas = r.buttons?.flat().map((b) => b.data) ?? [];
    expect(datas).toContain('emp:0');
    expect(r.buttons?.flat().map((b) => b.label)).toContain('Carlos Andrade');
  });

  it('un sueldo pregunta de quien es el pago', async () => {
    const d = { ...prestamo(), category: 'Personal (sueldos y bonos)' };
    expect((await descriptionStep.prompt(d, deps())).text).toMatch(
      /de qui[ée]n es este pago/i,
    );
  });

  it('tocar el nombre deja el prestamo con dueño', async () => {
    const d = prestamo();
    await descriptionStep.prompt(d, deps());
    const r = await descriptionStep.handle(
      { kind: 'callback', data: 'emp:1' },
      d,
      deps(),
    );
    expect(r.draft.employeeId).toBe('2');
    expect(r.draft.employeeName).toBe('Carlos Andrade');
    expect(r.draft.description).toBe('Carlos Andrade');
    // Sin "¿Dónde se compró?" ni "¿Contado o crédito?": directo a los fondos.
    expect(r.next).toBe('FUNDS');
    expect(r.draft.paymentStatus).toBe('PAID');
  });

  it('escribir el nombre tambien vale, sin acentos ni mayusculas', async () => {
    const d = prestamo();
    await descriptionStep.prompt(d, deps());
    const r = await descriptionStep.handle(
      { kind: 'text', text: 'geraldin' },
      d,
      deps(),
    );
    expect(r.draft.employeeName).toBe('Geraldin');
    expect(r.next).toBe('FUNDS');
  });

  it('si el nombre coincide con varios, los ofrece con su cargo', async () => {
    const d = prestamo();
    await descriptionStep.prompt(d, deps());
    const r = await descriptionStep.handle(
      { kind: 'text', text: 'vasquez' },
      d,
      deps(),
    );
    expect(r.next).toBe('STAY');
    expect(r.reply?.text).toMatch(/2 que coinciden/i);
    expect(r.reply?.buttons?.flat().map((b) => b.label)).toEqual([
      'Jostin Vasquez (Bartender)',
      'jhan frank vasquez (MESONERO)',
      '❌ Cancelar',
    ]);
  });

  it('un nombre que no existe NO se acepta como texto libre', async () => {
    // Un prestamo sin dueño no se le puede cobrar a nadie: antes "Es un
    // préstamo" quedaba guardado como si fuera la descripcion util.
    const d = prestamo();
    await descriptionStep.prompt(d, deps());
    const r = await descriptionStep.handle(
      { kind: 'text', text: 'Es un préstamo' },
      d,
      deps(),
    );
    expect(r.next).toBe('STAY');
    expect(r.draft.employeeId).toBeNull();
    expect(r.reply?.text).toMatch(/no encontr[ée] a nadie activo/i);
    expect(r.reply?.buttons?.flat().length).toBeGreaterThan(1);
  });

  it('un boton de un mensaje viejo relee la lista en vez de dejarlo colgado', async () => {
    const d = prestamo(); // sin prompt previo: employeeOptions vacio
    const r = await descriptionStep.handle(
      { kind: 'callback', data: 'emp:2' },
      d,
      deps(),
    );
    expect(r.next).toBe('STAY');
    expect(r.reply?.buttons?.flat().map((b) => b.data)).toContain('emp:0');
  });
});

describe('descriptionStep — un gasto normal no cambia', () => {
  it('un transporte pregunta que transporte fue', async () => {
    const d = { ...prestamo(), category: 'Transporte y delivery' };
    const r = await descriptionStep.prompt(d, deps());
    expect(r.text).toMatch(/qué transporte fue/i);
    const s = await descriptionStep.handle(
      { kind: 'text', text: 'Taxi del hielo' },
      d,
      deps(),
    );
    expect(s.draft.description).toBe('Taxi del hielo');
    expect(s.draft.employeeId).toBeNull();
  });
});

describe('resumen de un prestamo', () => {
  it('dice de quien es la deuda antes de confirmar', () => {
    const d: ExpenseDraft = {
      ...prestamo(),
      employeeId: '2',
      employeeName: 'Carlos Andrade',
      description: 'Carlos Andrade',
      currency: 'BS',
      amount: 12711.66,
      exchangeRate: 847.4442,
      paymentStatus: 'PAID',
      fundsSource: 'EMPRESA',
    };
    const t = resumenDe(d);
    expect(t).toContain('Préstamos al personal');
    expect(t).toContain('Carlos Andrade');
    expect(t).toContain('Bs 12.711,66');
  });
});

describe('borradores guardados antes de 1.6.0', () => {
  // Las conversaciones viven 2 h en Mongo: al desplegar, una que estaba a
  // medias llega SIN los campos nuevos. El 17/09 habia una abierta justo en
  // este paso (el prestamo de Bs 12.711,66).
  const viejo = (): ExpenseDraft => {
    const d = prestamo() as Partial<ExpenseDraft>;
    delete d.employeeOptions;
    delete d.amountOptions;
    return d as ExpenseDraft;
  };

  it('escribir el nombre funciona aunque el borrador no traiga la lista', async () => {
    const r = await descriptionStep.handle(
      { kind: 'text', text: 'carlos' },
      viejo(),
      deps(),
    );
    expect(r.draft.employeeName).toBe('Carlos Andrade');
  });

  it('un boton sin lista vuelve a mostrar los empleados en vez de reventar', async () => {
    const r = await descriptionStep.handle(
      { kind: 'callback', data: 'emp:0' },
      viejo(),
      deps(),
    );
    expect(r.next).toBe('STAY');
    expect(r.reply?.buttons?.flat().map((b) => b.data)).toContain('emp:0');
  });

  it('el paso del monto tampoco revienta', async () => {
    const { amountStep } = jest.requireActual(
      './amount.step',
    ) as typeof import('./amount.step');
    await expect(amountStep.prompt(viejo(), deps())).resolves.toBeDefined();
  });
});

describe('atras en un prestamo', () => {
  it('desde el pago vuelve al empleado, no a un proveedor que nunca se pregunto', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pasoAnterior } = require('../atras') as typeof import('../atras');
    expect(pasoAnterior('PAYMENT', prestamo())).toBe('DESCRIPTION');
    expect(
      pasoAnterior('PAYMENT', {
        ...prestamo(),
        category: 'Mantenimiento y reparaciones',
      }),
    ).toBe('SUPPLIER');
  });
});
