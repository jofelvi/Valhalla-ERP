import { useEffect, useState } from 'react';
import { checkPrintService } from '@/features/pos/services/thermalPrintService';

/**
 * Si hay por donde imprimir: el print-service local o uno conectado al
 * servidor. `null` mientras se averigua.
 *
 * Solo sirve para la pantalla (avisos y botones de reimprimir): el envio de
 * la comanda NO depende de esto, se manda siempre y se juzga el resultado
 * (`comandaPrintOutcome`). Antes arrancaba en `false` y se consultaba una
 * sola vez al montar: guardar antes de la respuesta, o un fallo puntual,
 * dejaba la pantalla creyendo que no habia impresora toda la visita.
 * Por eso tambien se vuelve a preguntar cuando la pestaña recupera el foco.
 */
export function usePrintServiceAvailable(): boolean | null {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let vigente = true;
    const consultar = () => {
      void checkPrintService().then((ok) => {
        if (vigente) setIsAvailable(ok);
      });
    };
    const alVolver = () => {
      if (document.visibilityState === 'visible') consultar();
    };
    consultar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vigente = false;
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  return isAvailable;
}
