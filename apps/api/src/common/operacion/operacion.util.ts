import { OperacionConfig, OPERACION_DEFAULT } from '@odin6/types';

/**
 * Utilidad única de operación: fechas, jornada, semana y teléfonos según `operacion` del
 * contrato de configuración. Ningún módulo calcula UTC-4, zona horaria, jornada ni prefijo
 * telefónico por su cuenta: todo pasa por aquí.
 *
 * Las funciones son puras (reciben la configuración), así que se prueban sin Mongo.
 * El servicio que las llama lee `operacion` con `ConfigsService.obtener('operacion')`.
 */

const MS_DIA = 86_400_000;

/** Hora de pared (lo que marca un reloj) de un instante, en una zona IANA. */
export interface Pared {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateadorDeZona(timezone: string): Intl.DateTimeFormat {
  let f = formateadores.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formateadores.set(timezone, f);
  }
  return f;
}

/** Hora de pared de un instante en `timezone`. */
export function paredEnZona(instante: Date, timezone: string): Pared {
  const partes = formateadorDeZona(timezone).formatToParts(instante);
  const n = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return {
    anio: n('year'),
    mes: n('month'),
    dia: n('day'),
    hora: n('hour'),
    minuto: n('minute'),
    segundo: n('second'),
  };
}

/** Desfase (ms) de `timezone` respecto a UTC en ese instante. */
function desfaseMs(instante: Date, timezone: string): number {
  const p = paredEnZona(instante, timezone);
  const comoUtc = Date.UTC(
    p.anio,
    p.mes - 1,
    p.dia,
    p.hora,
    p.minuto,
    p.segundo,
  );
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/**
 * Instante real que marca el reloj de `timezone` en la fecha y hora dadas. Resuelve el
 * horario de verano con una segunda pasada (las zonas sin DST dan la misma respuesta).
 */
export function instanteDePared(
  anio: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  timezone: string,
): Date {
  const comoUtc = Date.UTC(anio, mes - 1, dia, hora, minuto);
  const desfase = desfaseMs(new Date(comoUtc), timezone);
  let instante = comoUtc - desfase;
  const corregido = desfaseMs(new Date(instante), timezone);
  if (corregido !== desfase) instante = comoUtc - corregido;
  return new Date(instante);
}

/** `YYYY-MM-DD` de una fecha calendario (sin hora). */
const aIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Fecha calendario `YYYY-MM-DD` (en la zona de la operación) de un instante. */
export function fechaCalendario(instante: Date, op: OperacionConfig): string {
  const p = paredEnZona(instante, op.timezone);
  return aIso(Date.UTC(p.anio, p.mes - 1, p.dia));
}

/**
 * Día de negocio (`YYYY-MM-DD`) al que pertenece un instante. Lo vendido antes de
 * `businessDayStartHour` cuenta para el día anterior.
 */
export function diaDeNegocio(instante: Date, op: OperacionConfig): string {
  const p = paredEnZona(instante, op.timezone);
  let ms = Date.UTC(p.anio, p.mes - 1, p.dia);
  if (p.hora < op.businessDayStartHour) ms -= MS_DIA;
  return aIso(ms);
}

/** Instante en que arranca el día de negocio `fecha` (`YYYY-MM-DD`). */
export function inicioDeJornada(fecha: string, op: OperacionConfig): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return instanteDePared(
    anio,
    mes,
    dia,
    op.businessDayStartHour,
    0,
    op.timezone,
  );
}

/** Instante en que arranca el día de negocio al que pertenece `instante`. */
export function inicioDeJornadaDe(instante: Date, op: OperacionConfig): Date {
  return inicioDeJornada(diaDeNegocio(instante, op), op);
}

/** Instante en que termina (inclusive) el día de negocio `fecha`. */
export function finDeJornada(fecha: string, op: OperacionConfig): Date {
  const siguiente = aIso(Date.parse(`${fecha}T00:00:00Z`) + MS_DIA);
  return new Date(inicioDeJornada(siguiente, op).getTime() - 1);
}

/**
 * Primer día (`YYYY-MM-DD`) de la semana que contiene la fecha `fecha` (`YYYY-MM-DD`), según
 * `weekStartsOn` (0 = domingo … 6 = sábado).
 */
export function primerDiaDeSemanaDe(
  fecha: string,
  weekStartsOn: number,
): string {
  const diaSemana = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  const retroceso = (diaSemana - weekStartsOn + 7) % 7;
  return aIso(Date.parse(`${fecha}T00:00:00Z`) - retroceso * MS_DIA);
}

/**
 * Primer día (`YYYY-MM-DD`) de la semana que contiene `instante`, según el día de negocio (no el
 * calendario): lo vendido de madrugada cuenta para el día anterior.
 */
function primerDiaDeSemana(instante: Date, op: OperacionConfig): string {
  return primerDiaDeSemanaDe(diaDeNegocio(instante, op), op.weekStartsOn);
}

/**
 * Inicio de la semana de negocio que contiene `instante`: el día `weekStartsOn` a la hora
 * de arranque de la jornada.
 */
export function inicioDeSemana(instante: Date, op: OperacionConfig): Date {
  return inicioDeJornada(primerDiaDeSemana(instante, op), op);
}

/**
 * Medianoche (00:00 de la zona) del primer día de la semana que contiene `instante`. Es la
 * clave de los informes semanales: no depende de la hora de arranque de la jornada.
 */
export function medianocheDeSemana(instante: Date, op: OperacionConfig): Date {
  return medianocheDe(primerDiaDeSemana(instante, op), op);
}

/**
 * Medianoche UTC del día calendario (zona de la operación) que contiene `instante`. Es la
 * clave de los documentos «por día» (p. ej. el almacén diario): siempre la misma fecha
 * independientemente de la zona del servidor.
 */
export function fechaDeCalendarioUtc(
  instante: Date,
  op: OperacionConfig,
): Date {
  return new Date(`${fechaCalendario(instante, op)}T00:00:00Z`);
}

/** Medianoche calendario (00:00) de `fecha` en la zona de la operación. */
export function medianocheDe(fecha: string, op: OperacionConfig): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return instanteDePared(anio, mes, dia, 0, 0, op.timezone);
}

/** Último milisegundo (23:59:59.999) del día calendario `fecha`. */
export function finDeDiaCalendario(fecha: string, op: OperacionConfig): Date {
  const siguiente = aIso(Date.parse(`${fecha}T00:00:00Z`) + MS_DIA);
  return new Date(medianocheDe(siguiente, op).getTime() - 1);
}

const dos = (n: number): string => String(n).padStart(2, '0');

/*
 * Formatos numéricos (dd/mm, dd/mm/aaaa, hh:mm). Se arman con las partes de la zona y no con
 * `Intl` + `'2-digit'`: en Node, `es-VE` no rellena el día ni el mes («1/9» en vez de «01/09»).
 */

/** `dd/mm` en la zona indicada. */
export function diaMes(instante: Date, timezone: string): string {
  const p = paredEnZona(instante, timezone);
  return `${dos(p.dia)}/${dos(p.mes)}`;
}

/** `dd/mm/aaaa` en la zona indicada. */
export function diaMesAnio(instante: Date, timezone: string): string {
  const p = paredEnZona(instante, timezone);
  return `${dos(p.dia)}/${dos(p.mes)}/${p.anio}`;
}

/** `hh:mm` (24 h) en la zona indicada. */
export function horaMinuto(instante: Date, timezone: string): string {
  const p = paredEnZona(instante, timezone);
  return `${dos(p.hora)}:${dos(p.minuto)}`;
}

/** Fecha y hora (`dd/mm/aaaa hh:mm`, 24 h) de un instante en la zona de la operación. */
export function formatearFechaHora(
  instante: Date,
  op: OperacionConfig,
): string {
  return `${diaMesAnio(instante, op.timezone)} ${horaMinuto(instante, op.timezone)}`;
}

/** Formatea un instante en la zona y el locale de la operación. */
export function formatearFecha(
  instante: Date,
  op: OperacionConfig,
  opciones: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(op.locale, {
    timeZone: op.timezone,
    ...opciones,
  }).format(instante);
}

/**
 * Celulares por país (ISO 3166-1 alfa-2): prefijos móviles sin el 0 de troncal y largo del
 * número nacional. Un fijo no recibe SMS, así que sin prefijo de celular no se envía. Solo VE
 * viene sembrado; para otro país se agrega su fila aquí (no es un dato del contrato).
 */
export const CELULARES_POR_PAIS: Record<
  string,
  { prefijos: readonly string[]; largoNacional: number }
> = {
  VE: {
    prefijos: ['412', '414', '416', '422', '424', '426'],
    largoNacional: 10,
  },
};

/**
 * Celular en E.164 para enviar un SMS. Acepta el formato local con 0 de troncal, el nacional
 * sin 0, el internacional con el prefijo del país o un número `+` de otro país. Devuelve `null`
 * si no es un celular del país de la operación: mejor no mandar que gastar en un número que no
 * puede recibir el mensaje (y que, si es ajeno, expondría el consumo de un cliente).
 */
export function celularE164(
  raw: string | null | undefined,
  op: OperacionConfig,
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  const celulares = CELULARES_POR_PAIS[op.country];
  const prefijo = op.phonePrefix;
  if (celulares) {
    const largo = celulares.largoNacional;
    let local: string | null = null;
    if (digits.length === largo + 1 && digits.startsWith('0')) {
      local = digits.slice(1);
    } else if (digits.length === largo) {
      local = digits;
    } else if (
      digits.startsWith(prefijo) &&
      digits.length === prefijo.length + largo
    ) {
      local = digits.slice(prefijo.length);
    }
    if (local && celulares.prefijos.some((p) => local.startsWith(p))) {
      return `+${prefijo}${local}`;
    }
  }

  // Internacional que ya venga con + y no sea del país: se respeta tal cual.
  if (
    raw.trim().startsWith('+') &&
    !digits.startsWith(prefijo) &&
    digits.length >= 11
  ) {
    return `+${digits}`;
  }
  return null;
}

/**
 * Teléfono en E.164 (`+<prefijo><número>`). Acepta formato local con 0 inicial
 * (`0414-0000006`), internacional con `00` o con el prefijo ya puesto. Devuelve `null` si no
 * hay dígitos suficientes.
 */
export function toE164(
  telefono: string,
  phonePrefix: string = OPERACION_DEFAULT.phonePrefix,
): string | null {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length < 7) return null;
  if (digitos.startsWith('00')) return `+${digitos.slice(2)}`;
  if (digitos.startsWith('0')) return `+${phonePrefix}${digitos.slice(1)}`;
  if (
    digitos.startsWith(phonePrefix) &&
    digitos.length >= phonePrefix.length + 7
  ) {
    return `+${digitos}`;
  }
  return `+${phonePrefix}${digitos}`;
}
