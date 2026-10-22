import type { ExpenseDraft, Step } from './draft';

/**
 * QUE PREGUNTAR SEGUN EL TIPO DE GASTO.
 *
 * Antes todos los gastos generales pasaban por las mismas preguntas, y en la
 * mitad no tenian sentido. El dueño lo fue encontrando cargando gastos reales
 * el 17/09/2026: un prestamo preguntaba "¿Que se compro?" y despues "¿Donde
 * se compro?"; un Ridery ofrecia como proveedor a Viveluso y a Pollo Lolimar.
 * "puedes probar cada 1 de los flujos y ver que sea lo mas coherente posible".
 *
 * Cada categoria dice aqui, en un solo lugar, que es lo que hay que saber de
 * ella. Los pasos solo consultan este perfil.
 */
export interface PerfilGasto {
  /** El gasto va a alguien de la nomina: se elige al empleado activo. */
  aEmpleado: boolean;
  /** La pregunta de la descripcion, con un ejemplo de esa categoria. */
  queFue: string;
  /**
   * Tiene sentido preguntar a quien se le pago. Solo donde hay un tercero que
   * cambia de una vez a otra (el tecnico que reparo la nevera, la empresa del
   * internet). Un Ridery, una comision del banco o un impuesto no lo tienen.
   */
  aQuien: boolean;
}

const PERFILES: Array<[RegExp, PerfilGasto]> = [
  [/pr[ée]stamo|adelanto/i, { aEmpleado: true, queFue: '', aQuien: false }],
  [/personal|sueldo|bono|n[óo]mina/i, { aEmpleado: true, queFue: '', aQuien: false }],
  [/servicio|\bluz\b|agua|internet/i, { aEmpleado: false, queFue: '¿Qué servicio se pagó? (ej: luz, internet, gas)', aQuien: true }],
  [/alquiler/i, { aEmpleado: false, queFue: '¿De qué es el alquiler? (ej: local, septiembre)', aQuien: false }],
  [/transporte|delivery|flete/i, { aEmpleado: false, queFue: '¿Qué transporte fue? (ej: Ridery al mercado, delivery del hielo)', aQuien: false }],
  [/mantenimiento|reparaci/i, { aEmpleado: false, queFue: '¿Qué se reparó o mantuvo? (ej: nevera, aire acondicionado)', aQuien: true }],
  [/impuesto|permiso/i, { aEmpleado: false, queFue: '¿Qué impuesto o permiso? (ej: IVA, patente)', aQuien: false }],
  [/bancari|comisi[óo]n/i, { aEmpleado: false, queFue: '¿Qué cobró el banco? (ej: comisión del punto de venta)', aQuien: false }],
  [/publicidad/i, { aEmpleado: false, queFue: '¿Qué publicidad fue? (ej: anuncio en Instagram)', aQuien: true }],
];

/** Lo que no encaja en ninguna (Otros, o una categoria escrita a mano). */
const GENERICO: PerfilGasto = { aEmpleado: false, queFue: '¿Qué se pagó? Escribe una descripción corta.', aQuien: true };

export function perfilDe(categoria: string | null): PerfilGasto {
  if (!categoria) return GENERICO;
  return PERFILES.find(([r]) => r.test(categoria))?.[1] ?? GENERICO;
}

/**
 * Despues de saber a quien va el gasto (o de saltarlo): al pago, o directo a
 * los fondos.
 *
 * "¿Contado o credito?" solo tiene sentido si hay alguien a quien deberle. Un
 * Ridery, un prestamo o una comision del banco se pagan en el momento, asi
 * que se da por contado en vez de ofrecer un "Credito" que no significa nada.
 */
export function trasElDestinatario(d: ExpenseDraft): { draft: ExpenseDraft; next: Step } {
  if (d.kind === 'GENERAL' && !d.supplierName) {
    return { draft: { ...d, paymentStatus: 'PAID' }, next: 'FUNDS' };
  }
  return { draft: d, next: 'PAYMENT' };
}

/** Hay a quien deberle: solo entonces se pregunto "¿Contado o credito?". */
export const sePreguntoElPago = (d: ExpenseDraft): boolean => d.kind === 'INSUMOS' || !!d.supplierName;
