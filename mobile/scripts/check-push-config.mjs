#!/usr/bin/env node
// Corre en `eas-build-pre-install`: si la config de push esta rota, el build MUERE
// aqui en vez de publicar una app que no puede recibir notificaciones.
//
// Lee la configuracion YA EVALUADA (app.config.js con las variables del perfil de build),
// no app.json a secas: el paquete Android y el bundle iOS salen de APP_ANDROID_PACKAGE y
// APP_BUNDLE_ID.
//
// Sin dependencias a proposito: corre ANTES del install en el builder de EAS.

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

// La variante de PRUEBAS (`APP_VARIANTE=pre`) no lleva FCM: su paquete no es el de
// `google-services.json`. Se deja pasar SIN el chequeo y se dice en voz alta, porque un APK
// sin push no puede terminar en una tienda.
if (process.env.APP_VARIANTE === 'pre') {
  console.log(
    'Variante PRE: chequeo de push OMITIDO. Este APK NO recibe notificaciones\n' +
      'y NO debe publicarse en ninguna tienda.',
  );
  process.exit(0);
}

const app = require('../app.config.js')().expo;

const failures = [];

// Android: sin google-services.json, getDevicePushTokenAsync no devuelve token FCM y el
// telefono queda invisible para el backend. El archivo se pone a mano por cliente (no se versiona).
const servicesPath = app.android?.googleServicesFile;
const androidPackage = app.android?.package;

if (process.env.EAS_BUILD_PLATFORM === 'ios') {
  // Build solo de iOS: FCM es de Android y no aplica; se valida abajo lo de iOS.
} else if (!servicesPath) {
  failures.push(
    'falta google-services.json en mobile/ (Firebase del cliente): sin el, no hay push Android',
  );
} else if (!existsSync(servicesPath)) {
  failures.push(
    `android.googleServicesFile apunta a "${servicesPath}", que no existe`,
  );
} else {
  const services = JSON.parse(readFileSync(servicesPath, 'utf8'));
  const declaredPackages = (services.client ?? [])
    .map((entry) => entry.client_info?.android_client_info?.package_name)
    .filter(Boolean);

  if (!declaredPackages.includes(androidPackage)) {
    failures.push(
      `"${servicesPath}" no declara un client para "${androidPackage}" (declara: ${declaredPackages.join(', ') || 'ninguno'})`,
    );
  }
}

// iOS: sin este background mode, APNs no despierta la app para el push en segundo plano.
const backgroundModes = app.ios?.infoPlist?.UIBackgroundModes ?? [];
if (!backgroundModes.includes('remote-notification')) {
  failures.push(
    'ios.infoPlist.UIBackgroundModes no incluye "remote-notification"',
  );
}
if (!app.ios?.bundleIdentifier) {
  failures.push(
    'ios.bundleIdentifier no esta definido (APP_BUNDLE_ID o app.json)',
  );
}

// Ambas plataformas: el plugin pide permisos y registra el canal de Android.
const plugins = (app.plugins ?? []).map((plugin) =>
  Array.isArray(plugin) ? plugin[0] : plugin,
);
if (!plugins.includes('expo-notifications')) {
  failures.push('expo-notifications no esta en expo.plugins');
}

if (failures.length > 0) {
  console.error(
    '\nBUILD DETENIDO — la config de notificaciones push esta rota:\n',
  );
  for (const failure of failures) console.error(`   - ${failure}`);
  console.error(
    '\nNo se publica una app que no puede recibir push. Corregir y volver a compilar.\n',
  );
  process.exit(1);
}

console.log(
  process.env.EAS_BUILD_PLATFORM === 'ios'
    ? `Config de push OK — iOS APNs (${app.ios.bundleIdentifier})`
    : `Config de push OK — Android FCM (${androidPackage}) + iOS APNs (${app.ios.bundleIdentifier})`,
);
