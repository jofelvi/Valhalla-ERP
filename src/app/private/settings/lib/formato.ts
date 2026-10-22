/** Monto con la moneda configurada. Si el código no es válido para Intl, cae a un formato simple. */
export function formatearMonto(
  valor: number,
  moneda: string,
  locale = 'es-VE',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: moneda,
    }).format(valor);
  } catch {
    return `${valor.toFixed(2).replace('.', ',')} ${moneda}`;
  }
}

/** Hora y día actuales en una zona horaria, para la vista previa de Operación. null si no es válida. */
export function horaEnZona(
  zona: string,
  locale: string,
  ahora: Date = new Date(),
): string | null {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: zona,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(ahora);
  } catch {
    return null;
  }
}
