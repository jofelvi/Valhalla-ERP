// config va PRIMERO: carga el .env antes que los módulos que leen process.env.
import {
  API_URL,
  COLA_DESACTIVADA,
  PATRON_BARRA_1_TEXTO,
  faltantesObligatorios,
} from './config';
import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import {
  buildReceipt,
  buildPrecuenta,
  buildRondaTicket,
  buildFicha,
} from './escpos/receiptBuilder';
import {
  ESC_INIT,
  ESC_ALIGN_CENTER,
  ESC_ALIGN_LEFT,
  ESC_BOLD_ON,
  ESC_BOLD_OFF,
  ESC_DOUBLE_SIZE,
  ESC_NORMAL_SIZE,
  ESC_PARTIAL_CUT,
  ESC_FEED_LINES,
  LF,
  dashedLine,
  encodeText,
  centerText,
} from './escpos/commands';
import { generateQrCode } from './escpos/qrGenerator';
import { sendRawToPrinter, listSystemPrinters } from './printer';
import { despachar, estadoDe, diagnosticoEstado } from './printer/dispatch';
import { resolvePrinter } from './printer/autodetect';
import {
  PrintRequest,
  ComandaRequest,
  ComandaItem,
  PrecuentaRequest,
  RondaRequest,
  FichaRequest,
  ComandaStation,
} from './types/printRequest';
import { planearComanda, PlanDeComanda, StationMode } from './comandaPlan';
import { textoDeTicket } from './escpos/preview';
import { startNestjsQueueListener } from './queue/nestjsQueueListener';
import { log, logFilePath, setRemoteLogging, flushRemoteLogs } from './logger';
import os from 'os';

const app = express();
const PORT = parseInt(process.env.PORT || '6441', 10);

// La version se lee del package.json, no se escribe a mano. Estuvo clavada en
// '2.6.0' mientras el paquete decia 2.7.0 y la caja corria 2.5.2: al
// diagnosticar la caida de la barra el /status mentia sobre que estaba vivo.
const VERSION: string = (() => {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
    ) as { version?: string };
    return pkg.version ?? 'desconocida';
  } catch {
    return 'desconocida';
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
//  Registro de caidas del proceso
//  El 01/08/2026 el proceso murio con -1073740791 (cierre abrupto) y no quedo
//  ni una linea explicando por que: solo el ".bat" anoto el codigo de salida.
//  Estos enganches dejan constancia — en el disco Y en el servidor — de como
//  murio, para no volver a diagnosticar a ciegas.
// ─────────────────────────────────────────────────────────────────────────────
function registrarMuerte(motivo: string, detalle: unknown): void {
  const msg = detalle instanceof Error ? detalle.message : String(detalle);
  const stack = detalle instanceof Error ? detalle.stack : undefined;
  log.error('Caida', `El servicio se esta cayendo por ${motivo}: ${msg}`, {
    motivo,
    stack,
    uptimeSegundos: Math.round(process.uptime()),
    memoriaMB: Math.round(process.memoryUsage().rss / 1048576),
  });
}

process.on('uncaughtException', (err) => {
  registrarMuerte('una excepcion no capturada', err);
  // Dar un instante para que el log llegue al servidor antes de morir.
  void flushRemoteLogs().finally(() => process.exit(1));
});

process.on('unhandledRejection', (motivo) => {
  registrarMuerte('una promesa rechazada sin manejar', motivo);
  void flushRemoteLogs();
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, () => {
    log.evento('Caida', `El servicio se detiene por ${senal}`, {
      uptimeSegundos: Math.round(process.uptime()),
    });
    void flushRemoteLogs().finally(() => process.exit(0));
  });
}

// Valores default = "auto" → se resuelven en runtime con autodetect al arrancar
let RECEIPT_PRINTER =
  process.env.RECEIPT_PRINTER || process.env.PRINTER_NAME || 'auto';
let KITCHEN_PRINTER = process.env.KITCHEN_PRINTER || RECEIPT_PRINTER;
let BAR_PRINTER = process.env.BAR_PRINTER || RECEIPT_PRINTER;
// Ficha (lleva QR): el QR NUNCA sale por caja. Default = BARRA, no la de facturas.
let FICHA_PRINTER = process.env.FICHA_PRINTER || BAR_PRINTER;
// Pizza: si no se define, cae en la impresora de cocina (comportamiento previo).
let PIZZA_PRINTER = process.env.PIZZA_PRINTER || KITCHEN_PRINTER;

// El reparto de comandas es SOLO por el campo `station` del item (pedido del
// dueño 01/08: se eliminó la regex de nombres PIZZA_PATTERN — el dato vive en
// el producto, no en su nombre). Items sin station caen a cocina.
/**
 * Impresora de respaldo cuando la de la estacion esta caida.
 *
 * Las impresoras de ESTACION solo sacan lo suyo: cocina imprime cocina y
 * pizza, barra imprime barra. Nunca se cruzan entre ellas — una comanda de
 * barra saliendo por cocina confunde mas de lo que salva, y fue justo lo que
 * el dueno vio en el local (resumen de caja y comandas de barra saliendo por
 * la impresora de cocina).
 *
 * La CAJA es la unica red de seguridad: esta junto al encargado, que puede
 * llevar el papel a la estacion que toque, y no es una estacion de trabajo.
 * Si la caja tambien esta caida NO se desvia a ninguna estacion: no se imprime
 * y salta la alerta, dejando el trabajo pendiente para reimprimir. Preferimos
 * un ticket que no salio a uno que salio donde no era.
 */
function respaldoDe(impresora: string): string | null {
  if (impresora === RECEIPT_PRINTER) return null;
  return RECEIPT_PRINTER;
}

// ── Modos de estacion ──
// both       = cocina + barra (todo)
// kitchen    = solo cocina
// bar        = toda la barra
// bar-1      = barra arriba: mesas + batidos/jugos de cualquier origen
// bar-2      = barra abajo: zonas, excepto batidos/jugos
// kitchen+1  = cocina + barra 1 (equipo principal arriba)
let stationMode: StationMode = 'both';

const STATION_LABELS: Record<StationMode, string> = {
  both: 'COCINA + BARRA (todo)',
  kitchen: 'SOLO COCINA',
  bar: 'BARRA COMPLETA',
  'bar-1': 'BARRA 1 (arriba: mesas + batidos/jugos)',
  'bar-2': 'BARRA 2 (abajo: zonas, sin batidos/jugos)',
  'kitchen+1': 'COCINA + BARRA 1 (arriba)',
};

// Productos que van a la barra 1 por nombre. Lo define el .env (BARRA_1_PATRON);
// sin patron, ninguno cae por nombre.
const PATRON_BARRA_1 = PATRON_BARRA_1_TEXTO
  ? new RegExp(PATRON_BARRA_1_TEXTO, 'i')
  : null;

function isBatidoOrJugo(item: ComandaItem): boolean {
  return PATRON_BARRA_1 !== null && PATRON_BARRA_1.test(item.name);
}

// Determina si la orden viene de una zona (piscina, tenis, etc.) o de una mesa
function isZoneOrder(data: ComandaRequest): boolean {
  const ot = (data.orderType ?? '').toLowerCase();
  // orderType llega como texto: "Piscina", "Tenis", "Futbol", etc. para zonas
  // "En mesa" para mesas, "PARA LLEVAR" para takeaway
  if (ot === 'en mesa' || ot === 'para llevar') return false;
  // Si tiene table y no es un sector conocido, es mesa
  if (data.table && ot === '') return false;
  // Cualquier otro orderType (Piscina, Tenis, etc.) es zona
  return true;
}

// CORS abierto — el servicio solo escucha en 127.0.0.1, no es accesible desde la red
app.use(cors({ origin: '*' }));

app.use(express.json({ limit: '1mb' }));

// ── Logging de requests entrantes ──
app.use((req, _res, next) => {
  if (req.method !== 'GET') {
    log.info(
      'HTTP',
      `${req.method} ${req.path} — body keys: ${Object.keys(req.body ?? {}).join(', ') || '(vacío)'}`,
    );
  }
  next();
});

// ── Health check ──
app.get('/status', (_req, res) => {
  res.json({
    status: 'ok',
    stationMode,
    stationLabel: STATION_LABELS[stationMode],
    printers: {
      receipt: RECEIPT_PRINTER,
      kitchen: KITCHEN_PRINTER,
      bar: BAR_PRINTER,
      pizza: PIZZA_PRINTER,
      ficha: FICHA_PRINTER,
    },
    timestamp: new Date().toISOString(),
    version: VERSION,
    // Estado que publica el watchdog. Sirve para ver de un vistazo si una
    // impresora esta caida sin tener que entrar a la PC de la caja.
    salud: Object.fromEntries(
      [
        RECEIPT_PRINTER,
        KITCHEN_PRINTER,
        BAR_PRINTER,
        PIZZA_PRINTER,
        FICHA_PRINTER,
      ]
        .filter((p, i, a) => a.indexOf(p) === i)
        .map((p) => [p, estadoDe(p)]),
    ),
  });
});

// ── Listar impresoras (Windows o Linux) ──
app.get('/printers', async (_req, res) => {
  try {
    const list = await listSystemPrinters();
    // Marcar cuales de las configuradas EXISTEN realmente en el sistema
    const cfg = {
      receipt: RECEIPT_PRINTER,
      kitchen: KITCHEN_PRINTER,
      bar: BAR_PRINTER,
      pizza: PIZZA_PRINTER,
      ficha: FICHA_PRINTER,
    };
    const health = Object.fromEntries(
      Object.entries(cfg).map(([k, name]) => [
        k,
        {
          name,
          existe: list.some(
            (p) => p.toLowerCase() === (name ?? '').toLowerCase(),
          ),
        },
      ]),
    );
    res.json({
      platform: process.platform,
      printers: list,
      configured: cfg,
      health,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'No se pudo listar impresoras',
      detail: message,
      platform: process.platform,
    });
  }
});

// ── Ticket de prueba a una impresora (para verificar las 3 fisicamente) ──
// GET /test/receipt | /test/kitchen | /test/bar | /test/ficha | /test/all
function buildTestTicket(
  label: string,
  printerName: string,
  withQr = false,
): Buffer {
  const now = new Date();
  const parts: Buffer[] = [
    ESC_INIT,
    ESC_ALIGN_CENTER,
    ESC_BOLD_ON,
    encodeText('PRUEBA DE IMPRESORA'),
    LF,
    LF,
    ESC_BOLD_ON,
    ESC_DOUBLE_SIZE,
    encodeText(label),
    LF,
    ESC_NORMAL_SIZE,
    ESC_BOLD_OFF,
    dashedLine(),
    LF,
    ESC_ALIGN_LEFT,
    encodeText(`Impresora: ${printerName}`),
    LF,
    encodeText(`Modo: ${STATION_LABELS[stationMode]}`),
    LF,
    encodeText(`Fecha: ${now.toLocaleString('es-VE')}`),
    LF,
    encodeText(centerText('Si lees esto, funciona OK')),
    LF,
    LF,
  ];
  // QR de prueba SOLO en cocina/barra/pizza — nunca en caja (receipt).
  // Confirma que el raster QR imprime y es escaneable en ESTA impresora.
  if (withQr) {
    parts.push(
      ESC_ALIGN_CENTER,
      ESC_BOLD_ON,
      encodeText('QR DE PRUEBA (escanealo)'),
      LF,
      ESC_BOLD_OFF,
      generateQrCode(`TEST-${printerName}`),
      ESC_ALIGN_LEFT,
    );
  }
  parts.push(ESC_FEED_LINES(4), ESC_PARTIAL_CUT);
  // Cast por la estrictez Buffer vs Uint8Array<ArrayBuffer> de @types/node.
  // Buffer ES un Uint8Array en runtime, asi que es seguro.
  return Buffer.concat(parts as unknown as Uint8Array[]);
}

app.get('/test/:target', async (req, res) => {
  const target = (req.params.target || '').toLowerCase();
  const map: Record<string, { label: string; printer: string }> = {
    receipt: { label: 'FACTURA / CAJA', printer: RECEIPT_PRINTER },
    kitchen: { label: 'COCINA', printer: KITCHEN_PRINTER },
    bar: { label: 'BARRA', printer: BAR_PRINTER },
    pizza: { label: 'PIZZA', printer: PIZZA_PRINTER },
    ficha: { label: 'FICHA', printer: FICHA_PRINTER },
  };
  const targets = target === 'all' ? Object.keys(map) : [target];
  if (target !== 'all' && !map[target]) {
    res.status(400).json({
      error: 'Objetivo invalido. Usa: receipt | kitchen | bar | ficha | all',
    });
    return;
  }
  const results: Array<{
    target: string;
    printer: string;
    ok: boolean;
    error?: string;
  }> = [];
  // Dedupe por nombre de impresora fisica (si 2 apuntan a la misma, imprime 1)
  const seen = new Set<string>();
  for (const t of targets) {
    const { label, printer } = map[t];
    if (!printer) {
      results.push({
        target: t,
        printer: '(no configurada)',
        ok: false,
        error: 'sin impresora',
      });
      continue;
    }
    if (target === 'all' && seen.has(printer.toLowerCase())) {
      results.push({
        target: t,
        printer,
        ok: true,
        error: 'omitida (misma impresora fisica ya probada)',
      });
      continue;
    }
    seen.add(printer.toLowerCase());
    try {
      // El QR NUNCA sale por caja: solo se incluye en cocina/barra/pizza/ficha.
      await sendRawToPrinter(
        printer,
        buildTestTicket(label, printer, t !== 'receipt'),
      );
      log.info('Test', `Ticket de prueba enviado a ${label} (${printer})`);
      results.push({ target: t, printer, ok: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.error('Test', `Fallo prueba ${label} (${printer}): ${msg}`);
      results.push({ target: t, printer, ok: false, error: msg });
    }
  }
  const allOk = results.every((r) => r.ok);
  res.status(allOk ? 200 : 500).json({ success: allOk, results });
});

// ── Imprimir factura ──
app.post('/print', async (req, res) => {
  try {
    const data: PrintRequest = req.body;
    if (!data.items || data.items.length === 0) {
      res.status(400).json({ error: 'No items in print request' });
      return;
    }
    log.info(
      'Factura',
      `Orden #${data.orderNumber} | ${data.items.length} items | Total: $${data.total} | impresora: ${RECEIPT_PRINTER}`,
    );
    const buffer = buildReceipt(data);
    await sendRawToPrinter(RECEIPT_PRINTER, buffer);
    log.info(
      'Factura',
      `Orden #${data.orderNumber} impresa OK (${buffer.length} bytes)`,
    );
    res.json({
      success: true,
      message: `Factura impresa para orden #${data.orderNumber}`,
      bytes: buffer.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Factura', `Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

// ── Filtrar items de barra segun modo bar-1 / bar-2 ──
function filterBarItemsForMode(
  items: ComandaItem[],
  data: ComandaRequest,
): ComandaItem[] {
  if (stationMode === 'bar-1' || stationMode === 'kitchen+1') {
    // Bar 1 (arriba): mesas + todos los batidos/jugos sin importar origen
    const fromZone = isZoneOrder(data);
    return items.filter((item) => {
      if (isBatidoOrJugo(item)) return true; // batidos/jugos siempre van a bar 1
      return !fromZone; // el resto solo si es de mesa
    });
  }
  if (stationMode === 'bar-2') {
    // Bar 2 (abajo): zonas, excepto batidos/jugos
    const fromZone = isZoneOrder(data);
    return items.filter((item) => {
      if (isBatidoOrJugo(item)) return false; // batidos/jugos nunca van a bar 2
      return fromZone; // el resto solo si es de zona
    });
  }
  // Modo bar completo o both: todos los items de barra
  return items;
}

// ── Reparto de una comanda (el mismo para imprimir y para la vista previa) ──
const RESUMEN_CAJA = ['1', 'true', 'on', 'si'].includes(
  (process.env.RESUMEN_CAJA ?? '').trim().toLowerCase(),
);

function planDe(data: ComandaRequest): PlanDeComanda {
  return planearComanda(data, {
    modo: stationMode,
    impresoras: {
      cocina: KITCHEN_PRINTER,
      pizza: PIZZA_PRINTER,
      barra: BAR_PRINTER,
      caja: RECEIPT_PRINTER,
    },
    resumenCaja: RESUMEN_CAJA,
    filtroBarra: filterBarItemsForMode,
  });
}

function vistaPrevia(plan: PlanDeComanda) {
  return {
    modo: STATION_LABELS[stationMode],
    resumenCaja: RESUMEN_CAJA,
    papeles: plan.papeles.map((p) => ({
      etiqueta: p.etiqueta,
      titulo: p.titulo,
      impresora: p.impresora,
      items: p.items,
      texto: textoDeTicket(p.buffer),
    })),
    omitidos: plan.omitidos,
    avisos: plan.avisos,
  };
}

// Pedido de ejemplo para la vista previa: mezcla de estaciones, notas y un ingrediente quitado.
const COMANDA_DE_EJEMPLO: ComandaRequest = {
  orderNumber: 'A1B2',
  date: '22/10/2026',
  time: '14:30',
  table: 'Mesa 5',
  waiter: 'Carlos',
  orderType: 'En mesa',
  comment: 'Cliente con prisa',
  items: [
    {
      quantity: 2,
      name: 'Pizza Charcuteria - Pequeña',
      station: 'PIZZA',
      customizations: { removedIngredients: ['cebolla'] },
      notes: 'bien cocida',
    },
    { quantity: 1, name: 'Tender de Pollo x6 UND', station: 'KITCHEN' },
    { quantity: 3, name: 'Polar Pilsen Lata 355ml', station: 'BAR' },
  ],
};

// ── Vista previa: qué papeles saldrían y por qué impresora, SIN imprimir ──
// GET  → texto plano con un pedido de ejemplo (se abre en el navegador).
// POST → lo mismo con el pedido que se mande, en JSON.
app.get('/preview-comanda', (_req, res) => {
  const v = vistaPrevia(planDe(COMANDA_DE_EJEMPLO));
  const bloques = v.papeles.map(
    (p) =>
      `━━━━ ${p.etiqueta} → ${p.impresora} (${p.items} items) ━━━━\n${p.texto}`,
  );
  const cabecera =
    `MODO: ${v.modo}\nRESUMEN DE CAJA: ${v.resumenCaja ? 'ENCENDIDO' : 'apagado'}\n` +
    `PAPELES POR ESTE PEDIDO: ${v.papeles.length}\n` +
    (v.avisos.length ? `\nAVISOS:\n- ${v.avisos.join('\n- ')}\n` : '') +
    (v.omitidos.length
      ? `\nNO SALEN EN ESTE EQUIPO:\n- ${v.omitidos.join('\n- ')}\n`
      : '');
  res
    .type('text/plain; charset=utf-8')
    .send(`${cabecera}\n${bloques.join('\n')}`);
});

app.post('/preview-comanda', (req, res) => {
  const data: ComandaRequest = req.body;
  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    res.status(400).json({ error: 'No items in comanda request' });
    return;
  }
  res.json(vistaPrevia(planDe(data)));
});

// ── Imprimir comanda — un papel por estación (más el resumen de caja si está encendido) ──
const avisosYaDados = new Set<string>();

app.post('/print-comanda', async (req, res) => {
  try {
    const data: ComandaRequest = req.body;
    if (!data.items || data.items.length === 0) {
      res.status(400).json({ error: 'No items in comanda request' });
      return;
    }
    const origin = isZoneOrder(data) ? 'zona' : 'mesa';
    log.info(
      'Comanda',
      `Orden #${data.orderNumber} | ${data.items.length} items | ${data.table ?? data.orderType ?? 'N/A'} (${origin}) | modo=${STATION_LABELS[stationMode]}`,
    );

    const plan = planDe(data);
    for (const aviso of plan.avisos) {
      if (!avisosYaDados.has(aviso)) {
        avisosYaDados.add(aviso);
        log.warn('Comanda', aviso);
      }
    }
    for (const omitido of plan.omitidos) {
      log.info('Comanda', `Omitido en este equipo: ${omitido}`);
    }

    const results: string[] = [];
    for (const papel of plan.papeles) {
      if (papel.etiqueta === 'CAJA') {
        await sendRawToPrinter(papel.impresora, papel.buffer);
        log.info(
          'Comanda',
          `Resumen de caja (${papel.items} items) → ${papel.impresora}${data.isCopy ? ' [COPIA]' : ''}`,
        );
        results.push('resumen en caja');
        continue;
      }
      const r = await despachar({
        impresora: papel.impresora,
        respaldo: respaldoDe(papel.impresora),
        etiqueta: papel.etiqueta,
        data: papel.buffer,
        orderNumber: data.orderNumber,
        waiterName: data.waiter,
        table: data.table,
      });
      log.info(
        'Comanda',
        `${papel.items} items → ${papel.titulo} (${r.via})${r.desviado ? ' [DESVIADO]' : ''}`,
      );
      results.push(
        `${papel.items} items a ${papel.titulo.toLowerCase()}${r.desviado ? ' (desviado)' : ''}`,
      );
    }

    if (results.length === 0) {
      log.info(
        'Comanda',
        `Orden #${data.orderNumber} — no aplica para este equipo (${STATION_LABELS[stationMode]})`,
      );
      res.json({
        success: true,
        message: `No aplica para este equipo`,
        skipped: true,
      });
      return;
    }

    log.info(
      'Comanda',
      `Orden #${data.orderNumber} procesada: ${results.join(', ')}`,
    );
    res.json({
      success: true,
      message: `Comanda enviada: ${results.join(', ')}`,
      papeles: plan.papeles.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Comanda', `Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

// ── Imprimir precuenta ──
app.post('/print-precuenta', async (req, res) => {
  try {
    const data: PrecuentaRequest = req.body;
    if (!data.items || data.items.length === 0) {
      res.status(400).json({ error: 'No items in precuenta request' });
      return;
    }
    log.info(
      'Precuenta',
      `Orden #${data.orderNumber} | ${data.items.length} items | Total: $${data.total} | impresora: ${RECEIPT_PRINTER}`,
    );
    const buffer = buildPrecuenta(data);
    await sendRawToPrinter(RECEIPT_PRINTER, buffer);
    log.info(
      'Precuenta',
      `Orden #${data.orderNumber} impresa OK (${buffer.length} bytes)`,
    );
    res.json({
      success: true,
      message: `Precuenta impresa para orden #${data.orderNumber}`,
      bytes: buffer.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Precuenta', `Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

// ── Imprimir ticket de ronda (pack products: tobos, cajas) ──
app.post('/print-ronda', async (req, res) => {
  try {
    const data: RondaRequest = req.body;
    if (!data.productName || !data.rondaNum) {
      res
        .status(400)
        .json({ error: 'Faltan campos requeridos (productName, rondaNum)' });
      return;
    }
    log.info(
      'Ronda',
      `#${data.rondaNum} | ${data.productName} | ${data.tableName ?? 'sin mesa'} | ${data.totalDelivered}/${data.totalUnits}`,
    );
    const buffer = buildRondaTicket(data);
    const r = await despachar({
      impresora: BAR_PRINTER,
      respaldo: respaldoDe(BAR_PRINTER),
      etiqueta: 'BARRA',
      data: buffer,
      orderNumber: data.orderNumber,
      table: data.tableName,
    });
    log.info(
      'Ronda',
      `Ticket ronda #${data.rondaNum} impreso OK por ${r.via}${r.desviado ? ' [DESVIADO]' : ''} (${buffer.length} bytes)`,
    );
    res.json({
      success: true,
      rondaNum: data.rondaNum,
      bytes: buffer.length,
      printer: r.via,
      desviado: r.desviado,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Ronda', `Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

// La ficha lleva QR y el QR NUNCA sale por caja. Se rutea a la impresora de la
// estacion segun el campo station; si no viene, cae en FICHA_PRINTER (= BARRA).
function pickFichaPrinter(station?: ComandaStation | null): string {
  if (station === 'PIZZA') return PIZZA_PRINTER;
  if (station === 'KITCHEN') return KITCHEN_PRINTER;
  if (station === 'BAR') return BAR_PRINTER;
  return FICHA_PRINTER;
}

// ── Imprimir ficha (QR + saldo) — sale por cocina/barra/pizza, nunca por caja ──
app.post('/print-ficha', async (req, res) => {
  try {
    const data: FichaRequest = req.body;
    if (!data.qrData || !data.items) {
      res
        .status(400)
        .json({ error: 'Faltan campos requeridos (qrData, items)' });
      return;
    }
    const fichaPrinter = pickFichaPrinter(data.station);
    log.info(
      'Ficha',
      `Orden #${data.orderNumber} | ${data.items.length} items | pendiente: ${data.totalPending} | estacion: ${data.station ?? 'BAR(def)'} | impresora: ${fichaPrinter}`,
    );
    const buffer = buildFicha(data);
    const r = await despachar({
      impresora: fichaPrinter,
      respaldo: respaldoDe(fichaPrinter),
      etiqueta:
        data.station === 'PIZZA'
          ? 'PIZZA'
          : data.station === 'KITCHEN'
            ? 'COCINA'
            : 'BARRA',
      data: buffer,
      orderNumber: data.orderNumber,
    });
    log.info(
      'Ficha',
      `Ficha orden #${data.orderNumber} impresa OK por ${r.via}${r.desviado ? ' [DESVIADO]' : ''} (${buffer.length} bytes)`,
    );
    res.json({
      success: true,
      orderNumber: data.orderNumber,
      printer: r.via,
      desviado: r.desviado,
      bytes: buffer.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Ficha', `Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

// ── Preguntar modo de estacion al iniciar ──
function askStationMode(): Promise<StationMode> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log(`║     Print Service v${VERSION}`.padEnd(50) + '║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║                                                 ║');
    console.log('║   Selecciona que comandas imprimir:              ║');
    console.log('║                                                 ║');
    console.log('║   1. Cocina + Barra (todo en un equipo)         ║');
    console.log('║   2. Solo Cocina                                ║');
    console.log('║   3. Barra completa                             ║');
    console.log('║   4. Barra 1 (arriba: mesas + batidos/jugos)    ║');
    console.log('║   5. Barra 2 (abajo: zonas, sin batidos/jugos)  ║');
    console.log('║   6. Cocina + Barra 1 (equipo principal)        ║');
    console.log('║                                                 ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    const ask = () => {
      rl.question('  Opcion [1-6]: ', (answer) => {
        const trimmed = answer.trim();
        const modes: Record<string, StationMode> = {
          '1': 'both',
          '': 'both',
          '2': 'kitchen',
          '3': 'bar',
          '4': 'bar-1',
          '5': 'bar-2',
          '6': 'kitchen+1',
        };
        const mode = modes[trimmed];
        if (mode) {
          rl.close();
          resolve(mode);
        } else {
          console.log('  Opcion no valida. Ingresa 1, 2, 3, 4, 5 o 6.');
          ask();
        }
      });
    };
    ask();
  });
}

// ── Iniciar servidor ──
const PFX_PATH = path.join(__dirname, '..', '..', 'certs', 'print-service.pfx');
const useHttps = fs.existsSync(PFX_PATH);

function printBanner(protocol: string) {
  log.info('Start', '='.repeat(50));
  log.info('Start', `  Print Service v${VERSION}`);
  log.info('Start', `  Modo   : ${STATION_LABELS[stationMode]}`);
  log.info('Start', `  URL    : ${protocol}://127.0.0.1:${PORT}`);
  log.info('Start', `  Log    : ${logFilePath()}`);
  if (
    stationMode === 'both' ||
    stationMode === 'kitchen' ||
    stationMode === 'kitchen+1'
  ) {
    log.info('Start', `  Cocina : ${KITCHEN_PRINTER}`);
    if (PIZZA_PRINTER.toLowerCase() !== KITCHEN_PRINTER.toLowerCase()) {
      log.info('Start', `  Pizza  : ${PIZZA_PRINTER}`);
    }
  }
  if (stationMode !== 'kitchen') {
    log.info('Start', `  Barra  : ${BAR_PRINTER}`);
  }
  if (
    stationMode === 'both' ||
    stationMode === 'kitchen' ||
    stationMode === 'kitchen+1'
  ) {
    log.info('Start', `  Factura: ${RECEIPT_PRINTER}`);
    log.info('Start', `  Ficha  : ${FICHA_PRINTER}`);
  }
  log.info('Start', '='.repeat(50));
  log.info(
    'Start',
    `  Probar : abre http://127.0.0.1:${PORT}/test/all en el navegador`,
  );
  log.info('Start', 'Esperando trabajos de impresión...');
}

async function start() {
  // Sin lo obligatorio el servicio no arranca: mejor un mensaje claro aqui que
  // un error de red horas despues.
  const faltan = faltantesObligatorios();
  if (faltan.length > 0) {
    console.error(
      `[ERROR] Falta configuracion en el .env de este servicio: ${faltan.join(', ')}.`,
    );
    console.error(
      '        Copia .env.example a .env y completa los valores. Ver README.md.',
    );
    process.exit(1);
  }

  // Permitir pasar modo por argumento para no preguntar
  const arg = process.argv[2];
  const argModes: Record<string, StationMode> = {
    '--both': 'both',
    '--kitchen': 'kitchen',
    '--bar': 'bar',
    '--bar-1': 'bar-1',
    '--bar-2': 'bar-2',
    '--kitchen+1': 'kitchen+1',
  };
  const argMode = arg ? argModes[arg] : undefined;

  if (argMode) {
    stationMode = argMode;
  } else if (process.env.STATION_MODE) {
    const envMode = `--${process.env.STATION_MODE}` as keyof typeof argModes;
    stationMode = argModes[envMode] ?? (await askStationMode());
  } else {
    stationMode = await askStationMode();
  }

  // Resolver impresoras (auto-detect si es necesario).
  // fichaExplicita: si FICHA_PRINTER se definio aparte de RECEIPT en el .env,
  // se resuelve por su cuenta; si no, hereda la de facturas YA resuelta (antes
  // heredaba el valor pre-resolucion y quedaba en "auto" sin resolver → bug).
  const fichaExplicita = !!process.env.FICHA_PRINTER;
  const pizzaExplicita = !!process.env.PIZZA_PRINTER;
  console.log('');
  const receipt = await resolvePrinter(RECEIPT_PRINTER, 'Factura');
  const kitchen = await resolvePrinter(KITCHEN_PRINTER, 'Cocina');
  const bar = await resolvePrinter(BAR_PRINTER, 'Barra');
  RECEIPT_PRINTER = receipt.name;
  KITCHEN_PRINTER = kitchen.name;
  BAR_PRINTER = bar.name;
  if (fichaExplicita) {
    const ficha = await resolvePrinter(FICHA_PRINTER, 'Ficha');
    FICHA_PRINTER = ficha.name;
  } else {
    // El QR de la ficha NUNCA va en caja: si no se configura, cae en BARRA.
    FICHA_PRINTER = BAR_PRINTER;
  }
  if (pizzaExplicita) {
    const pizza = await resolvePrinter(PIZZA_PRINTER, 'Pizza');
    PIZZA_PRINTER = pizza.name;
  } else {
    PIZZA_PRINTER = KITCHEN_PRINTER;
  }
  if (!RECEIPT_PRINTER) {
    console.error(
      '[ERROR] Ninguna impresora configurada ni detectada. Revisa el .env.',
    );
    process.exit(1);
  }

  const LOCAL_PRINT_URL = `http://127.0.0.1:${PORT}`;
  // Modo prueba: con DISABLE_QUEUE=1 NO se conecta a la cola (para levantar una
  // instancia en paralelo y probar sin consumir trabajos reales → sin doble
  // impresion). Los endpoints HTTP siguen funcionando para tests manuales.
  const maybeStartQueue = () => {
    if (COLA_DESACTIVADA) {
      log.warn(
        'Start',
        'DISABLE_QUEUE activo — NO se consume la cola (modo prueba en paralelo)',
      );
      return;
    }
    startNestjsQueueListener({
      apiUrl: API_URL,
      localPrintUrl: LOCAL_PRINT_URL,
    });
  };

  // Los warn/error viajan al servidor desde aqui. Se activa ANTES de arrancar
  // la cola para no perder los fallos del arranque, que son los peores de
  // diagnosticar (nadie esta mirando la consola de la PC de caja).
  if (process.env.REMOTE_LOGS !== '0' && API_URL) {
    setRemoteLogging({
      apiUrl: API_URL,
      platform: `print-service@${os.hostname()}`,
      // La misma VERSION que reporta /status, leida del package.json.
      // `npm_package_version` solo existe si el servicio arranca con npm, y la
      // tarea programada lo arranca con `node dist/index.js`: caia siempre al
      // literal viejo y los logs decian 2.5.2 corriera lo que corriera.
      appVersion: VERSION,
    });
    // Queda constancia central de cada arranque: si aparecen varios seguidos,
    // es que algo lo esta matando y el vigilante lo esta reviviendo.
    log.evento('Start', 'El print-service arranco', {
      estaciones: {
        factura: RECEIPT_PRINTER,
        cocina: KITCHEN_PRINTER,
        barra: BAR_PRINTER,
        pizza: PIZZA_PRINTER,
        ficha: FICHA_PRINTER,
      },
      node: process.version,
      usuario: os.userInfo().username,
    });
  }

  // ── Dump de configuración al arrancar ──
  log.info('Start', `API_URL      : ${API_URL}`);
  const diagEstado = diagnosticoEstado();
  log.info(
    'Start',
    `Estado impr. : ${diagEstado.archivo} ${diagEstado.existe ? 'OK' : 'NO EXISTE — el desvio quedara MUDO'} [${diagEstado.impresoras.join(', ') || 'sin datos'}]`,
  );
  log.info('Start', `LOCAL_URL    : ${LOCAL_PRINT_URL}`);
  log.info('Start', `NODE_VERSION : ${process.version}`);
  log.info('Start', `PLATFORM     : ${process.platform}`);
  log.info(
    'Start',
    `.env cargado : PORT=${process.env.PORT ?? '(default 6441)'} | STATION_MODE=${process.env.STATION_MODE ?? '(arg)'}`,
  );

  if (useHttps) {
    const pfx = fs.readFileSync(PFX_PATH);
    const server = https.createServer(
      { pfx, passphrase: process.env.PFX_PASSPHRASE ?? '' },
      app,
    );
    server.listen(PORT, '127.0.0.1', () => {
      log.info('Start', 'Certificado TLS encontrado — modo HTTPS activado');
      printBanner('https');
      maybeStartQueue();
    });
  } else {
    const server = http.createServer(app);
    server.listen(PORT, '127.0.0.1', () => {
      log.info(
        'Start',
        'Sin certificado TLS — modo HTTP (ejecuta setup-https.ps1 para HTTPS)',
      );
      printBanner('http');
      maybeStartQueue();
    });
  }
}

start();
