import { io, Socket } from 'socket.io-client';
import {
  cabecerasDelPrintService,
  claveDelPrintService,
} from './printServiceKey';
import { log } from '../logger';

type JobType = 'receipt' | 'comanda' | 'precuenta' | 'ronda' | 'ficha';
type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

interface PrintJob {
  id: string;
  _id?: string;
  type: JobType;
  payload?: Record<string, unknown>;
  status: JobStatus;
  createdAt?: string;
}

interface ProcessorOptions {
  apiUrl: string; // ej: https://api.ejemplo.com
  localPrintUrl: string; // ej: http://127.0.0.1:6441
  pollIntervalMs?: number; // fallback polling
  maxJobAgeMs?: number; // descarta jobs más viejos que esto (default 10 min)
}

const ENDPOINT_MAP: Record<JobType, string> = {
  receipt: '/print',
  comanda: '/print-comanda',
  precuenta: '/print-precuenta',
  ronda: '/print-ronda',
  ficha: '/print-ficha',
};

const TYPE_LABELS: Record<JobType, string> = {
  receipt: 'Recibo',
  comanda: 'Comanda',
  precuenta: 'Precuenta',
  ronda: 'Ronda',
  ficha: 'Ficha',
};

const claimed = new Set<string>();

async function fetchJobStatus(
  apiUrl: string,
  jobId: string,
): Promise<JobStatus | null> {
  try {
    const res = await fetch(`${apiUrl}/api/print-queue/${jobId}`, {
      headers: cabecerasDelPrintService(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      log.warn('Queue', `fetchJobStatus ${jobId} → HTTP ${res.status}`);
      return null;
    }
    const job = (await res.json()) as PrintJob;
    return job.status ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('Queue', `fetchJobStatus ${jobId} → error: ${msg}`);
    return null;
  }
}

async function patchStatus(
  apiUrl: string,
  jobId: string,
  status: 'processing' | 'done' | 'failed',
  errorMessage?: string,
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { status };
    if (errorMessage) body.errorMessage = errorMessage;
    const res = await fetch(`${apiUrl}/api/print-queue/${jobId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...cabecerasDelPrintService(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log.warn('Queue', `PATCH ${status} job ${jobId} → HTTP ${res.status}`);
    }
    return res.ok;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.warn('Queue', `PATCH ${status} job ${jobId} → FALLO: ${msg}`);
    return false;
  }
}

function jobAgeMs(job: PrintJob): number {
  if (!job.createdAt) return 0;
  const t = new Date(job.createdAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Date.now() - t;
}

async function processJob(
  opts: ProcessorOptions,
  job: PrintJob,
): Promise<void> {
  const jobId = job.id ?? job._id;
  if (!jobId) {
    log.warn(
      'Queue',
      `Job sin ID recibido, ignorando. Payload: ${JSON.stringify(job).slice(0, 200)}`,
    );
    return;
  }

  if (claimed.has(jobId)) {
    log.debug('Queue', `Job ${jobId} ya reclamado (dedup), skip`);
    return;
  }

  claimed.add(jobId);

  const orderNum =
    (job.payload as { orderNumber?: string } | undefined)?.orderNumber ?? '?';
  log.info(
    'Queue',
    `Procesando job ${jobId} | tipo=${job.type} | orden=#${orderNum} | creado=${job.createdAt ?? 'N/A'}`,
  );

  try {
    // Descartar jobs muy viejos
    const maxAge = opts.maxJobAgeMs ?? 10 * 60 * 1000;
    const age = jobAgeMs(job);
    if (age > maxAge) {
      const mins = Math.round(age / 60000);
      log.warn(
        'Queue',
        `Job ${jobId} DESCARTADO: ${mins} min de antigüedad (máx ${Math.round(maxAge / 60000)} min)`,
      );
      await patchStatus(
        opts.apiUrl,
        jobId,
        'failed',
        `Purgado: ${mins} min de antigüedad`,
      );
      return;
    }

    // Verificar estado remoto — otro print-service pudo tomarlo
    const remoteStatus = await fetchJobStatus(opts.apiUrl, jobId);
    if (remoteStatus && remoteStatus !== 'pending') {
      log.info(
        'Queue',
        `Job ${jobId} ya está en estado '${remoteStatus}' en el server, skip`,
      );
      return;
    }

    // Lock remoto
    const locked = await patchStatus(opts.apiUrl, jobId, 'processing');
    if (!locked) {
      log.warn(
        'Queue',
        `Job ${jobId} no se pudo lockear en server (PATCH falló), abortando`,
      );
      return;
    }

    // Enviar al endpoint local de impresión
    const endpoint = ENDPOINT_MAP[job.type] ?? '/print';
    const payload = job.payload ?? {};
    const localUrl = `${opts.localPrintUrl}${endpoint}`;

    log.info('Queue', `Job ${jobId} → POST ${localUrl}`);
    log.debug('Queue', `  payload keys: ${Object.keys(payload).join(', ')}`);

    const res = await fetch(localUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      const errMsg = errData.error ?? `HTTP ${res.status}`;
      log.error(
        'Queue',
        `Job ${jobId} → respuesta HTTP ${res.status}: ${errMsg}`,
      );
      throw new Error(errMsg);
    }

    log.info(
      'Queue',
      `Job ${jobId} | ${TYPE_LABELS[job.type] ?? job.type} #${orderNum} → IMPRESO OK`,
    );
    await patchStatus(opts.apiUrl, jobId, 'done');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? '') : '';
    log.error(
      'Queue',
      `Job ${jobId} | tipo=${job.type} | orden=#${orderNum} → ERROR: ${msg}`,
    );
    if (stack && process.env.DEBUG_PRINT) {
      log.debug('Queue', `  stack: ${stack.slice(0, 500)}`);
    }
    await patchStatus(opts.apiUrl, jobId, 'failed', msg);
  }
}

async function pollPending(opts: ProcessorOptions): Promise<void> {
  try {
    const res = await fetch(`${opts.apiUrl}/api/print-queue/pending`, {
      headers: cabecerasDelPrintService(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log.warn('Queue', `Polling → HTTP ${res.status} (API no disponible?)`);
      return;
    }
    const jobs = (await res.json()) as PrintJob[];
    if (jobs.length > 0) {
      log.info('Queue', `Polling encontró ${jobs.length} job(s) pendiente(s)`);
    }
    for (const job of jobs) {
      void processJob(opts, job);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('timeout') && !msg.includes('ECONNREFUSED')) {
      log.warn('Queue', `Polling error: ${msg}`);
    }
  }
}

export function startNestjsQueueListener(opts: ProcessorOptions): void {
  const pollMs = opts.pollIntervalMs ?? 10_000;
  const maxAge = opts.maxJobAgeMs ?? 10 * 60 * 1000;

  log.info('Queue', `Conectando a ${opts.apiUrl}`);
  log.info('Queue', `  WebSocket /print + polling cada ${pollMs / 1000}s`);
  log.info(
    'Queue',
    `  Antigüedad máxima de jobs: ${Math.round(maxAge / 60000)} min`,
  );

  const socket: Socket = io(`${opts.apiUrl}/print`, {
    transports: ['websocket', 'polling'],
    auth: { key: claveDelPrintService() },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    log.info('Queue', '✓ WebSocket conectado a ' + opts.apiUrl);
    void pollPending(opts);
  });

  socket.on('disconnect', (reason) => {
    log.warn('Queue', `WebSocket desconectado: ${reason}`);
  });

  socket.on('connect_error', (err) => {
    log.warn('Queue', `WebSocket no pudo conectar: ${err.message}`);
    log.warn('Queue', `  URL intentada: ${opts.apiUrl}/print`);
    log.warn(
      'Queue',
      `  ¿El servidor API está disponible? Verifica conexión a internet.`,
    );
  });

  socket.on('print:new-job', (job: PrintJob) => {
    const orderNum =
      (job.payload as { orderNumber?: string } | undefined)?.orderNumber ?? '?';
    log.info(
      'Queue',
      `→ WS new-job: ${job.type} id=${job.id} orden=#${orderNum}`,
    );
    void processJob(opts, job);
  });

  setInterval(() => void pollPending(opts), pollMs);
  void pollPending(opts);
}
