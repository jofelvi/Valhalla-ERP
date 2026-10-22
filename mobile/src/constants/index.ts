export * from './theme';
export * from './payments';

/**
 * Prefijo de los tokens QR de "Mesa Conectada" (espejo de
 * apps/api link-token.util.ts). El escaner del cliente solo intenta vincular
 * cadenas que empiezan por `ARL1.`.
 */
export const LINK_TOKEN_PREFIX = 'ARL1';
