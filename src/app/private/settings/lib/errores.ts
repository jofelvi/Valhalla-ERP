const CLAVES_TECNICAS = new Set(['ref', 'type', 'types']);

/**
 * Recorre el árbol de errores de React Hook Form (incluidos los de listas, como las
 * retenciones) y devuelve solo los mensajes, para el resumen de la parte superior.
 */
export function listaErrores(nodo: unknown): string[] {
  if (nodo === null || typeof nodo !== 'object') return [];
  const salida: string[] = [];
  if ('message' in nodo && typeof nodo.message === 'string' && nodo.message) {
    salida.push(nodo.message);
  }
  for (const [clave, hijo] of Object.entries(nodo)) {
    if (clave === 'message' || CLAVES_TECNICAS.has(clave)) continue;
    salida.push(...listaErrores(hijo));
  }
  return salida;
}
