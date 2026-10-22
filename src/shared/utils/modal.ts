/**
 * La lógica del modal que no necesita un navegador para probarse: en qué capa
 * se dibuja y cómo se mueve el foco dentro de él.
 *
 * Sale del componente porque el repo no tiene librería de test de DOM, y esto
 * es justo lo que más se rompe en silencio: un modal abierto sobre otro que
 * queda debajo, o un Tab que se escapa a la pantalla de atrás.
 */

/**
 * Los cuatro niveles que hoy están escritos a mano por las pantallas.
 *
 * Medido el 08/09/2026: conviven `z-40`, `z-50`, `z-[60]` y `z-[100]` en 33
 * archivos. Sin un nombre para cada uno, abrir un modal desde otro obliga a
 * adivinar el número — y adivinar mal deja el segundo debajo del primero.
 */
export const CAPAS_DE_MODAL = {
  /** Detrás de la barra lateral: el fondo oscuro del menú en móvil. */
  fondo: 40,
  /** Lo normal: un modal sobre la pantalla. */
  base: 50,
  /** Un modal abierto DESDE otro modal (confirmar dentro de un formulario). */
  encima: 60,
  /** Lo que no puede quedar tapado por nada: la vista de un comprobante. */
  sobreTodo: 100,
} as const;

export type CapaDeModal = keyof typeof CAPAS_DE_MODAL;

const CLASES: Record<CapaDeModal, string> = {
  fondo: 'z-40',
  base: 'z-50',
  encima: 'z-[60]',
  sobreTodo: 'z-[100]',
};

export const claseDeCapa = (capa: CapaDeModal = 'base'): string => CLASES[capa];

/** Lo que el navegador deja enfocar con Tab dentro del modal. */
export const SELECTOR_ENFOCABLE =
  'a[href], button, input, textarea, select, details, [tabindex]';

interface Enfocable {
  readonly tagName: string;
  readonly disabled?: boolean;
  readonly hidden?: boolean;
  getAttribute(nombre: string): string | null;
}

/**
 * De los candidatos, los que de verdad pueden recibir el foco.
 *
 * Un botón deshabilitado, un campo oculto o algo con `tabindex="-1"` siguen
 * apareciendo en el DOM pero el Tab los salta: si se cuentan, la trampa de
 * foco manda el cursor a la nada.
 */
export const enfocablesDe = <T extends Enfocable>(nodos: readonly T[]): T[] =>
  nodos.filter(
    (n) => !n.disabled && !n.hidden && n.getAttribute('tabindex') !== '-1',
  );

/**
 * A dónde va el foco al pulsar Tab (o Shift+Tab) dentro del modal.
 *
 * `actual` es -1 cuando el foco está fuera: entonces entra por el primero (o
 * por el último si se venía hacia atrás). En los extremos da la vuelta, que es
 * lo que hace que el modal SEA modal: la pantalla de atrás sigue ahí debajo y
 * el Tab no puede irse a ella.
 */
export const siguienteFoco = (
  actual: number,
  total: number,
  haciaAtras: boolean,
): number => {
  if (total <= 0) return -1;
  if (actual < 0) return haciaAtras ? total - 1 : 0;
  return haciaAtras ? (actual - 1 + total) % total : (actual + 1) % total;
};
