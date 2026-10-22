import fs from 'fs';
import path from 'path';
import { log } from '../logger';
import { sendRawToPrinter } from './index';
import { cabecerasDelPrintService } from '../queue/printServiceKey';
import { API_URL, DIR_ESTADO_IMPRESORAS } from '../config';
import {
  ESC_INIT,
  ESC_ALIGN_CENTER,
  ESC_ALIGN_LEFT,
  ESC_INVERSE_ON,
  ESC_INVERSE_OFF,
  ESC_DOUBLE_WIDTH,
  ESC_NORMAL_SIZE,
  ESC_BOLD_ON,
  ESC_BOLD_OFF,
  LF,
  LINE_WIDTH,
  solidLine,
  encodeText,
  padCenter,
} from '../escpos/commands';

/**
 * Despacho de tickets con desvio automatico.
 *
 * POR QUE EXISTE (16/08/2026)
 * Durante 8 dias POS-BARRA no enumero en su conector USB y NADIE se entero:
 * send-raw entregaba los bytes al spooler ("OK bytes"), el print-service
 * marcaba el job 'done' en la API, y el watchdog limpiaba la cola de Windows
 * en silencio. 493 comandas de barra murieron sin una sola alerta.
 *
 * Ahora, antes de mandar, se consulta el estado que publica el watchdog
 * (`estado-impresoras.json`). Si la impresora de destino esta caida, el ticket
 * NO se pierde: sale por la impresora de respaldo con una banda que avisa de
 * donde venia y que hay que llevarlo a mano.
 */

// La carpeta sale del .env (ESTADO_IMPRESORAS_DIR) o es la del propio servicio.
// Ruta con barras normales: en Windows node las acepta y no hay que escapar
// nada. Escrito con barra invertida ('C:\carpeta\...') el \c y el \e se comen
// al compilar y el archivo queda en una ruta inexistente: el estado se leia
// vacio, toda impresora se veia sana y el desvio nunca se activaba.
const ARCHIVO_ESTADO =
  process.env.PRINTER_STATE_FILE ||
  path.join(DIR_ESTADO_IMPRESORAS, 'estado-impresoras.json');

// Cuanto se confia en la ultima lectura del archivo antes de releerlo.
const TTL_ESTADO_MS = 2000;

// Tras un fallo directo, se da por caida localmente este tiempo para que los
// tickets siguientes vayan derecho al respaldo y no coman el timeout completo.
const CUARENTENA_MS = Number(process.env.PRINTER_QUARANTINE_MS || 120_000);

interface EstadoImpresora {
  estado?: string;
  motivo?: string;
  desde?: string;
  conector?: string;
}

interface ArchivoEstado {
  actualizado?: string;
  impresoras?: Record<string, EstadoImpresora>;
}

let cacheEstado: ArchivoEstado = {};
let cacheLeidoEn = 0;

/** Impresoras que fallaron al enviar directo, con el momento del fallo. */
const cuarentena = new Map<string, { hasta: number; motivo: string }>();

/**
 * Ruta del archivo de estado y si existe. Lo llama el arranque para dejarlo en
 * el log: si la ruta esta mal o el watchdog no publica, el desvio queda mudo y
 * todo se ve sano. Hay que poder verlo de un vistazo, no descubrirlo en agosto.
 */
export function diagnosticoEstado(): {
  archivo: string;
  existe: boolean;
  impresoras: string[];
} {
  const doc = leerEstado();
  return {
    archivo: ARCHIVO_ESTADO,
    existe: fs.existsSync(ARCHIVO_ESTADO),
    impresoras: Object.keys(doc.impresoras ?? {}),
  };
}

function leerEstado(): ArchivoEstado {
  const ahora = Date.now();
  if (ahora - cacheLeidoEn < TTL_ESTADO_MS) return cacheEstado;
  cacheLeidoEn = ahora;
  try {
    if (!fs.existsSync(ARCHIVO_ESTADO)) {
      cacheEstado = {};
      return cacheEstado;
    }
    // El watchdog escribe desde Windows PowerShell 5.1, que mete BOM. Sin
    // quitarlo JSON.parse revienta, se cae al catch y TODA impresora se ve
    // sana: el desvio no se activaria nunca y volveriamos a perder comandas
    // en silencio, que es justo lo que este modulo existe para evitar.
    // El BOM va escrito con escape, no con el caracter literal: al compilar, el
    // BOM literal salia como "?" y el regex quedaba en /^?/, que no quita nada.
    const crudo = fs
      .readFileSync(ARCHIVO_ESTADO, 'utf8')
      .replace(/^\uFEFF/, '');
    cacheEstado = JSON.parse(crudo) as ArchivoEstado;
  } catch {
    // Un archivo a medio escribir no debe tumbar la impresion: se asume sana.
    cacheEstado = {};
  }
  return cacheEstado;
}

export interface DiagnosticoImpresora {
  caida: boolean;
  motivo?: string;
  desde?: string;
}

/** Estado de una impresora segun el watchdog + la cuarentena local. */
export function estadoDe(nombre: string): DiagnosticoImpresora {
  const local = cuarentena.get(nombre);
  if (local && Date.now() < local.hasta) {
    return { caida: true, motivo: local.motivo };
  }
  if (local) cuarentena.delete(nombre);

  const info = leerEstado().impresoras?.[nombre];
  if (info && info.estado && info.estado !== 'ok') {
    return {
      caida: true,
      motivo: info.motivo || info.estado,
      desde: info.desde,
    };
  }
  return { caida: false };
}

function ponerEnCuarentena(nombre: string, motivo: string): void {
  cuarentena.set(nombre, { hasta: Date.now() + CUARENTENA_MS, motivo });
}

function horaCorta(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Traduce el error tecnico a una linea que le sirva a quien esta en la caja.
 *
 * El mensaje crudo de PowerShell mide entre 350 y 700 caracteres —la ruta del
 * script, la hora, el numero de linea y el stack— y se imprimia COMPLETO
 * encima de cada ticket desviado: unas 22 lineas de papel llenas de rutas con
 * barras invertidas. Eso es lo que se veia como "el ticket sale mega largo con
 * caracteres raros". El error entero sigue yendo a los logs, que es donde
 * sirve; en el papel va el motivo en una linea.
 */
export function motivoCorto(motivo?: string): string {
  if (!motivo) return '';
  const m = motivo.toLowerCase();
  if (
    m.includes('no encontrada') ||
    m.includes('cannot open printer') ||
    m.includes('not found')
  ) {
    return 'no esta instalada en Windows';
  }
  if (m.includes('sin papel') || m.includes('out of paper')) return 'sin papel';
  if (
    m.includes('offline') ||
    m.includes('apagada') ||
    m.includes('desconectada')
  ) {
    return 'apagada o desconectada';
  }
  if (m.includes('timeout') || m.includes('timed out')) {
    return 'no respondio a tiempo';
  }
  if (m.includes('denegado') || m.includes('access is denied')) {
    return 'Windows denego el acceso';
  }
  return 'no responde';
}

/** Banda negra que encabeza un ticket desviado. */
function bandaDesvio(
  etiqueta: string,
  motivo?: string,
  desde?: string,
): Buffer {
  const partes: Buffer[] = [
    ESC_INIT,
    ESC_ALIGN_CENTER,
    solidLine(),
    ESC_INVERSE_ON,
    ESC_DOUBLE_WIDTH,
    encodeText(padCenter(` ${etiqueta} `, LINE_WIDTH / 2)),
    LF,
    ESC_NORMAL_SIZE,
    encodeText(padCenter(` IMPRESORA DE ${etiqueta} CAIDA `)),
    LF,
    ESC_INVERSE_OFF,
    solidLine(),
    ESC_ALIGN_LEFT,
  ];

  const corto = motivoCorto(motivo);
  if (corto) {
    partes.push(ESC_ALIGN_CENTER, encodeText(padCenter(corto)), LF);
  }
  const hora = horaCorta(desde);
  if (hora) {
    partes.push(
      ESC_ALIGN_CENTER,
      encodeText(padCenter(`caida desde las ${hora}`)),
      LF,
    );
  }

  partes.push(
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    encodeText(padCenter(`LLEVAR ESTE TICKET A ${etiqueta}`)),
    LF,
    ESC_BOLD_OFF,
    solidLine(),
    ESC_ALIGN_LEFT,
    LF,
  );
  return Buffer.concat(partes);
}

/** Avisa a la API para que dispare la alerta. Nunca bloquea la impresion. */
function reportarIncidente(cuerpo: Record<string, unknown>): void {
  if (!API_URL) return; // sin API configurada no hay a quien avisar
  void fetch(`${API_URL}/api/print-queue/incident`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...cabecerasDelPrintService(),
    },
    body: JSON.stringify({
      ...cuerpo,
      equipo: process.env.COMPUTERNAME || 'desconocido',
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {
    /* si no hay internet el ticket ya salio; el incidente se pierde y esta bien */
  });
}

export interface OpcionesDespacho {
  /** Impresora a la que corresponde el ticket. */
  impresora: string;
  /** Impresora de respaldo. `null` = este ticket no se desvia. */
  respaldo?: string | null;
  /** Etiqueta de la estacion, para la banda de aviso: BARRA, PIZZA, COCINA... */
  etiqueta: string;
  data: Buffer;
  orderNumber?: string;
  waiterName?: string;
  table?: string;
}

export interface ResultadoDespacho {
  via: string;
  desviado: boolean;
  motivo?: string;
}

/**
 * Manda el ticket a su impresora; si esta caida (o falla el envio), lo desvia
 * al respaldo con una banda de aviso en vez de darlo por impreso.
 */
export async function despachar(
  opts: OpcionesDespacho,
): Promise<ResultadoDespacho> {
  const { impresora, respaldo, etiqueta, data } = opts;
  const diag = estadoDe(impresora);

  if (!diag.caida) {
    try {
      await sendRawToPrinter(impresora, data);
      return { via: impresora, desviado: false };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      ponerEnCuarentena(impresora, msg);
      log.error('Despacho', `Fallo directo en ${impresora}: ${msg}`);
      diag.caida = true;
      diag.motivo = msg;
    }
  } else {
    log.warn(
      'Despacho',
      `${impresora} marcada como caida (${diag.motivo ?? 'sin motivo'}) — no se intenta el envio`,
    );
  }

  const destino = respaldo && respaldo !== impresora ? respaldo : null;
  if (!destino || estadoDe(destino).caida) {
    reportarIncidente({
      tipo: 'perdida',
      impresora,
      etiqueta,
      motivo: diag.motivo,
      orderNumber: opts.orderNumber,
      waiterName: opts.waiterName,
      table: opts.table,
    });
    throw new Error(
      `${impresora} caida (${diag.motivo ?? 'sin motivo'}) y no hay respaldo disponible`,
    );
  }

  const conBanda = Buffer.concat([
    bandaDesvio(etiqueta, diag.motivo, diag.desde),
    data,
  ]);
  await sendRawToPrinter(destino, conBanda);

  log.warn(
    'Despacho',
    `Orden #${opts.orderNumber ?? '?'} DESVIADA: ${impresora} caida → salio por ${destino}`,
  );
  reportarIncidente({
    tipo: 'redireccion',
    impresora,
    destino,
    etiqueta,
    motivo: diag.motivo,
    orderNumber: opts.orderNumber,
    waiterName: opts.waiterName,
    table: opts.table,
  });

  return { via: destino, desviado: true, motivo: diag.motivo };
}
