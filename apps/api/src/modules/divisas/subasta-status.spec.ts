import { clasificarSubasta, SubastaScreen } from './subasta-status';

/**
 * El mensaje real capturado del portal el 13/08/2026 con la subasta cerrada.
 * Sale en un mat-snack-bar; la URL no cambia al pulsar "Subasta electronica".
 */
const MENSAJE_CERRADA =
  'Las operaciones cambiarias estarán disponibles más tarde. Intenta luego.';
const URL_SIN_NAVEGAR =
  'https://bdvenlinea.banvenez.com/main/posicionconsolidada';

const pantalla = (over: Partial<SubastaScreen> = {}): SubastaScreen => ({
  url: URL_SIN_NAVEGAR,
  snackbarText: '',
  bodyText: '',
  inputCount: 0,
  ...over,
});

describe('clasificarSubasta', () => {
  it('CERRADA con el mensaje real del banco en el snackbar', () => {
    expect(clasificarSubasta(pantalla({ snackbarText: MENSAJE_CERRADA }))).toBe(
      'CERRADA',
    );
  });

  // El detector no puede depender de tildes ni de mayusculas: basta que el
  // banco cambie "Intenta" por "intente" para dejarnos ciegos.
  it('CERRADA aunque cambien tildes y mayusculas', () => {
    expect(
      clasificarSubasta(
        pantalla({
          snackbarText:
            'LAS OPERACIONES CAMBIARIAS ESTARAN DISPONIBLES MAS TARDE',
        }),
      ),
    ).toBe('CERRADA');
  });

  it('CERRADA si el mensaje aparece en el body y no en el snackbar', () => {
    expect(clasificarSubasta(pantalla({ bodyText: MENSAJE_CERRADA }))).toBe(
      'CERRADA',
    );
  });

  it('ABIERTA cuando el portal navega a la ruta de subasta', () => {
    expect(
      clasificarSubasta(
        pantalla({
          url: 'https://bdvenlinea.banvenez.com/main/subasta-electronica',
        }),
      ),
    ).toBe('ABIERTA');
  });

  it('ABIERTA cuando aparecen campos para ofertar', () => {
    expect(clasificarSubasta(pantalla({ inputCount: 3 }))).toBe('ABIERTA');
  });

  // Si el banco muestra el aviso de cerrado, manda ese aviso: cualquier input
  // suelto de la pantalla de fondo no puede convertirse en un falso "abierta".
  it('CERRADA gana sobre los inputs si ambos estan presentes', () => {
    expect(
      clasificarSubasta(
        pantalla({ snackbarText: MENSAJE_CERRADA, inputCount: 5 }),
      ),
    ).toBe('CERRADA');
  });

  // Regla del banco: el aviso SOLO sale cuando esta cerrada. Si no salio (y se
  // espero a que saliera), es que entro. Tiene que dar ABIERTA y no "no se":
  // con DESCONOCIDA el vigilante seguiria pulsando el menu y el siguiente clic
  // sacaria al usuario de la pantalla donde va a comprar.
  // Sin haber visto la respuesta del banco no se puede afirmar que entro.
  it('DESCONOCIDA si no aparecio aviso y tampoco se leyo la respuesta', () => {
    expect(clasificarSubasta(pantalla())).toBe('DESCONOCIDA');
  });

  it('ABIERTA si no hubo aviso pero el banco si respondio', () => {
    expect(clasificarSubasta(pantalla({ respCifrado: 'RESP' }))).toBe(
      'ABIERTA',
    );
  });

  it('ABIERTA con un mensaje que no es el de cerrado, si el banco respondio', () => {
    expect(
      clasificarSubasta(
        pantalla({
          snackbarText: 'Servicio en mantenimiento programado',
          respCifrado: 'RESP',
        }),
      ),
    ).toBe('ABIERTA');
  });

  it('ABIERTA si habla de cambiarias sin aplazamiento y el banco respondio', () => {
    expect(
      clasificarSubasta(
        pantalla({
          snackbarText: 'Las operaciones cambiarias fueron suspendidas',
          respCifrado: 'RESP',
        }),
      ),
    ).toBe('ABIERTA');
  });
});

/**
 * Senal extra: el texto cifrado de /validar-mercado/validar-subasta. El portal
 * cifra de forma determinista (se comprobo con consultaCuentas: dos llamadas
 * seguidas devolvieron bytes identicos), asi que un cambio delata el cambio de
 * estado sin descifrar nada.
 */
describe('clasificarSubasta con linea base del endpoint', () => {
  const BASE = 'rc0yvf38a2rEhQOcrWb0cDQeqfOtm42OTCqhVECzGrZ==';

  // Un cifrado distinto NO prueba que abrio: cambia solo cada ~3 min al
  // renovarse el token del banco (visto 3 veces en 111 comprobaciones). Manda
  // entonces la regla del aviso.
  it('un cifrado distinto, con el banco respondiendo, si es apertura', () => {
    expect(
      clasificarSubasta(pantalla({ respCifrado: 'OTRO-VALOR-DISTINTO' }), BASE),
    ).toBe('ABIERTA');
  });

  it('un cifrado distinto NO puede tumbar el aviso de cerrado', () => {
    expect(
      clasificarSubasta(
        pantalla({ snackbarText: MENSAJE_CERRADA, respCifrado: 'OTRO-VALOR' }),
        BASE,
      ),
    ).toBe('CERRADA');
  });

  // El endpoint del banco manda sobre la ausencia de aviso: si dice lo mismo
  // que cuando esta cerrada, es que el aviso simplemente no llego a pintarse.
  it('CERRADA si el cifrado sigue siendo el de cerrada, aunque no haya aviso', () => {
    expect(clasificarSubasta(pantalla({ respCifrado: BASE }), BASE)).toBe(
      'CERRADA',
    );
  });

  // El aviso del banco sigue mandando: evita un falso positivo si el cifrado
  // cambiara por cualquier otro motivo.
  it('CERRADA gana sobre un cifrado distinto', () => {
    expect(
      clasificarSubasta(
        pantalla({ snackbarText: MENSAJE_CERRADA, respCifrado: 'OTRO' }),
        BASE,
      ),
    ).toBe('CERRADA');
  });

  // Sin linea base configurada la senal se ignora y decide la regla del aviso.
  it('sin linea base, con respuesta del banco y sin aviso, es apertura', () => {
    expect(clasificarSubasta(pantalla({ respCifrado: 'CUALQUIERA' }))).toBe(
      'ABIERTA',
    );
  });

  it('CERRADA sigue mandando aunque no se leyera el cifrado', () => {
    expect(
      clasificarSubasta(
        pantalla({ snackbarText: MENSAJE_CERRADA, respCifrado: '' }),
        BASE,
      ),
    ).toBe('CERRADA');
  });
});

/**
 * El falso positivo del 16/08/2026 a las 8:04. La app del banco reventó
 * ("Cannot read properties of null (reading 'resp')"), no salio el aviso de
 * cerrado, se dio por ENTRO, el vigilante paro y quedaron 26 minutos de franja
 * sin vigilar. Un error de la app no es una apertura.
 */
describe('clasificarSubasta ante fallos del portal', () => {
  const BASE = 'rc0yvf38a2rEhQOcrWb0cDQeqfOtm42OTCqhVECzGrZ==';

  it('DESCONOCIDA si la app del banco pinta un error de JavaScript', () => {
    expect(
      clasificarSubasta(
        pantalla({
          bodyText:
            "Posición Consolidada Créditos UVC Cannot read properties of null (reading 'resp')",
          respCifrado: 'ALGO',
        }),
        BASE,
      ),
    ).toBe('DESCONOCIDA');
  });

  // "cifrado: no leido" significa que ni siquiera se vio la peticion al banco:
  // no hay ninguna prueba de que el clic se registrara.
  it('DESCONOCIDA si no se llego a leer la respuesta del banco', () => {
    expect(clasificarSubasta(pantalla({ respCifrado: '' }), BASE)).toBe(
      'DESCONOCIDA',
    );
  });

  it('reproduce el caso real del 16/08 y NO dice ABIERTA', () => {
    expect(
      clasificarSubasta(
        pantalla({
          url: 'https://bdvenlinea.banvenez.com/main/posicionconsolidada',
          snackbarText: '',
          bodyText: "Cannot read properties of null (reading 'resp')",
          inputCount: 0,
          respCifrado: '',
        }),
        BASE,
      ),
    ).toBe('DESCONOCIDA');
  });

  // La contrapartida: con el banco respondiendo con normalidad, la ausencia del
  // aviso sigue significando que entro.
  it('ABIERTA si el banco respondio, no dijo cerrada y su respuesta cambio', () => {
    expect(
      clasificarSubasta(pantalla({ respCifrado: 'RESPUESTA-NUEVA' }), BASE),
    ).toBe('ABIERTA');
  });
});
