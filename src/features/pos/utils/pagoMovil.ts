import type { NegocioConfig, PagoMovilNegocio } from '@odin6/types';
import { getBankLabel } from '@/shared/constants/banks';

/**
 * Datos de Pago Móvil del negocio, sacados de `negocio.mobilePayment`. Si el negocio no lo
 * configuró, estas funciones no se llaman: la pantalla no ofrece el QR.
 */

/** Titular que se muestra al cliente: la razón social, o el nombre comercial si no hay. */
export function titularPagoMovil(negocio: NegocioConfig): string {
  return negocio.legalName || negocio.tradeName;
}

/** Banco en texto para mostrar: "Banco de Venezuela (BDV)". Si no está en el catálogo, el código. */
export function bancoPagoMovil(pm: PagoMovilNegocio): string {
  return getBankLabel(pm.bank);
}

/** Texto del QR informativo del recibo. Formato interno: no es un QR bancario. */
export function payloadPagoMovil(
  pm: PagoMovilNegocio,
  titular: string,
): string {
  const telefono = pm.phone.replace(/[\s-]/g, '');
  const documento = pm.documentId.replace(/[\s-]/g, '');
  return `PM-${pm.bank}|${telefono}|${documento}|${titular}`;
}

/** Imagen del QR para el ticket o la pantalla. */
export function urlQrPagoMovil(payload: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;
}
