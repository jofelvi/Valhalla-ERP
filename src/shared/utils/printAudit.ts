/**
 * Utilidades para auditoría de impresiones.
 */

/**
 * Calcula el SHA256 (hex) de un objeto JSON stringify determinista.
 * Usado para detectar tampering del payload enviado al print service.
 *
 * Fallback para navegadores sin crypto.subtle (muy raros): retorna un hash
 * rapido no criptografico — suficiente para detectar cambios accidentales.
 */
export async function sha256Hex(data: unknown): Promise<string> {
  const json = JSON.stringify(data, Object.keys(data || {}).sort());

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(json),
      );
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // fallthrough to fallback
  }

  // Fallback: FNV-1a 64-bit hex (no criptografico)
  let h1 = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < json.length; i++) {
    h1 = BigInt.asUintN(64, (h1 ^ BigInt(json.charCodeAt(i))) * prime);
  }
  return h1.toString(16).padStart(16, '0');
}

/**
 * Genera un UUID v4 sencillo usando crypto.randomUUID si esta disponible.
 */
export function generateAttemptId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback muy simple
  return (
    Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36)
  );
}

/**
 * Interpreta el resultado de un fetch al print service y devuelve
 * el status tipado que corresponde al error.
 */
export function classifyPrintError(err: unknown): {
  status: 'service_down' | 'network_error' | 'http_500' | 'exception';
  message: string;
} {
  if (err instanceof Error) {
    const msg = err.message || 'Error desconocido';
    // Fetch con connection refused / DNS / timeout
    if (
      msg.includes('ECONNREFUSED') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('ERR_CONNECTION') ||
      msg.includes('timeout') ||
      msg.toLowerCase().includes('aborted')
    ) {
      return { status: 'service_down', message: msg };
    }
    return { status: 'exception', message: msg };
  }
  return { status: 'exception', message: String(err) };
}
