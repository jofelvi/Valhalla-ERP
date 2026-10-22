import {
  MarcaConfig,
  NegocioConfig,
  OperacionConfig,
  TarifasConfig,
  nombreVisible,
} from '@odin6/types';
import { diaMesAnio, horaMinuto } from '../../common/operacion/operacion.util';

/**
 * Cabecera y etiquetas del ticket según la configuración del negocio.
 *
 * El cliente (APK, web) manda lo que ya conoce; el servidor completa lo que falta. El
 * print-service no inventa nada: si el payload llega sin nombre, sale el nombre visible de la
 * marca, no un texto fijo. Un campo que el cliente sí manda nunca se pisa.
 */

export interface ConfigTicket {
  negocio: NegocioConfig;
  marca: MarcaConfig;
  tarifas: TarifasConfig;
  operacion: OperacionConfig;
}

/** Tasa en fracción → texto: 0.1 → "10%", 0.075 → "7.5%". Igual que la pantalla del POS. */
export function porcentajeTexto(tasa: number): string {
  return `${Number((tasa * 100).toFixed(2))}%`;
}

/** Línea de servicio. null = el negocio no cobra servicio (no se imprime). */
export function etiquetaServicioTicket(tarifas: TarifasConfig): string | null {
  if (tarifas.serviceMode === 'none') return null;
  const pct = porcentajeTexto(tarifas.serviceRate);
  return tarifas.serviceMode === 'included'
    ? `Servicio incluido (${pct})`
    : `Servicio (${pct})`;
}

/** Línea de impuesto. null = impuesto apagado (no se imprime). */
export function etiquetaImpuestoTicket(tarifas: TarifasConfig): string | null {
  if (!tarifas.tax.enabled) return null;
  const modo = tarifas.tax.includedInPrice ? 'incluido' : 'sumado';
  return `${tarifas.tax.label} (${porcentajeTexto(tarifas.tax.rate)}) ${modo}`;
}

const tieneTexto = (v: unknown): boolean =>
  typeof v === 'string' && v.trim() !== '';

/**
 * Completa el payload de un ticket (receipt, reprint, precuenta) con lo que el cliente no
 * mandó. Devuelve un objeto nuevo; el original no se toca.
 */
export function completarCabeceraTicket(
  payload: Record<string, unknown>,
  cfg: ConfigTicket,
  ahora: Date,
): Record<string, unknown> {
  const { negocio, marca, tarifas, operacion } = cfg;
  const nombre = nombreVisible(marca, negocio);
  const out: Record<string, unknown> = { ...payload };

  // Cabecera: solo lo que venga vacío. Un texto vacío cuenta como ausente.
  const porDefecto: Record<string, string> = {
    businessName: nombre,
    businessSubtitle: negocio.tagline,
    address: negocio.address,
    phone: negocio.phone,
    rif: negocio.taxId,
    footerMessage: negocio.receiptFooter,
    footerBrand: nombre,
  };
  for (const [campo, valor] of Object.entries(porDefecto)) {
    if (!tieneTexto(out[campo]) && tieneTexto(valor)) out[campo] = valor;
  }

  // Fecha y hora del ticket en la zona del negocio (no en la del VPS).
  if (!tieneTexto(out.date)) {
    out.date = diaMesAnio(ahora, operacion.timezone);
  }
  if (!tieneTexto(out.time)) {
    out.time = horaMinuto(ahora, operacion.timezone);
  }

  const servicio = etiquetaServicioTicket(tarifas);
  if (servicio && !tieneTexto(out.serviceLabel)) out.serviceLabel = servicio;

  const impuesto = etiquetaImpuestoTicket(tarifas);
  if (impuesto && !tieneTexto(out.taxLabel)) out.taxLabel = impuesto;
  if (out.taxMode === undefined) {
    out.taxMode = tarifas.tax.includedInPrice ? 'included' : 'added';
  }

  // Pago Móvil: solo si el negocio lo configuró. Sin datos, el ticket no imprime el bloque.
  const mp = negocio.mobilePayment;
  if (out.pagoMovil === undefined && mp) {
    out.pagoMovil = {
      banco: mp.bank,
      telefono: mp.phone,
      documento: mp.documentId,
    };
  }

  return out;
}
