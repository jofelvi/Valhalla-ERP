/**
 * Como se busca texto en TODO el sistema, en un solo sitio.
 *
 * Vivia dentro de `accounts-receivable-filter.util.ts` y solo la usaba esa
 * pantalla. Sale aqui el 25/09/2026 por orden del dueno —«hazlo a nivel de api
 * asi queda para los dos»— para que la web y el APK busquen con la MISMA
 * regla sin que ninguna de las dos la reimplemente.
 *
 * Lo que costo no tenerla: el catalogo llevaba dos fichas de lo mismo, «Te de
 * Jamaica» y «TE DE JAMAICA». Quien creo la segunda escribio sin tilde, no
 * encontro la que ya existia, y el sistema termino descontando contra la ficha
 * muerta: las 2 recetas que la usan, sus 11 movimientos de kardex y un saldo
 * de -18 en Barra colgaban de un producto dado de baja.
 *
 * Las reglas, en orden:
 *
 * 1. **Sin tildes ni mayusculas.** `jose`, `JOSE` y `josé` son lo mismo.
 * 2. **Palabra por palabra.** El texto se parte en palabras y TODAS tienen que
 *    aparecer, cada una en el campo que sea. Asi «luis alves» encuentra a
 *    «ALVES OLIVEIRA LUIS CARLOS».
 * 3. **Los numeros se comparan como numeros.** `327` encuentra `00327`, y
 *    `V-90000001-0` encuentra la cedula `8828343`.
 *
 * Medido el 20/09/2026 sobre los 2.993 clientes reales: antes de esto `jose`
 * daba 293 resultados y `josé` otros 21 DISTINTOS; `luis alves`, `maria
 * gonzalez`, `V-90000001-0` y un telefono con guion o espacio daban CERO.
 */

/** Filtro de Mongo listo para `find()`. */
export type FiltroMongo = Record<string, unknown>;

/**
 * Un texto de busqueda es texto, no una expresion regular: sin esto, escribir
 * un parentesis o un punto en el buscador lanza una excepcion de Mongo o
 * devuelve cualquier cosa.
 */
export const escaparRegex = (texto: string): string =>
  texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Letras que en la base pueden estar escritas con tilde o sin ella.
 *
 * Mongo no ignora los acentos en un `$regex` (la intercalacion no aplica ahi),
 * asi que la tolerancia se construye en el patron.
 */
const CLASES_CON_TILDE: Record<string, string> = {
  a: '[aáàäâã]',
  e: '[eéèëê]',
  i: '[iíìïî]',
  o: '[oóòöô]',
  u: '[uúùüû]',
  n: '[nñ]',
  c: '[cç]',
};

/** Minusculas, sin tildes y con los espacios colapsados. */
export const normalizarTexto = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Las palabras de lo que se escribio. `[]` significa "no filtres por texto". */
export const palabrasDe = (texto?: string): string[] => {
  const limpio = normalizarTexto(texto ?? '');
  return limpio ? limpio.split(' ') : [];
};

/** Patron que encuentra la palabra este escrita con tildes o sin ellas. */
export const patronTolerante = (palabra: string): string =>
  escaparRegex(palabra)
    .split('')
    .map((letra) => CLASES_CON_TILDE[letra] ?? letra)
    .join('');

/**
 * Patron que permite cualquier separador entre los digitos.
 *
 * Es lo que hace que `0XXX 1234567` encuentre el telefono guardado como
 * `0XXX-1234567`, y que `V-90000002-0` encuentre la cedula `12345678`.
 */
export const patronDeDigitos = (digitos: string): string =>
  digitos.split('').join('[^0-9]*');

/** Los patrones con los que se busca una palabra en un campo de texto. */
export const patronesDePalabra = (palabra: string): string[] => {
  const patrones = [patronTolerante(palabra)];
  const digitos = palabra.replace(/\D+/g, '');
  if (digitos.length >= 3) {
    patrones.push(patronDeDigitos(digitos));
    // `327` tiene que encontrar la accion `00327`: mismo numero, otros ceros.
    if (digitos === palabra) patrones.push(`^0*${digitos}$`);
  }
  return [...new Set(patrones)];
};

/** Las alternativas de Mongo para que UNA palabra aparezca en alguno de esos campos. */
export const clausulasDePalabra = (
  palabra: string,
  campos: readonly string[],
): FiltroMongo[] =>
  patronesDePalabra(palabra).flatMap((patron) =>
    campos.map((campo) => ({ [campo]: { $regex: patron, $options: 'i' } })),
  );

/**
 * El filtro de texto: TODAS las palabras tienen que aparecer, cada una en el
 * campo que sea. `null` significa "no hay nada que buscar".
 *
 * Antes era un solo `includes` sobre el texto entero: buscar «luis alves» a un
 * cliente llamado «ALVES OLIVEIRA LUIS CARLOS» daba cero, que es justo la
 * forma en que una persona busca a otra.
 */
export const filtroDeTexto = (
  texto: string | undefined,
  campos: readonly string[],
): FiltroMongo | null => {
  const palabras = palabrasDe(texto);
  if (palabras.length === 0) return null;
  return {
    $and: palabras.map((palabra) => ({
      $or: clausulasDePalabra(palabra, campos),
    })),
  };
};

/**
 * Una expresion regular tolerante para buscar en memoria, cuando los datos ya
 * estan cargados y no hay consulta a Mongo que hacer (el bot de Telegram).
 */
export const regexTolerante = (texto: string): RegExp =>
  new RegExp(patronTolerante(normalizarTexto(texto)), 'i');
