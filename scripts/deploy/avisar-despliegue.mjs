#!/usr/bin/env node
/**
 * Aviso por correo del resultado de un despliegue automatico de una instancia.
 * Lo llama scripts/deploy/desplegar-servidor.sh al terminar, bien o mal.
 *
 * Usa el servicio de notificaciones que configure la instancia y muestra que
 * partes se compilaron (API, web o ninguna).
 *
 * Configuracion en el servidor, fuera del repo: /etc/<INSTANCIA>/deploy-notify.env
 *   DEPLOY_NOTIFY_TO=correo[,otro]
 *   NOTIFICATIONS_SERVICE_URL=https://...
 *   NOTIFICATIONS_API_KEY=...
 * Sin ese archivo no manda nada. NUNCA hace fallar el despliegue: sale con 0.
 *
 * Datos del despliegue (variables AVISO_* que pone el guion):
 *   AVISO_AMBIENTE, AVISO_URL, AVISO_RESULTADO (EXITOSO | REVERTIDO | FALLIDO),
 *   AVISO_DESDE, AVISO_HASTA, AVISO_INICIO (epoch s), AVISO_PARTES, AVISO_SALUD,
 *   AVISO_DETALLE, AVISO_LOG, AVISO_REPO.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const INSTANCIA = process.env.INSTANCIA || '';
const CONFIG_FILE = process.env.NOTIFY_CONFIG || `/etc/${INSTANCIA}/deploy-notify.env`;
const SEND_TIMEOUT_MS = 15_000;
const MAX_COMMITS = 50;
const LOG_TAIL_LINES = 40;

const log = (msg) => console.log(`   [aviso por correo] ${msg}`);

const readConfig = () => {
  if (!existsSync(CONFIG_FILE)) return null;
  const config = {};
  for (const line of readFileSync(CONFIG_FILE, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) config[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  const to = (config.DEPLOY_NOTIFY_TO || '').trim();
  const url = (config.NOTIFICATIONS_SERVICE_URL || '').trim();
  const apiKey = (config.NOTIFICATIONS_API_KEY || '').trim();
  return to && url && apiKey ? { to, url, apiKey } : null;
};

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');

const git = (repoDir, args) => {
  try {
    return execFileSync('git', ['-C', repoDir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

const readVersion = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')).version || '—';
  } catch {
    return '—';
  }
};

const caracas = (date) =>
  date.toLocaleString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'medium' });

const duration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
};

const logTail = (file) => {
  if (!file || !existsSync(file)) return [];
  const lines = stripAnsi(readFileSync(file, 'utf8'))
    .split('\n')
    .filter((l) => l.trim() && !/[│─┌└├┐┘┤┬┴┼]/.test(l) && !/^Progress:/.test(l));
  const start = lines.map((l) => /Iniciando despliegue/.test(l)).lastIndexOf(true);
  return lines.slice(start >= 0 ? start : 0).slice(-LOG_TAIL_LINES);
};

const buildEmail = () => {
  const env = process.env;
  const repoDir = env.AVISO_REPO || process.cwd();
  const label = env.AVISO_AMBIENTE || 'DESCONOCIDO';
  const isProd = !/PRE/i.test(label);
  const result = env.AVISO_RESULTADO || 'FALLIDO';
  const ok = result === 'EXITOSO';
  const prev = env.AVISO_DESDE || '';
  const next = env.AVISO_HASTA || git(repoDir, ['rev-parse', 'HEAD']);
  const short = (sha) => (sha ? sha.slice(0, 7) : '—');
  const startedAt = Number(env.AVISO_INICIO);
  const now = new Date();
  const started = Number.isFinite(startedAt) && startedAt > 0 ? new Date(startedAt * 1000) : null;

  const range = prev && next && prev !== next ? `${prev}..${next}` : '';
  const commits = range
    ? git(repoDir, ['log', '--no-merges', `--max-count=${MAX_COMMITS + 1}`, '--format=%h\t%s\t%an', range])
        .split('\n')
        .filter(Boolean)
    : [];
  const totalCommits = range ? Number(git(repoDir, ['rev-list', '--count', range])) || commits.length : 0;

  const icon = ok ? '✅' : result === 'REVERTIDO' ? '⚠️' : '🚨';
  const resultText =
    {
      EXITOSO: 'Despliegue EXITOSO',
      REVERTIDO: 'Despliegue FALLIDO — revertido a lo anterior',
      FALLIDO: 'Despliegue FALLIDO',
    }[result] || result;
  const marca = env.AVISO_MARCA || env.INSTANCIA || 'instancia';
  const subject = `${icon} [${marca} · ${label}] ${resultText} · ${short(prev)} → ${short(next)}`;

  const envColor = isProd ? '#9f1239' : '#b45309';
  const resultColor = ok ? '#15803d' : result === 'REVERTIDO' ? '#b45309' : '#b91c1c';
  const row = (k, v) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;color:#111827">${v}</td></tr>`;
  const list = (items) =>
    items.length
      ? `<ul style="margin:6px 0 0 18px;padding:0">${items.map((i) => `<li style="margin:2px 0">${i}</li>`).join('')}</ul>`
      : '<p style="margin:6px 0;color:#6b7280">—</p>';
  const section = (title, body) =>
    `<h3 style="margin:22px 0 4px;font-size:15px;color:#111827">${escapeHtml(title)}</h3>${body}`;

  const commitItems = commits.slice(0, MAX_COMMITS).map((line) => {
    const [sha, subjectLine, author] = line.split('\t');
    return `<code style="color:#6b7280">${escapeHtml(sha)}</code> ${escapeHtml(subjectLine)} <span style="color:#9ca3af">· ${escapeHtml(author || '')}</span>`;
  });
  if (totalCommits > commitItems.length) {
    commitItems.push(`<em style="color:#6b7280">… y ${totalCommits - commitItems.length} más</em>`);
  }

  const versions = `API ${readVersion(join(repoDir, 'apps/api/package.json'))} · web ${readVersion(join(repoDir, 'package.json'))}`;
  const url = env.AVISO_URL || '';
  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif">
<div style="max-width:720px;margin:0 auto;padding:20px">
  <div style="background:${envColor};color:#fff;border-radius:10px 10px 0 0;padding:16px 20px">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9">${escapeHtml(marca)} · Ambiente</div>
    <div style="font-size:22px;font-weight:700;margin-top:2px">${escapeHtml(label)}</div>
  </div>
  <div style="background:#fff;border-radius:0 0 10px 10px;padding:18px 20px 22px;border:1px solid #e5e7eb;border-top:0">
    <div style="font-size:19px;font-weight:700;color:${resultColor}">${icon} ${escapeHtml(resultText)}</div>
    <table style="margin-top:12px;border-collapse:collapse;font-size:14px">
      ${row('Ambiente', `${escapeHtml(label)}${url ? ` · <a href="${escapeHtml(url)}" style="color:#1d4ed8">${escapeHtml(url)}</a>` : ''}`)}
      ${row('Commit', `<code>${escapeHtml(short(prev))}</code> → <code><b>${escapeHtml(short(next))}</b></code>${totalCommits ? ` (${totalCommits} commits)` : ''}`)}
      ${row('Se compiló', escapeHtml(env.AVISO_PARTES || '—'))}
      ${row('Versión', escapeHtml(versions))}
      ${row('Inicio', started ? escapeHtml(caracas(started)) : '—')}
      ${row('Fin', escapeHtml(caracas(now)))}
      ${row('Duración', escapeHtml(started ? duration((now.getTime() - started.getTime()) / 1000) : '—'))}
      ${row('Chequeo de salud', escapeHtml(env.AVISO_SALUD || '—'))}
      ${env.AVISO_DETALLE ? row('Qué falló', `<b style="color:#b91c1c">${escapeHtml(env.AVISO_DETALLE)}</b>`) : ''}
    </table>
    ${section('Commits incluidos', list(commitItems))}
    ${ok ? '' : section('Últimas líneas del log', `<pre style="background:#111827;color:#e5e7eb;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap;overflow:auto">${escapeHtml(logTail(env.AVISO_LOG).join('\n'))}</pre>`)}
    <p style="margin-top:22px;font-size:12px;color:#9ca3af">Log completo en el VPS: <code>${escapeHtml(env.AVISO_LOG || `/var/log/${env.INSTANCIA || 'instancia'}-deploy.log`)}</code></p>
  </div>
</div></body></html>`;
  return { subject, html };
};

const main = async () => {
  const config = readConfig();
  if (!config) {
    log(`no configurado (${CONFIG_FILE}): no se envía.`);
    return;
  }
  const { subject, html } = buildEmail();
  const recipients = config.to
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const to of recipients) {
    try {
      const response = await fetch(`${config.url.replace(/\/+$/, '')}/api/v1/notifications/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ to, subject, html }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      log(response.ok ? `enviado a ${to}.` : `el servicio respondió ${response.status} (${to}).`);
    } catch (error) {
      log(`no se pudo enviar a ${to}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

main()
  .catch((error) => log(`error inesperado: ${error instanceof Error ? error.message : String(error)}`))
  .finally(() => process.exit(0));
