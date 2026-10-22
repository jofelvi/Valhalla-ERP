/**
 * Config de la app. El producto no tiene nombre: cada CLIENTE (perfil de build) pone su
 * identidad en variables de entorno, y lo que no pone sale de `app.json` (plantilla neutra).
 *
 * Variables del perfil (ver `eas.json` y `.env.example`):
 *   APP_NOMBRE           nombre visible de la app en el telefono y en la tienda
 *   APP_SLUG             slug de Expo
 *   APP_ESQUEMA          esquema de deep links (ej. "miapp")
 *   APP_BUNDLE_ID        ios.bundleIdentifier (ej. "com.cliente.pos")
 *   APP_ANDROID_PACKAGE  android.package (ej. "com.cliente.pos")
 *   APP_OWNER            cuenta de Expo dueña del proyecto
 *   APP_EAS_PROJECT_ID   id del proyecto de EAS (lo da `eas init`)
 *   APP_ICONO            ruta del ícono (por defecto, el de la plantilla)
 *   APP_VARIANTE=pre     variante de pruebas: sufijo ".pre" en los identificadores y
 *                        "(PRE)" en el nombre, para instalarla AL LADO de la de producción.
 *
 * Firebase / FCM: `google-services.json` NO se versiona ni se incrusta aquí. Se pone a mano
 * en `mobile/` por cliente y solo se incluye si existe. La variante de pruebas no lo usa
 * (declara otro paquete): por eso no recibe notificaciones push, y no va a las tiendas.
 *
 * Sin variables, la salida es `app.json` tal cual: la plantilla no cambia en nada.
 */
const fs = require('node:fs');
const path = require('node:path');
const base = require('./app.json');

const env = process.env;
const esPre = env.APP_VARIANTE === 'pre';
const sufijo = esPre ? '.pre' : '';

module.exports = () => {
  const b = base.expo;
  const nombre = env.APP_NOMBRE || b.name;
  const bundleId = (env.APP_BUNDLE_ID || b.ios.bundleIdentifier) + sufijo;
  const paquete = (env.APP_ANDROID_PACKAGE || b.android.package) + sufijo;

  const android = { ...b.android, package: paquete };
  // Solo la variante de producción lleva FCM: google-services.json declara un paquete concreto.
  const googleServices = path.join(__dirname, 'google-services.json');
  if (!esPre && fs.existsSync(googleServices)) {
    android.googleServicesFile = './google-services.json';
  }

  const expo = {
    ...b,
    name: esPre ? `${nombre} (PRE)` : nombre,
    slug: env.APP_SLUG || b.slug,
    scheme: env.APP_ESQUEMA || b.scheme,
    icon: env.APP_ICONO || b.icon,
    ios: { ...b.ios, bundleIdentifier: bundleId },
    android,
    web: { ...b.web, name: nombre, shortName: nombre.slice(0, 12) },
  };
  if (env.APP_OWNER) expo.owner = env.APP_OWNER;
  if (env.APP_EAS_PROJECT_ID)
    expo.extra = { eas: { projectId: env.APP_EAS_PROJECT_ID } };

  return { expo };
};
