#!/usr/bin/env node
/**
 * Sembrador de instancia. Idempotente: se puede correr todas las veces que haga falta.
 *
 *   node apps/api/scripts/sembrar-instancia.mjs [--instancia <nombre>] [--base <db>] [--uri <mongo>] [--demo]
 *
 * Sin `--demo` solo crea el primer ADMIN si la base no tiene usuarios (datos desde ADMIN_EMAIL,
 * ADMIN_PASSWORD y ADMIN_NAME). No escribe configuración: la instalación arranca neutra y el
 * cliente la completa desde Ajustes.
 *
 * Con `--demo` escribe un perfil de prueba FICTICIO ("Demo Sabor") en la colección `configs`, para
 * comprobar que ninguna pantalla ni aviso dice otro nombre. No usar en una instalación real.
 *
 * La clave del admin se guarda con bcrypt (10 rondas), igual que `AuthService.register`.
 */
import { parseArgs } from 'node:util';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

const { values: opciones } = parseArgs({
  options: {
    instancia: { type: 'string' },
    base: { type: 'string' },
    uri: { type: 'string' },
    demo: { type: 'boolean', default: false },
  },
});

const uri = opciones.uri ?? process.env.MONGODB_URI;
if (!uri) {
  console.error('Falta --uri o MONGODB_URI.');
  process.exit(1);
}

/** Perfil de prueba. Datos inventados: ningún RIF, correo ni teléfono es real. */
const PERFIL_DEMO = {
  negocio: {
    tradeName: 'Demo Sabor',
    tagline: 'Restaurante de prueba',
    legalName: 'Demo Sabor, C.A. (ficticio)',
    taxId: 'J-00000000-0',
    address: 'Av. Demostracion 123',
    phone: '0000-0000000',
    email: 'demo@ejemplo.com',
    website: '',
    instagram: '',
    legalText: '',
    receiptFooter: 'Gracias por su preferencia',
    alertsEmail: '',
    mobilePayment: null,
    bankTransfer: null,
  },
  marca: {
    appName: 'Demo Sabor',
    logoLightUrl: '',
    logoDarkUrl: '',
    iconUrl: '',
    defaultTheme: 'system',
    palette: {
      light: {
        page: '#f5f7f4', surface: '#ffffff', elevated: '#fafcf9', sidebar: '#ffffff',
        line: '#d5ddd2', lineHover: '#b9c6b5', content: '#14201a', dim: '#5a6a5e',
        primary: '#0f766e', primaryDark: '#0b4f4a', primaryLight: '#2aa198', accent: '#c2410c',
        success: '#15803d', danger: '#b91c1c', warning: '#a16207', info: '#1d4ed8', onPrimary: '#ffffff',
      },
      dark: {
        page: '#0c1210', surface: '#131d19', elevated: '#18251f', sidebar: '#0c1210',
        line: '#24352d', lineHover: '#34493e', content: '#e6efe9', dim: '#94a89b',
        primary: '#2aa198', primaryDark: '#0f766e', primaryLight: '#5fc4bb', accent: '#fb923c',
        success: '#4ade80', danger: '#f87171', warning: '#fbbf24', info: '#60a5fa', onPrimary: '#042f2c',
      },
    },
  },
  tarifas: {
    baseCurrency: 'usd',
    secondaryCurrency: 'ves',
    serviceMode: 'additional',
    serviceRate: 0.12,
    serviceOnlyWithWaiter: true,
    tax: { enabled: false, rate: 0.16, label: 'IVA', includedInPrice: true, appliesToService: false },
    suggestedTipsPct: [],
  },
  operacion: {
    country: 'US',
    timezone: 'America/New_York',
    locale: 'en-US',
    phonePrefix: '1',
    businessDayStartHour: 6,
    weekStartsOn: 1,
  },
  vocabulario: {
    waiter: 'Camarero',
    waiters: 'Camareros',
    cashier: 'Cajero',
    cashiers: 'Cajeros',
    kitchen: 'Cocina',
    bar: 'Barra',
    table: 'Mesa',
    tables: 'Mesas',
    zone: 'Zona',
    tab: 'Cuenta',
    service: 'Servicio',
  },
  modulos: {
    partners: false,
    packsAndBuckets: false,
    barTokens: false,
    telegramBot: false,
    currencyWatcher: false,
    bankReconciliation: false,
    productBonus: false,
    connectedTable: false,
    reservations: false,
  },
};

async function sembrarAdmin(db) {
  const usuarios = db.collection('users');
  const existentes = await usuarios.countDocuments();
  if (existentes > 0) {
    console.log(`Usuarios existentes: ${existentes}. No se crea admin.`);
    return;
  }
  const email = process.env.ADMIN_EMAIL?.trim();
  const clave = process.env.ADMIN_PASSWORD ?? '';
  const nombre = process.env.ADMIN_NAME?.trim() || 'Administrador';
  if (!email || clave.length < 8) {
    console.log('Base sin usuarios: faltan ADMIN_EMAIL o ADMIN_PASSWORD (min. 8 caracteres). No se crea admin.');
    return;
  }
  const ahora = new Date();
  await usuarios.insertOne({
    _id: new mongoose.Types.ObjectId().toString(),
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(clave, 10),
    name: nombre,
    role: 'admin',
    isActive: true,
    emailVerified: true,
    createdAt: ahora,
    updatedAt: ahora,
  });
  console.log(`Admin creado: ${email.toLowerCase()}`);
}

async function sembrarDemo(db) {
  const configs = db.collection('configs');
  const ahora = new Date();
  for (const [id, valor] of Object.entries(PERFIL_DEMO)) {
    await configs.updateOne(
      { _id: id },
      { $set: { valor, updatedAt: ahora, updatedBy: 'sembrador-demo' } },
      { upsert: true },
    );
  }
  console.log(`Perfil demo escrito en configs: ${Object.keys(PERFIL_DEMO).join(', ')}`);
}

async function main() {
  await mongoose.connect(uri, opciones.base ? { dbName: opciones.base } : {});
  const db = mongoose.connection.db;
  console.log(`Instancia: ${opciones.instancia ?? '(sin nombre)'} · base: ${db.databaseName}`);
  try {
    if (opciones.demo) await sembrarDemo(db);
    await sembrarAdmin(db);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Fallo el sembrado:', error instanceof Error ? error.message : error);
  process.exit(1);
});
