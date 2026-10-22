import type { ConfigId } from '@odin6/types';

/**
 * Rutas de Ajustes. Son locales a esta carpeta porque `src/shared/constantsRoutes/routes.ts`
 * todavía no las declara: pedir al coordinador que las pase allí (ver reporte).
 */
export const AJUSTES_RUTA = '/private/settings';

export interface SeccionAjustes {
  id: ConfigId;
  titulo: string;
  descripcion: string;
  ruta: string;
  /** Orden del primer arranque (1 = primero). */
  paso?: number;
}

/** Las siete secciones, en el orden de la guía de primer arranque. */
export const SECCIONES_AJUSTES: readonly SeccionAjustes[] = [
  {
    id: 'negocio',
    titulo: 'Negocio',
    descripcion:
      'Nombre, RIF, dirección y datos de pago que salen en recibos y facturas.',
    ruta: `${AJUSTES_RUTA}/negocio`,
    paso: 1,
  },
  {
    id: 'marca',
    titulo: 'Marca',
    descripcion: 'Nombre de la aplicación, logos y colores de la pantalla.',
    ruta: `${AJUSTES_RUTA}/marca`,
    paso: 2,
  },
  {
    id: 'tarifas',
    titulo: 'Tarifas',
    descripcion:
      'Monedas, servicio del mesonero, impuesto y propinas sugeridas.',
    ruta: `${AJUSTES_RUTA}/tarifas`,
    paso: 3,
  },
  {
    id: 'nomina',
    titulo: 'Nómina',
    descripcion:
      'Comisión del mesonero, cortesías, descuentos a empleados y retenciones.',
    ruta: `${AJUSTES_RUTA}/nomina`,
    paso: 4,
  },
  {
    id: 'operacion',
    titulo: 'Operación',
    descripcion:
      'País, zona horaria, hora en que empieza el día y día de inicio de semana.',
    ruta: `${AJUSTES_RUTA}/operacion`,
    paso: 5,
  },
  {
    id: 'vocabulario',
    titulo: 'Vocabulario',
    descripcion:
      'Cómo se llama cada cosa en la pantalla: mesonero, mesa, cuenta…',
    ruta: `${AJUSTES_RUTA}/vocabulario`,
  },
  {
    id: 'modulos',
    titulo: 'Módulos',
    descripcion: 'Funciones opcionales que se activan o se ocultan del menú.',
    ruta: `${AJUSTES_RUTA}/modulos`,
  },
];

/** Orden del primer arranque, tal como lo pidió el dueño. */
export const PASOS_PRIMER_ARRANQUE: readonly SeccionAjustes[] =
  SECCIONES_AJUSTES.filter((s) => s.paso !== undefined).sort(
    (a, b) => (a.paso ?? 0) - (b.paso ?? 0),
  );
