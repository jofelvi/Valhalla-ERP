import { InvoiceHeader } from '../ocr/invoice-header-parser';

export interface ProveedorRef {
  id: string;
  name: string;
  taxId?: string | null;
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distancia de edicion clasica, suficiente para erratas de una o dos letras. */
export function distancia(a: string, b: string): number {
  const cols = b.length + 1;
  let previa = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    for (let j = 1; j < cols; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(
        actual[j - 1] + 1,
        previa[j] + 1,
        previa[j - 1] + costo,
      );
    }
    previa = actual;
  }
  return previa[cols - 1];
}

// La letra importa: V-90000006-0 (persona) y J-90000003-0 (empresa) NO son
// el mismo RIF aunque compartan los digitos. Se compara letra + digitos,
// ignorando guiones/espacios/mayusculas.
const claveRif = (s: string | null | undefined): string =>
  (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Puntaje 0..1 (1 = seguro). RIF igual (letra + digitos) gana; si no, tokens
 * del nombre del proveedor dentro de la razon social (admitiendo 1 errata
 * por token de 5+ letras). Umbral 0.5: por debajo no se sugiere nada, el
 * socio escribe.
 */
function puntaje(
  header: Pick<InvoiceHeader, 'rif' | 'vendor'>,
  p: ProveedorRef,
): number {
  if (header.rif && p.taxId && claveRif(header.rif) === claveRif(p.taxId))
    return 1;
  if (!header.vendor) return 0;

  const vendorTokens = normalizar(header.vendor)
    .split(' ')
    .filter((t) => t.length >= 3);
  const nombreTokens = normalizar(p.name)
    .split(' ')
    .filter((t) => t.length >= 3);
  if (!vendorTokens.length || !nombreTokens.length) return 0;

  let aciertos = 0;
  for (const nt of nombreTokens) {
    const tolerancia = nt.length >= 5 ? 1 : 0;
    if (vendorTokens.some((vt) => distancia(vt, nt) <= tolerancia))
      aciertos += 1;
  }
  return aciertos / nombreTokens.length;
}

export function sugerirProveedores(
  header: Pick<InvoiceHeader, 'rif' | 'vendor'>,
  proveedores: ProveedorRef[],
): ProveedorRef[] {
  return proveedores
    .map((p) => ({ p, s: puntaje(header, p) }))
    .filter(({ s }) => s >= 0.5)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name, 'es'))
    .slice(0, 3)
    .map(({ p }) => p);
}
