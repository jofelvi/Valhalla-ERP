import { RegistroPacks } from './pack-registry';

/**
 * Registro de packs de PRUEBA, con IDs ficticios. El real vive en `configs/packs` de cada
 * negocio; el código no trae ninguno.
 */
export const REGISTRO_PACKS_PRUEBA: RegistroPacks = {
  packs: {
    'pack-tobo-12': { totalUnits: 12, label: 'Tobo de prueba (12 und)' },
    'pack-lata-12': { totalUnits: 12, label: 'Tobo de lata de prueba (12)' },
    'pack-media-18': { totalUnits: 18, label: 'Media caja de prueba (18)' },
    'pack-caja-36': { totalUnits: 36, label: 'Caja de prueba (36)' },
  },
  individualAPacks: {
    // Botellas: tobo de 12, media caja de 18 o caja de 36.
    'prod-botella-a': ['pack-tobo-12', 'pack-media-18', 'pack-caja-36'],
    'prod-botella-b': ['pack-tobo-12', 'pack-media-18', 'pack-caja-36'],
    'prod-botella-c': ['pack-tobo-12', 'pack-media-18', 'pack-caja-36'],
    // Latas: solo el tobo de lata.
    'prod-lata-a': ['pack-lata-12'],
    'prod-lata-b': ['pack-lata-12'],
    'prod-lata-c': ['pack-lata-12'],
  },
};
