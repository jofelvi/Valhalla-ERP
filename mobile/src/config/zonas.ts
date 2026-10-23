import { ZoneSectorEnum } from '../types';

/**
 * Zonas que la app ofrece al elegir sector (mesero, cajero, cart, traslados).
 * Única fuente de verdad: para mostrar una zona nueva o retirar una, se edita aquí.
 *
 * Las demás zonas siguen en `ZoneSectorEnum` porque los pedidos viejos aún las
 * traen; las pantallas de pedidos activos las siguen mostrando por su etiqueta.
 */
export const ZONAS_VISIBLES: ZoneSectorEnum[] = [
  ZoneSectorEnum.EVENTO,
  ZoneSectorEnum.PISCINA,
];

export const esZonaVisible = (zona: ZoneSectorEnum): boolean =>
  ZONAS_VISIBLES.includes(zona);
