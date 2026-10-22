import { CANCELAR } from '../draft';
import type { Boton, EmpleadoRef, ExpenseDraft, Reply, Step, StepHandler } from '../draft';
import { perfilDe, trasElDestinatario } from '../perfil-gasto';

/**
 * Que sigue a la descripcion:
 *   - insumos: el pago (el proveedor ya fue la segunda pregunta);
 *   - un gasto con un tercero que varia (reparacion, servicio): a quien se le pago;
 *   - el resto (transporte, banco, impuestos): directo a los fondos, de contado.
 */
function siguiente(d: ExpenseDraft): { draft: ExpenseDraft; next: Step } {
  if (d.kind === 'INSUMOS') return { draft: d, next: 'PAYMENT' };
  if (perfilDe(d.category).aQuien) return { draft: d, next: 'SUPPLIER' };
  return trasElDestinatario(d);
}

/**
 * Categorias donde el gasto va A UNA PERSONA, no a un proveedor.
 *
 * "es un prestamo y porque me pregunta cual es el concepto?? no tiene sentido"
 * (dueño, 17/09/2026): en un prestamo o un sueldo, preguntar "¿que se compro?"
 * es la pregunta equivocada —el se limito a escribir "Es un préstamo", que ya
 * lo decia la categoria—. Lo que hay que saber es a quien se le dio, porque de
 * eso depende poder cobrarselo despues.
 */
export const esGastoDePersonal = (categoria: string | null): boolean => perfilDe(categoria).aEmpleado;

/** Para no hacer scroll en el telefono: dos por fila. */
const filasDeDos = (bs: Boton[]): Boton[][] =>
  bs.reduce<Boton[][]>((filas, b, i) => (i % 2 ? (filas[filas.length - 1].push(b), filas) : [...filas, [b]]), []);

/** Sin acentos y en minusculas, para que "geraldin" encuentre a "Geraldin". */
const plano = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const etiqueta = (e: EmpleadoRef) => (e.position ? `${e.name} (${e.position})` : e.name);

/** La pregunta de personal, con los empleados activos en botones. */
async function preguntarEmpleado(draft: ExpenseDraft, empleados: EmpleadoRef[]): Promise<Reply> {
  draft.employeeOptions = empleados;
  const esPrestamo = /pr[ée]stamo|adelanto/i.test(draft.category ?? '');
  return {
    text: esPrestamo
      ? '¿A quién se le prestó?\nToca su nombre o escríbelo.'
      : '¿De quién es este pago?\nToca su nombre o escríbelo.',
    buttons: [
      ...filasDeDos(empleados.map((e, i) => ({ label: e.name, data: `emp:${i}` }))),
      [CANCELAR],
    ],
  };
}

export const descriptionStep: StepHandler = {
  async prompt(draft, deps) {
    if (esGastoDePersonal(draft.category)) {
      return preguntarEmpleado(draft, await deps.listActiveEmployees());
    }
    if (draft.kind === 'INSUMOS') {
      return {
        text: 'Nota opcional (ej: "faltó una caja"). Escribe "-" para saltar.',
        buttons: [[{ label: 'Saltar', data: 'desc:skip' }], [CANCELAR]],
      };
    }
    // El concepto del Pago Movil ya viene escrito por quien pago: se ofrece
    // dejarlo tal cual en vez de pedirlo de nuevo.
    if (draft.description) {
      return {
        text: `Leí «${draft.description}» en el comprobante. ¿Lo dejo así?\nSi no, escribe otra descripción.`,
        buttons: [[{ label: '✅ Sí, dejarlo', data: 'desc:ok' }, { label: 'Quitarlo', data: 'desc:skip' }], [CANCELAR]],
      };
    }
    return {
      text: perfilDe(draft.category).queFue,
      buttons: [[{ label: 'Saltar', data: 'desc:skip' }], [CANCELAR]],
    };
  },

  async handle(input, draft, deps) {
    if (esGastoDePersonal(draft.category)) return asignarEmpleado(input, draft, deps);

    if (input.kind === 'callback') {
      if (input.data === 'desc:ok') return siguiente(draft);
      if (input.data === 'desc:skip') return siguiente({ ...draft, description: null });
      return { draft, next: 'STAY', reply: { text: 'Escribe la descripción o toca Saltar.' } };
    }
    const t = input.text.trim();
    return siguiente({ ...draft, description: t === '-' || !t ? null : t.slice(0, 200) });
  },
};

/**
 * Resuelve a quien va el gasto: por boton, o por lo que se escriba.
 *
 * Escribir tambien vale porque la lista puede crecer y porque es mas rapido
 * teclear "daisy" que buscar el boton. Si lo escrito no encuentra a nadie NO
 * se acepta como texto libre: un prestamo sin dueño no se le puede cobrar a
 * nadie.
 */
async function asignarEmpleado(
  input: { kind: 'text'; text: string } | { kind: 'callback'; data: string },
  draft: ExpenseDraft,
  deps: Parameters<StepHandler['handle']>[2],
) {
  // Sin "¿Dónde se compró?" (a un empleado no se le compra en ningun sitio) ni
  // "¿Contado o credito?" (un prestamo se entrega en el momento): directo a
  // los fondos. "coloque al empleado y luego me pregunto a donde se compro"
  // (dueño, 17/09/2026).
  const conEmpleado = (e: EmpleadoRef) =>
    trasElDestinatario({ ...draft, employeeId: e.id, employeeName: e.name, description: e.name });

  if (input.kind === 'callback') {
    if (!/^emp:\d+$/.test(input.data)) {
      return { draft, next: 'STAY' as const, reply: { text: 'Toca el nombre de la persona o escríbelo.' } };
    }
    // `?? []`: un borrador guardado antes de 1.6.0 no trae este campo.
    const elegido = (draft.employeeOptions ?? [])[Number(input.data.slice(4))];
    if (elegido) return conEmpleado(elegido);
    // Boton de un mensaje viejo: se relee la lista en vez de dejarlo colgado.
    const frescos = await deps.listActiveEmployees();
    return {
      draft,
      next: 'STAY' as const,
      reply: await preguntarEmpleado(draft, frescos),
    };
  }

  const busqueda = plano(input.text);
  if (!busqueda) return { draft, next: 'STAY' as const, reply: { text: 'Escribe el nombre de la persona.' } };

  const activos = draft.employeeOptions?.length ? draft.employeeOptions : await deps.listActiveEmployees();
  const coincide = activos.filter((e) => plano(e.name).includes(busqueda));
  if (coincide.length === 1) return conEmpleado(coincide[0]);
  if (coincide.length > 1) {
    draft.employeeOptions = coincide;
    return {
      draft,
      next: 'STAY' as const,
      reply: {
        text: `Hay ${coincide.length} que coinciden con "${input.text.trim()}". ¿Cuál es?`,
        buttons: [...filasDeDos(coincide.map((e, i) => ({ label: etiqueta(e), data: `emp:${i}` }))), [CANCELAR]],
      },
    };
  }
  return {
    draft,
    next: 'STAY' as const,
    reply: {
      text: `No encontré a nadie activo con "${input.text.trim()}". Toca uno de la lista:`,
      buttons: [...filasDeDos(activos.map((e, i) => ({ label: e.name, data: `emp:${i}` }))), [CANCELAR]],
    },
  };
}
