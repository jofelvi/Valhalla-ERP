/**
 * Ambitos donde se despliega el sistema.
 *
 * Vive aqui y NO se copia a mano en la web ni en el APK: copiar enums es lo
 * que dejo `UserRoleEnum.PIZZA` valiendo `undefined` y al pizzero viendo las
 * 101 recetas del negocio en vez de sus 42 pizzas.
 */
export enum ReleaseAmbitoEnum {
  WEB = 'web',
  API = 'api',
  APK = 'apk',
}

export type ReleaseAmbito = `${ReleaseAmbitoEnum}`;
