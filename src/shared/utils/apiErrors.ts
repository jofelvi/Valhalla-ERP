import { ApiError } from '@/services/api/apiClient';

/**
 * Traduce los errores crudos del API (NestJS) a mensajes en español legibles.
 *
 * Contexto: `ApiError.message` (apiClient) trae el body de la respuesta TAL CUAL,
 * que para un 400 del `ValidationPipe` global es un JSON
 * `{ statusCode, error, message }` donde `message` es `string | string[]`.
 * Antes el ProductForm descartaba ese mensaje y mostraba un genérico
 * ("No se pudo guardar el producto"), ocultando la causa real (ej.
 * "isForInventory must be defined"). Aquí se extrae el mensaje real y, si es un
 * constraint por defecto de class-validator (en inglés), se traduce; los
 * mensajes de negocio que el backend ya emite en español se dejan intactos.
 */

interface NestErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
}

// Etiquetas de campo → una sola fuente para nombrarlos en español.
const FIELD_LABELS: Record<string, string> = {
  name: 'El nombre',
  description: 'La descripción',
  price: 'El precio',
  cost: 'El costo',
  type: 'La naturaleza del producto',
  categoryId: 'La categoría',
  subcategoryId: 'La subcategoría',
  supplierIds: 'Los proveedores',
  isActive: 'El estado',
  isForSale: 'La venta',
  isForInventory: 'El inventario',
  sku: 'El SKU',
  barcode: 'El código de barras',
  minStock: 'El stock mínimo',
  presentation: 'La presentación',
  presentationQuantity: 'La cantidad de presentación',
  imageUrl: 'La imagen',
  ingredients: 'Los ingredientes',
  criticality: 'La criticidad',
  station: 'La estación',
};

interface TranslationRule {
  test: RegExp;
  es: (label: string, match: RegExpMatchArray) => string;
}

// Patrones de class-validator (sin el prefijo del campo, que se separa antes).
const RULES: TranslationRule[] = [
  { test: /^must be defined$/, es: (l) => `${l} es obligatorio` },
  { test: /^should not be empty$/, es: (l) => `${l} es obligatorio` },
  { test: /^must be a string$/, es: (l) => `${l} debe ser texto` },
  {
    test: /^must be a number.*/,
    es: (l) => `${l} debe ser un número`,
  },
  {
    test: /^must be a positive number$/,
    es: (l) => `${l} debe ser positivo`,
  },
  {
    test: /^must be a boolean value$/,
    es: (l) => `${l} debe ser verdadero o falso`,
  },
  {
    test: /^must not be less than (-?\d+(?:\.\d+)?)$/,
    es: (l, m) => `${l} no puede ser menor que ${m[1]}`,
  },
  {
    test: /^must not be greater than (-?\d+(?:\.\d+)?)$/,
    es: (l, m) => `${l} no puede ser mayor que ${m[1]}`,
  },
  {
    test: /^must be longer than or equal to (\d+) characters$/,
    es: (l, m) => `${l} debe tener al menos ${m[1]} caracteres`,
  },
  {
    test: /^must be shorter than or equal to (\d+) characters$/,
    es: (l, m) => `${l} no puede superar ${m[1]} caracteres`,
  },
  {
    test: /^must be one of the following values.*/,
    es: (l) => `${l} tiene un valor no permitido`,
  },
];

/**
 * Extrae los mensajes de error de un error desconocido, sin lanzar.
 */
export function extractApiMessages(err: unknown): string[] {
  if (err instanceof ApiError) {
    const raw = err.message;
    try {
      const parsed = JSON.parse(raw) as NestErrorBody;
      if (Array.isArray(parsed.message)) return parsed.message;
      if (typeof parsed.message === 'string') return [parsed.message];
      if (typeof parsed.error === 'string') return [parsed.error];
      return raw ? [raw] : [];
    } catch {
      // El body no era JSON: es texto plano (ya legible).
      return raw ? [raw] : [];
    }
  }
  if (err instanceof Error && err.message) return [err.message];
  return [];
}

/**
 * Traduce un único mensaje del backend a español si es un constraint en inglés;
 * de lo contrario lo devuelve tal cual (ya viene en español o es de negocio).
 */
function translateOne(message: string): string {
  const match = message.match(/^(\w+)\s+(.+)$/);
  if (match) {
    const [, field, tail] = match;
    const label = FIELD_LABELS[field];
    if (label) {
      for (const rule of RULES) {
        const ruleMatch = tail.match(rule.test);
        if (ruleMatch) return rule.es(label, ruleMatch);
      }
    }
  }
  return message;
}

/**
 * Convierte cualquier error del API en un único texto en español para mostrar
 * al usuario (une varios mensajes con espacio).
 */
export function translateApiError(
  err: unknown,
  fallback = 'Ocurrió un error inesperado',
): string {
  const messages = extractApiMessages(err).map(translateOne);
  const clean = messages.filter((m) => m.trim().length > 0);
  return clean.length > 0 ? clean.join(' ') : fallback;
}
