import Constants from 'expo-constants';

/**
 * Version que el telefono reporta al servidor (`X-App-Version`) y muestra en
 * Perfil.
 *
 * Antes cada lugar la resolvia por su cuenta y con distinto resultado: el
 * cliente HTTP caia a un literal '1.0.0' cuando `expoConfig` venia vacio (pasa
 * en algunos builds nativos) y la pantalla de Perfil tenia el '1.0.0' escrito a
 * mano. Resultado: en los logs del servidor convivian telefonos "1.0.0" que en
 * realidad tenian cualquier version, justo lo contrario de lo que el rastreo
 * de versiones existe para responder.
 *
 * Si de verdad no se puede leer, se dice 'desconocida'. Un dato ausente que se
 * declara ausente es util; uno disfrazado de version real, no.
 */
export const APP_VERSION: string =
  (Constants.expoConfig?.version as string | undefined) ??
  (Constants.nativeAppVersion as string | undefined) ??
  'desconocida';
