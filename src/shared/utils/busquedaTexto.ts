/**
 * La regla con la que se busca texto en todas las listas del sistema.
 *
 * Nace el 20/09/2026 de medir el buscador viejo contra los 2.993 clientes
 * reales. Hacía `campo.toLowerCase().includes(texto)` y fallaba en casi todo
 * lo que una persona escribe de verdad:
 *
 * | Se escribe        | Antes | Por qué |
 * |-------------------|-------|---------|
 * | `jose`            | 293   | y `josé` daba otros 21 DISTINTOS: había que adivinar si el nombre lleva tilde |
 * | `juan perez`      | 0     | el cliente es «PEREZ GARCIA JUAN CARLOS»: dos palabras suyas en otro orden no encuentran |
 * | `maria gonzalez`  | 0     | lo mismo, y es la forma normal de buscar a alguien |
 * | `V-7000100`       | 0     | la pantalla MUESTRA «V-7000100», pero el campo guarda solo el número |
 * | `0414 7000001`    | 0     | el teléfono está guardado con guion |
 * | `327`             | 31    | 30 de ellos por teléfonos y cédulas que contienen 327; la acción 00327 no salía primero por ninguna regla, salía por casualidad |
 *
 * Las reglas nuevas, en orden:
 *
 * 1. **Sin tildes ni mayúsculas.** `josé`, `JOSE` y `jose` son lo mismo.
 * 2. **Palabra por palabra.** El texto se parte en palabras y TODAS tienen que
 *    aparecer, cada una en el campo que sea. Así «juan perez» encuentra a
 *    «PEREZ GARCIA JUAN CARLOS» y «maria gonzalez» a «María González».
 * 3. **Los números se comparan como números.** `327` encuentra la acción
 *    `00327`, y `V-7000100` encuentra la cédula `7000100`: se comparan los
 *    dígitos, no los caracteres.
 * 4. **Lo mejor primero.** Coincidir exacto pesa más que empezar igual, y eso
 *    más que contener. Por eso `327` ahora pone la acción 00327 arriba por
 *    regla y no por suerte.
 *
 * No se pierde nada: todo lo que encontraba antes lo sigue encontrando.
 */

/** Cuánto vale cada tipo de coincidencia. Exacto pesa más que contener. */
const PESO_EXACTO = 4;
const PESO_EMPIEZA = 2;
const PESO_CONTIENE = 1;

/** Un campo ya preparado para comparar: texto sin tildes y sus dígitos. */
export interface CampoPreparado {
  texto: string;
  /** Solo los dígitos, o `''` si no tiene. Para cédulas y teléfonos. */
  digitos: string;
}

/** Una palabra de lo que se escribió, ya preparada. */
export interface PalabraBuscada extends CampoPreparado {
  /** El valor numérico, si la palabra es solo dígitos. `327` y `00327` dan 327. */
  numero: number | null;
}

/**
 * Minúsculas, sin tildes y con los espacios colapsados.
 *
 * `NFD` separa la letra de su tilde y el rango `̀-ͯ` borra la tilde.
 * Es la única forma de que `josé` y `jose` sean lo mismo sin tocar los datos.
 */
export const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Los dígitos de un texto: `0414-358` → `0414358`. */
export const soloDigitos = (texto: string): string => texto.replace(/\D+/g, '');

/** Prepara un campo del elemento para poder compararlo muchas veces. */
export const prepararCampo = (valor: unknown): CampoPreparado => {
  if (valor === null || valor === undefined) return { texto: '', digitos: '' };
  const texto = normalizar(String(valor));
  return { texto, digitos: soloDigitos(texto) };
};

/**
 * Parte lo que se escribió en palabras.
 *
 * Devuelve `[]` cuando no hay nada que buscar, que es la señal de "no filtres".
 */
export const prepararBusqueda = (texto: string): PalabraBuscada[] => {
  const limpio = normalizar(texto);
  if (!limpio) return [];
  return limpio.split(' ').map((palabra) => {
    const digitos = soloDigitos(palabra);
    const esSoloDigitos = digitos.length > 0 && digitos === palabra;
    return {
      texto: palabra,
      digitos,
      // `327` y `00327` son el mismo número: así el N° de acción se encuentra
      // escribiéndolo sin los ceros de delante.
      numero: esSoloDigitos ? Number(digitos) : null,
    };
  });
};

/** Cuánto vale esta palabra contra este campo. `0` es no coincide. */
const puntuarPalabra = (
  campo: CampoPreparado,
  palabra: PalabraBuscada,
): number => {
  if (!campo.texto) return 0;

  if (campo.texto === palabra.texto) return PESO_EXACTO;

  // Comparación numérica: `327` encuentra `00327`. Se exige que el campo sea
  // solo dígitos para no dar por exacto un teléfono que casualmente vale eso.
  if (
    palabra.numero !== null &&
    campo.digitos.length > 0 &&
    campo.digitos === campo.texto &&
    Number(campo.digitos) === palabra.numero
  ) {
    return PESO_EXACTO;
  }

  if (campo.texto.startsWith(palabra.texto)) return PESO_EMPIEZA;
  if (campo.texto.includes(palabra.texto)) return PESO_CONTIENE;

  // Último recurso: comparar solo los dígitos. Es lo que hace que `V-7000100`
  // encuentre la cédula `7000100` y que `0414 7000001` encuentre el teléfono
  // guardado como `0414-7000001`.
  if (palabra.digitos.length >= 3 && campo.digitos.includes(palabra.digitos)) {
    return PESO_CONTIENE;
  }

  return 0;
};

/**
 * Puntúa un elemento entero. `0` significa que NO coincide.
 *
 * Todas las palabras tienen que aparecer —cada una en el campo que sea— y la
 * puntuación es la suma de lo mejor que consiguió cada una.
 */
export const puntuarElemento = (
  campos: readonly CampoPreparado[],
  busqueda: readonly PalabraBuscada[],
): number => {
  let total = 0;
  for (const palabra of busqueda) {
    let mejor = 0;
    for (const campo of campos) {
      const punto = puntuarPalabra(campo, palabra);
      if (punto > mejor) mejor = punto;
      if (mejor === PESO_EXACTO) break;
    }
    // Una palabra que no aparece en ningún campo descarta el elemento: quien
    // escribe dos palabras las quiere las dos.
    if (mejor === 0) return 0;
    total += mejor;
  }
  return total;
};

/**
 * ¿Coincide este elemento? Versión de una línea para los sitios donde la
 * búsqueda va dentro de un `useMemo` junto a otros filtros y no se puede
 * llamar a `useBusqueda` (un hook no entra dentro de un `useMemo`).
 *
 * Usa exactamente la misma regla; lo único que no da es el orden por
 * puntuación, que esos sitios no usan porque ordenan por lo suyo.
 */
export const coincideTexto = (
  valores: readonly unknown[],
  busqueda: readonly PalabraBuscada[],
): boolean => {
  if (busqueda.length === 0) return true;
  return puntuarElemento(valores.map(prepararCampo), busqueda) > 0;
};
