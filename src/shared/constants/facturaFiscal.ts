/**
 * Etiquetas de los campos SENIAT (la tasa de impuesto sale de `tarifas.tax`). Los datos fiscales del emisor (razón social,
 * RIF, domicilio) NO están aquí: salen de `negocio` en la configuración del negocio.
 */

export interface OpcionFiscal {
  value: string;
  label: string;
}

/** Condición de pago (define el vencimiento de la factura). */
export const PAYMENT_CONDITIONS: (OpcionFiscal & { days: number })[] = [
  { value: 'contado', label: 'Contado', days: 0 },
  { value: 'credito_15', label: 'Crédito 15 días', days: 15 },
  { value: 'credito_30', label: 'Crédito 30 días', days: 30 },
  { value: 'credito_60', label: 'Crédito 60 días', days: 60 },
];

/** Tipo de cliente según el SENIAT (afecta retenciones). */
export const CUSTOMER_TYPES: OpcionFiscal[] = [
  { value: 'no_contribuyente', label: 'No contribuyente' },
  { value: 'contribuyente_ordinario', label: 'Contribuyente ordinario' },
  { value: 'contribuyente_formal', label: 'Contribuyente formal' },
];

/**
 * Etiqueta legible de un valor guardado. Devuelve el valor crudo si no está en
 * la lista: en un documento fiscal es mejor imprimir lo que hay que esconderlo.
 */
function etiquetaDe(opciones: OpcionFiscal[], value?: string | null): string {
  if (!value) return '';
  return opciones.find((o) => o.value === value)?.label || value;
}

export const etiquetaCondicionPago = (value?: string | null): string =>
  etiquetaDe(PAYMENT_CONDITIONS, value);

export const etiquetaTipoCliente = (value?: string | null): string =>
  etiquetaDe(CUSTOMER_TYPES, value);
