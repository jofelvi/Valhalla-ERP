/**
 * Como busca texto la APK cuando no puede preguntarle al servidor.
 *
 * La regla de verdad vive en la API (`apps/api/src/common/busqueda-texto.util.ts`)
 * y las pantallas le preguntan a ella con `GET /api/products?q=`. Esto es el
 * RESPALDO: lo que se usa mientras la peticion viaja, y sobre todo cuando no
 * hay internet — medido en el local, 28 cortes en 30 dias, el peor de 116
 * minutos. Sin respaldo, un corte dejaria al cajero sin poder buscar un
 * producto que ya tiene cargado en la pantalla.
 *
 * Es una COPIA a proposito, igual que `dinero.ts` y `types/enums.ts`: el APK se
 * instala con `pnpm install --ignore-workspace` (ruta corta para el build de
 * Android) y no puede importar paquetes del workspace. `busquedaTexto.test.ts`
 * comprueba que no se desincronice de lo que hace el servidor.
 *
 * Lo que costo no tener esto: el catalogo llego a tener DOS fichas de lo mismo,
 * «Te de Jamaica» y «TE DE JAMAICA», porque quien creo la segunda escribio sin
 * tilde y el buscador —que hacia `toLowerCase().includes()`— no encontro la que
 * ya existia. El sistema termino descontando inventario contra la ficha muerta.
 */

/**
 * Minusculas, sin tildes y con los espacios colapsados.
 *
 * `NFD` separa la letra de su tilde y el rango de combinantes la borra. Es la
 * unica forma de que `josé` y `jose` sean lo mismo sin tocar los datos.
 */
export const normalizar = (texto: string): string =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Las palabras de lo que se escribio. `[]` significa "no filtres".
 */
export const palabrasDe = (texto: string): string[] => {
  const limpio = normalizar(texto);
  return limpio ? limpio.split(' ') : [];
};

/**
 * Patrón que permite cualquier separador (no dígitos) entre los dígitos.
 * Ej: patronDeDigitos('414') → '4[^0-9]*1[^0-9]*4'
 * Esto permite que '0414 3582580' encuentre '0414-3582580'.
 */
export const patronDeDigitos = (digitos: string): RegExp => {
  const patron = digitos.split('').join('[^0-9]*');
  return new RegExp(patron, 'i');
};

/**
 * Los patrones con los que se busca una palabra: tolerante (sin tildes) y por dígitos
 * si hay >= 3 dígitos en la palabra.
 */
export const patronesDePalabra = (palabra: string): RegExp[] => {
  const patrones: RegExp[] = [new RegExp(palabra, 'i')];
  const digitos = palabra.replace(/\D+/g, '');
  if (digitos.length >= 3) {
    patrones.push(patronDeDigitos(digitos));
    // '327' tiene que encontrar '00327': mismo número, otros ceros.
    if (digitos === palabra) {
      patrones.push(new RegExp(`^0*${digitos}$`, 'i'));
    }
  }
  return patrones;
};

/**
 * Si un elemento coincide: TODAS las palabras tienen que aparecer, cada una en
 * el campo que sea y en cualquier orden.
 *
 * El orden importa mas de lo que parece: buscar «caja pizza» a un producto
 * llamado «Caja de Pizza» daba cero cuando se comparaba el texto entero de una
 * pieza, y es justo como una persona escribe.
 */
export const coincide = (
  valores: readonly unknown[],
  palabras: readonly string[],
): boolean => {
  if (palabras.length === 0) return true;
  const campos = valores
    .filter((v) => v !== null && v !== undefined)
    .map((v) => normalizar(String(v)));
  if (campos.length === 0) return false;
  return palabras.every((palabra) => {
    const patrones = patronesDePalabra(palabra);
    return campos.some((campo) =>
      patrones.some((patron) => patron.test(campo)),
    );
  });
};

/**
 * Filtra una lista ya cargada. Es el respaldo completo: se le pasan los campos
 * en los que mirar y devuelve lo que coincide, sin tocar la red.
 */
export const filtrarLocal = <T>(
  items: T[],
  texto: string,
  campos: readonly (keyof T)[],
): T[] => {
  const palabras = palabrasDe(texto);
  // Sin texto se devuelve la MISMA lista, no una copia: un array nuevo en cada
  // render hace que las pantallas memoizadas se repinten sin que haya cambiado
  // nada, que es justo lo que el presupuesto de renders viene a evitar.
  if (palabras.length === 0) return items;
  return items.filter((item) =>
    coincide(
      campos.map((campo) => item[campo]),
      palabras,
    ),
  );
};
