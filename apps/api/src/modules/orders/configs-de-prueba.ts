import { CONFIG_DEFAULTS, ConfigId, ConfigMap } from '@odin6/types';
import { ConfigsService } from '../configs/configs.service';

/**
 * Proveedor de `ConfigsService` para pruebas. Sirve los valores neutros del contrato, o
 * los que se pasen en `vigentes`: la prueba puede cambiarlos después y el servicio los
 * lee en la siguiente llamada (así se prueba que una orden ya creada no cambia).
 */
export function configsDePrueba(vigentes: Partial<ConfigMap> = {}): {
  provide: typeof ConfigsService;
  useValue: Pick<ConfigsService, 'obtener' | 'obtenerCrudo'>;
} {
  return {
    provide: ConfigsService,
    useValue: {
      obtener: async <K extends ConfigId>(id: K): Promise<ConfigMap[K]> =>
        (vigentes[id] ?? CONFIG_DEFAULTS[id]) as ConfigMap[K],
      // Documentos internos (`configs/<id>`) sin nada guardado: el normalizador usa su default.
      obtenerCrudo: async <T>(
        _id: string,
        normalizar: (doc: null) => T,
      ): Promise<T> => normalizar(null),
    },
  };
}
