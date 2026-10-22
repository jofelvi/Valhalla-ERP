#!/usr/bin/env node
/**
 * Receptor del webhook de GitHub de UNA instancia: cada push a su rama
 * despliega la instancia.
 *
 *   push a RAMA (main por defecto) -> scripts/deploy/desplegar-servidor.sh <instancia>
 *
 * Corre en el VPS bajo PM2 (`<instancia>-webhook`), escucha solo en 127.0.0.1 y
 * nginx le pasa `https://<DOMINIO_API>/webhook/deploy`.
 *
 * Configuracion (variables de entorno, que fija el proceso PM2):
 *   INSTANCIA          nombre de la instancia (obligatorio)
 *   PUERTO_WEBHOOK     puerto local de escucha (obligatorio)
 *   RAMA               rama que despliega (por defecto main)
 *   DIR_BUILD          checkout de compilacion (por defecto /var/www/<INSTANCIA>-build)
 *   WEBHOOK_CONFIG     archivo con WEBHOOK_SECRET=... (por defecto /etc/<INSTANCIA>/webhook.env)
 *
 * El secreto vive fuera del repositorio. Sin el archivo no arranca: un secreto
 * de respaldo escrito en el codigo no es secreto.
 *
 * Detalles que importan:
 *   - La firma se compara solo si tiene el largo correcto: timingSafeEqual
 *     lanza con buffers de distinto largo y tumbaria el proceso.
 *   - El `ping` de GitHub (al crear el webhook) se contesta sin desplegar.
 *   - El despliegue se lanza con `setsid -f`: queda fuera del arbol de este
 *     proceso, asi que reiniciar el receptor no corta un despliegue a medias.
 *
 * Los pushes que llegan mientras otro despliegue compila no se pierden: el
 * guion del servidor toma un candado y, al terminar, vuelve a mirar la rama.
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

const INSTANCIA = process.env.INSTANCIA || '';
const PORT = Number(process.env.PUERTO_WEBHOOK || 0);
const RAMA = process.env.RAMA || 'main';
const DIR_BUILD = process.env.DIR_BUILD || `/var/www/${INSTANCIA}-build`;
const CONFIG_FILE = process.env.WEBHOOK_CONFIG || `/etc/${INSTANCIA}/webhook.env`;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

if (!INSTANCIA || !PORT) {
  log('Faltan INSTANCIA o PUERTO_WEBHOOK en el entorno. No arranco.');
  process.exit(1);
}

const DESPLIEGUE = {
  ref: `refs/heads/${RAMA}`,
  guion: `${DIR_BUILD}/scripts/deploy/desplegar-servidor.sh`,
  log: `/var/log/${INSTANCIA}-deploy.log`,
};

const leerSecreto = () => {
  try {
    const linea = fs
      .readFileSync(CONFIG_FILE, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('WEBHOOK_SECRET='));
    return linea?.slice('WEBHOOK_SECRET='.length).trim() || '';
  } catch {
    return '';
  }
};

const SECRETO = leerSecreto();
if (!SECRETO) {
  log(`Sin WEBHOOK_SECRET en ${CONFIG_FILE}. No arranco.`);
  process.exit(1);
}

const firmaValida = (cuerpo, firma) => {
  if (typeof firma !== 'string') return false;
  const esperada = `sha256=${crypto.createHmac('sha256', SECRETO).update(cuerpo).digest('hex')}`;
  const a = Buffer.from(esperada);
  const b = Buffer.from(firma);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const responder = (res, codigo, cuerpo) => {
  res.writeHead(codigo, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(cuerpo));
};

const lanzar = () => {
  const fd = fs.openSync(DESPLIEGUE.log, 'a');
  const hijo = spawn('/usr/bin/setsid', ['-f', '/bin/bash', DESPLIEGUE.guion, INSTANCIA], {
    detached: true,
    stdio: ['ignore', fd, fd],
  });
  hijo.unref();
  fs.closeSync(fd);
};

const servidor = http.createServer((req, res) => {
  if (req.method !== 'POST') return responder(res, 405, { error: 'Method Not Allowed' });

  const trozos = [];
  let largo = 0;
  req.on('data', (trozo) => {
    largo += trozo.length;
    if (largo > MAX_BODY_BYTES) req.destroy();
    else trozos.push(trozo);
  });
  req.on('end', () => {
    const cuerpo = Buffer.concat(trozos);
    if (!firmaValida(cuerpo, req.headers['x-hub-signature-256'])) {
      log('Firma invalida: peticion rechazada.');
      return responder(res, 401, { error: 'Invalid signature' });
    }

    const evento = req.headers['x-github-event'];
    if (evento === 'ping') return responder(res, 200, { message: 'pong' });
    if (evento !== 'push') return responder(res, 202, { message: `Evento ${evento} ignorado` });

    let payload;
    try {
      payload = JSON.parse(cuerpo.toString('utf8'));
    } catch {
      return responder(res, 400, { error: 'Malformed JSON' });
    }

    if (payload.ref !== DESPLIEGUE.ref || payload.deleted) {
      return responder(res, 202, { message: 'Rama sin despliegue', ref: payload.ref });
    }

    const sha = String(payload.after || '').slice(0, 7);
    log(`Push a ${payload.ref} (${sha}): desplegando ${INSTANCIA}.`);
    lanzar();
    return responder(res, 202, { message: `Despliegue ${INSTANCIA} lanzado`, sha });
  });
});

servidor.listen(PORT, '127.0.0.1', () =>
  log(`${INSTANCIA}: escuchando en http://127.0.0.1:${PORT} (rama ${RAMA})`),
);
