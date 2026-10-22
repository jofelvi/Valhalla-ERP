/**
 * Clasificador del estado de la Subasta electronica del BDV.
 *
 * Es una funcion pura a proposito: separa "que se ve en pantalla" de "que
 * significa", asi el significado se prueba con los HTML capturados del banco
 * sin abrir un navegador ni tocar la banca en linea.
 *
 * Observado el 13/08/2026 con la subasta CERRADA: al pulsar "Subasta
 * electronica" el portal NO navega (se queda en /main/posicionconsolidada) y
 * muestra un mat-snack-bar con "Las operaciones cambiarias estaran disponibles
 * mas tarde. Intenta luego.". La pantalla no tiene ningun input.
 */
export type EstadoSubasta = 'ABIERTA' | 'CERRADA' | 'DESCONOCIDA';

export interface SubastaScreen {
  /** URL tras pulsar "Subasta electronica". */
  url: string;
  /** Texto del mat-snack-bar, o cadena vacia si no hay ninguno. */
  snackbarText: string;
  /** innerText del body, como respaldo si el aviso no viene en un snackbar. */
  bodyText: string;
  /** Inputs y selects VISIBLES: con la subasta cerrada son 0. */
  inputCount: number;
  /**
   * Texto cifrado que devuelve /validar-mercado/validar-subasta, el endpoint
   * que la propia app consulta al pulsar el menu. Vacio si no se pudo leer.
   */
  respCifrado?: string;
}

/** Quita tildes y baja a minusculas: el banco escribe "estaran" y "estarán". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Se exige el asunto ("operaciones cambiarias") Y una forma de aplazamiento.
 * Si el banco cambiara el motivo (suspension, mantenimiento) el resultado cae
 * en DESCONOCIDA y el bot avisa, en vez de callar como si estuviera cerrada.
 */
const APLAZAMIENTO = ['mas tarde', 'intenta luego', 'intente luego'];

/**
 * La app del banco cascando (no el banco diciendo algo). Visto en produccion:
 * "Cannot read properties of null (reading 'resp')" pintado en la pagina.
 */
const ERRORES_DE_APP = [
  'cannot read propert',
  'is not a function',
  'undefined is not',
  'unexpected token',
];

function pareceErrorDeApp(texto: string): boolean {
  const t = normalizar(texto);
  return ERRORES_DE_APP.some((frase) => t.includes(frase));
}

function esAvisoDeCerrado(texto: string): boolean {
  const t = normalizar(texto);
  return (
    t.includes('operaciones cambiarias') &&
    APLAZAMIENTO.some((frase) => t.includes(frase))
  );
}

/**
 * @param baseline texto cifrado que devuelve validar-subasta con la subasta
 *   CERRADA. Solo se usa para CONFIRMAR que sigue cerrada: que sea distinto no
 *   prueba nada, porque tambien cambia al renovarse el token del banco cada
 *   ~3 min. Se pasa vacio para desactivar esta senal.
 */
export function clasificarSubasta(
  screen: SubastaScreen,
  baseline = '',
): EstadoSubasta {
  // El aviso del banco manda sobre cualquier otra senal: si el portal dice que
  // esta cerrada, esta cerrada.
  if (
    esAvisoDeCerrado(screen.snackbarText) ||
    esAvisoDeCerrado(screen.bodyText)
  ) {
    return 'CERRADA';
  }

  // Nunca hemos visto la subasta abierta, asi que se reconoce por lo que
  // necesariamente cambia: o el portal navega a su ruta, o pinta el formulario
  // para ofertar. Ante la duda conviene un falso aviso y no una ventana perdida.
  const url = normalizar(screen.url);
  const navegoALaSubasta =
    !url.includes('posicionconsolidada') &&
    (url.includes('subasta') ||
      url.includes('divisa') ||
      url.includes('cambiaria'));

  if (navegoALaSubasta || screen.inputCount > 0) {
    return 'ABIERTA';
  }

  // El cifrado del endpoint SOLO sirve para confirmar que sigue cerrada, nunca
  // para afirmar que abrio.
  //
  // Se penso al reves y los datos lo desmintieron: en una franja de 111
  // comprobaciones el valor cambio 3 veces (en la 24, la 55 y la 86), o sea
  // cada 31 vueltas ~ cada 3,1 minutos, que es justo lo que dura el token JWT
  // del banco. Cambia al renovarse la sesion, no porque cambie la subasta. Con
  // la regla "distinto = abierta" habria soltado una falsa alarma cada 3
  // minutos y, peor, el vigilante habria DEJADO DE VIGILAR creyendo que ya
  // estaba dentro. Un valor distinto no dice nada; uno igual si dice que sigue
  // cerrada.
  if (baseline && screen.respCifrado && screen.respCifrado === baseline) {
    return 'CERRADA';
  }

  // Si la app del banco reventó, no sabemos nada. El 16/08 a las 8:04 la
  // pantalla mostro "Cannot read properties of null (reading 'resp')": su
  // propio JS fallo al procesar la respuesta. Como tampoco salio el aviso de
  // cerrado, se dio por ENTRO, el vigilante paro y quedaron 26 minutos de
  // franja sin vigilar. Un error de la app no es una apertura.
  if (
    pareceErrorDeApp(screen.snackbarText) ||
    pareceErrorDeApp(screen.bodyText)
  ) {
    return 'DESCONOCIDA';
  }

  // La ausencia del aviso solo significa "entro" si la app llego a responder.
  // Sin haber visto la respuesta de validar-subasta no hay ninguna prueba de
  // que el clic siquiera se registrara: ausencia de evidencia no es evidencia.
  // (En la deteccion falsa del 16/08 el log ya lo decia: "cifrado: no leido".)
  if (!screen.respCifrado) {
    return 'DESCONOCIDA';
  }

  // Aqui si: el banco respondio, no dijo que estuviera cerrada y su respuesta
  // no es la de cerrada. Entro. Se trata como ABIERTA y el vigilante PARA de
  // pulsar: seguir pulsando sacaria al usuario de la pantalla donde va a
  // comprar, justo en el momento bueno.
  return 'ABIERTA';
}
