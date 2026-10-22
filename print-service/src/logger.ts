import fs from 'fs';
import path from 'path';
import { cabecerasDelPrintService } from './queue/printServiceKey';

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'print-service.log');
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB -> rota

function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function rotate() {
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_BYTES) {
      fs.renameSync(
        LOG_FILE,
        LOG_FILE.replace('.log', `.${Date.now()}.old.log`),
      );
    }
  } catch {
    /* ignore */
  }
}

function writeLine(level: string, tag: string, msg: string) {
  const line = `[${ts()}] [${level}] [${tag}] ${msg}`;
  // consola siempre
  if (level === 'ERROR') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
  // archivo
  try {
    ensureDir();
    rotate();
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    /* nunca fallar por el logger */
  }
}

// ---------------------------------------------------------------------------
//  Envio de errores al servidor
//  El 01/08/2026 el servicio murio y estuvo UNA HORA caido sin que nadie se
//  enterara: el log solo existia en el disco de la PC de caja y habia que
//  entrar por SSH para verlo. Ahora los WARN y ERROR se mandan tambien a
//  POST /api/client-logs/batch, que es donde ya reporta la APK.
//
//  Reglas de oro (esto corre en la PC que factura):
//   - NUNCA bloquear ni romper una impresion por un fallo de log.
//   - NUNCA crecer sin limite si el servidor esta caido (buffer con tope).
//   - Solo warn/error: los info inundarian la coleccion.
//
//  O6 - hora del cliente y deteccion de cortes de internet.
//  El servidor sella cada log al INSERTARLO, no cuando ocurrio. Como este
//  buffer se vacia de golpe al reconectar, un corte de 2h llegaba como una
//  rafaga sellada en el instante de reconexion y las mediciones mentian.
//  Ahora cada entrada lleva clientTime (ISO, hora local de la PC de caja)
//  capturado en el momento del evento; y el ciclo de flush hace de SENSOR de
//  cortes: si el servidor deja de ser alcanzable por mas de OUTAGE_THRESHOLD_MS
//  se registra el inicio del corte (con su clientTime real) y, al volver, el
//  fin + duracion. Ambos eventos viajan por el mismo canal, asi que quedan
//  persistidos con su hora real aunque se emitan/entreguen mas tarde.
// ---------------------------------------------------------------------------

interface EntradaRemota {
  level: 'warn' | 'error';
  source: string;
  message: string;
  context: Record<string, unknown> | null;
  platform: string | null;
  appVersion: string | null;
  // ISO capturado CUANDO ocurrio el evento, no cuando se envia el lote.
  clientTime: string;
}

const TOPE_BUFFER = 200; // mas alla de esto se tiran los mas viejos
const LOTE_MAXIMO = 50; // el endpoint acepta 100; se manda de a 50
const INTERVALO_MS = 15_000; // cada cuanto se vacia el buffer / se sondea

// Corte de internet: cuantos ms consecutivos sin alcanzar al servidor hacen
// falta para declararlo. Configurable por env; default 60 s.
const UMBRAL_CORTE_MS =
  Number(process.env.OUTAGE_THRESHOLD_MS) > 0
    ? Number(process.env.OUTAGE_THRESHOLD_MS)
    : 60_000;
// Ruta barata para sondear alcanzabilidad cuando no hay logs que mandar.
// Cualquier respuesta HTTP (aunque sea 4xx/5xx) prueba que hay internet.
const RUTA_SONDEO = process.env.OUTAGE_PROBE_PATH || '/api/print-queue/pending';

let urlRemota: string | null = null;
let metaRemota = {
  platform: null as string | null,
  appVersion: null as string | null,
};
let buffer: EntradaRemota[] = [];
let temporizador: NodeJS.Timeout | null = null;
let enviando = false;
let descartados = 0;

// Estado del episodio de corte.
let servidorCaido = false; // ya se emitio el inicio del corte en curso
let primerFalloDesde: number | null = null; // Date.now() del primer fallo sin confirmar
let inicioCorteMs: number | null = null; // Date.now() en que arranco el corte confirmado

export function setRemoteLogging(opts: {
  apiUrl: string;
  platform?: string | null;
  appVersion?: string | null;
}): void {
  urlRemota = opts.apiUrl.replace(/\/+$/, '');
  metaRemota = {
    platform: opts.platform ?? null,
    appVersion: opts.appVersion ?? null,
  };
  if (temporizador) clearInterval(temporizador);
  temporizador = setInterval(() => void cicloRemoto(), INTERVALO_MS);
  // No mantener vivo el proceso solo por el temporizador del logger.
  if (typeof temporizador.unref === 'function') temporizador.unref();
  writeLine(
    'INFO ',
    'Log',
    `Reporte de errores al servidor activado (${urlRemota})`,
  );
}

function encolarRemoto(
  level: 'warn' | 'error',
  tag: string,
  msg: string,
  context?: Record<string, unknown>,
  clientTime?: string,
): void {
  if (!urlRemota) return;
  if (buffer.length >= TOPE_BUFFER) {
    buffer.shift();
    descartados++;
  }
  buffer.push({
    level,
    source: `print-service:${tag}`,
    message: msg,
    context: context ?? null,
    platform: metaRemota.platform,
    appVersion: metaRemota.appVersion,
    // Por defecto: ahora. Los eventos de corte pasan su hora real (el inicio
    // pudo ocurrir hasta UMBRAL_CORTE_MS antes de que se emita).
    clientTime: clientTime ?? new Date().toISOString(),
  });
}

// Intenta vaciar el buffer al servidor.
//   true  -> el POST llego al servidor (hay internet)
//   false -> fallo de red (sin internet)
//   null  -> no se intento nada (buffer vacio o envio en curso)
export async function flushRemoteLogs(): Promise<boolean | null> {
  if (!urlRemota || enviando || buffer.length === 0) return null;
  enviando = true;
  const lote = buffer.slice(0, LOTE_MAXIMO);
  const resto = buffer.slice(LOTE_MAXIMO);
  if (descartados > 0) {
    lote.unshift({
      level: 'warn',
      source: 'print-service:Log',
      message: `Se descartaron ${descartados} log(s) por buffer lleno (servidor inalcanzable)`,
      context: null,
      platform: metaRemota.platform,
      appVersion: metaRemota.appVersion,
      clientTime: new Date().toISOString(),
    });
    descartados = 0;
  }
  buffer = resto;
  try {
    const res = await fetch(`${urlRemota}/api/client-logs/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: lote }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch {
    // Sin red: devolver al buffer para reintentar, respetando el tope.
    buffer = [...lote, ...buffer].slice(-TOPE_BUFFER);
    return false;
  } finally {
    enviando = false;
  }
}

// Sondeo barato de alcanzabilidad para cuando no hay logs que mandar (el caso
// normal): sin esto un corte de internet con la caja tranquila pasaria
// inadvertido. Cualquier respuesta HTTP = servidor accesible.
async function sondearServidor(): Promise<boolean> {
  if (!urlRemota) return false;
  try {
    await fetch(`${urlRemota}${RUTA_SONDEO}`, {
      method: 'GET',
      headers: cabecerasDelPrintService(),
      signal: AbortSignal.timeout(8000),
    });
    return true;
  } catch {
    return false;
  }
}

// Un tick del sensor: intenta vaciar; si no habia nada que mandar, sondea; y
// alimenta la deteccion de cortes con el resultado.
async function cicloRemoto(): Promise<void> {
  if (!urlRemota) return;
  const resultado = await flushRemoteLogs();
  const alcanzable = resultado === null ? await sondearServidor() : resultado;
  registrarConectividad(alcanzable);
}

function registrarConectividad(alcanzable: boolean): void {
  const ahora = Date.now();
  if (alcanzable) {
    if (servidorCaido && inicioCorteMs !== null) {
      emitirEventoCorte('fin', inicioCorteMs, ahora, ahora - inicioCorteMs);
    }
    servidorCaido = false;
    primerFalloDesde = null;
    inicioCorteMs = null;
    return;
  }
  // No alcanzable.
  if (primerFalloDesde === null) primerFalloDesde = ahora;
  if (!servidorCaido && ahora - primerFalloDesde >= UMBRAL_CORTE_MS) {
    servidorCaido = true;
    inicioCorteMs = primerFalloDesde; // el corte arranco en el PRIMER fallo
    emitirEventoCorte('inicio', inicioCorteMs, null, null);
  }
}

// Persiste inicio/fin de corte por el canal de logs. El inicio lleva como
// clientTime el instante REAL del primer fallo (no el de emision), asi que
// aunque se entregue al reconectar conserva su hora. Se escribe tambien a
// disco por si el servidor nunca llega a recibirlo.
function emitirEventoCorte(
  fase: 'inicio' | 'fin',
  inicioMs: number,
  finMs: number | null,
  duracionMs: number | null,
): void {
  const inicioIso = new Date(inicioMs).toISOString();
  if (fase === 'inicio') {
    const msg = `Corte de internet detectado - servidor inalcanzable desde ${inicioIso}`;
    writeLine('WARN ', 'Outage', msg);
    encolarRemoto(
      'warn',
      'Outage',
      msg,
      {
        evento: 'outage-start',
        inicioClientTime: inicioIso,
        umbralMs: UMBRAL_CORTE_MS,
        equipo: metaRemota.platform,
      },
      inicioIso,
    );
    return;
  }
  const finIso = new Date(finMs ?? Date.now()).toISOString();
  const seg = Math.round((duracionMs ?? 0) / 1000);
  const msg = `Fin del corte de internet - duracion ${seg}s (desde ${inicioIso} hasta ${finIso})`;
  writeLine('WARN ', 'Outage', msg);
  encolarRemoto(
    'warn',
    'Outage',
    msg,
    {
      evento: 'outage-end',
      inicioClientTime: inicioIso,
      finClientTime: finIso,
      duracionMs: duracionMs ?? 0,
      umbralMs: UMBRAL_CORTE_MS,
      equipo: metaRemota.platform,
    },
    finIso,
  );
}

export const log = {
  info: (tag: string, msg: string) => writeLine('INFO ', tag, msg),
  warn: (tag: string, msg: string, context?: Record<string, unknown>) => {
    writeLine('WARN ', tag, msg);
    encolarRemoto('warn', tag, msg, context);
  },
  error: (tag: string, msg: string, context?: Record<string, unknown>) => {
    writeLine('ERROR', tag, msg);
    encolarRemoto('error', tag, msg, context);
  },
  debug: (tag: string, msg: string) => {
    if (process.env.DEBUG_PRINT) writeLine('DEBUG', tag, msg);
  },
  // Para eventos que interesan en el servidor aunque no sean un fallo
  // (arranque, muerte del proceso): se ven en el historial central.
  evento: (tag: string, msg: string, context?: Record<string, unknown>) => {
    writeLine('INFO ', tag, msg);
    encolarRemoto('warn', tag, msg, context);
  },
};

export function logFilePath(): string {
  return LOG_FILE;
}
