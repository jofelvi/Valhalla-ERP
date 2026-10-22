'use client';
import { createPortal } from 'react-dom';
import React, { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import {
  claseDeCapa,
  enfocablesDe,
  SELECTOR_ENFOCABLE,
  siguienteFoco,
  type CapaDeModal,
} from '@/shared/utils/modal';

interface ModalProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
  classNameWrap?: string;
  variant?: 'light' | 'dark';
  onClose?: () => void;
  /**
   * Cabecera con título y aspa de cerrar. Los modales escritos a mano la
   * rehacían uno por uno, cada cual con su tamaño de letra.
   */
  titulo?: React.ReactNode;
  /** Bajo el título, en letra chica: para qué sirve este modal. */
  descripcion?: React.ReactNode;
  /** Pie fijo, para los botones de acción. */
  pie?: React.ReactNode;
  /**
   * En qué capa se dibuja. Un modal abierto DESDE otro necesita `encima`, o
   * queda debajo del que lo abrió.
   */
  capa?: CapaDeModal;
  /**
   * En móvil sube desde abajo pegado al borde, como una hoja. Es lo que ya
   * hacían a mano las listas largas (recetas, conteo, cuentas por cobrar).
   */
  hojaEnMovil?: boolean;
  /** Por defecto Escape cierra. Se apaga en lo que no se debe cerrar sin querer. */
  cerrarConEscape?: boolean;
  /** Por defecto pulsar el fondo cierra. */
  cerrarConFondo?: boolean;
  /**
   * Clases del fondo oscuro, cuando `variant` no alcanza. Existe para poder
   * migrar los modales escritos a mano conservando EXACTAMENTE el fondo que
   * ya tenian (conviven bg-black/40, /50, /60, /70 y /80).
   */
  classNameFondo?: string;
  /**
   * El panel se dibuja SIN el aspecto del sistema (fondo, borde, ancho, alto,
   * animacion): solo queda el portal, el fondo oscuro, Escape y la trampa de
   * foco. Es lo que necesitan los modales que ya traian su propio aspecto y
   * que solo debian ganar el comportamiento, sin cambiar un pixel.
   */
  estiloPropio?: boolean;
}

const FONDOS = {
  light: 'bg-black/30 backdrop-blur-md',
  dark: 'bg-black/50 backdrop-blur-lg',
} as const;

/**
 * El modal del sistema: portal, fondo, Escape, trampa de foco y devolución del
 * foco al cerrar.
 *
 * Existe porque había 43 modales montados a mano en 33 archivos, con 25
 * cadenas de clases distintas para el mismo fondo negro. De esos 43, tres
 * cerraban con Escape (con el mismo `useEffect` copiado) y NINGUNO atrapaba el
 * foco: con el modal abierto, tabular seguía recorriendo la pantalla de atrás.
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  children,
  className,
  classNameWrap,
  variant = 'light',
  onClose,
  titulo,
  descripcion,
  pie,
  capa = 'base',
  hojaEnMovil = false,
  cerrarConEscape = true,
  cerrarConFondo = true,
  classNameFondo,
  estiloPropio = false,
}) => {
  const caja = useRef<HTMLDivElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  // Al abrir se recuerda desde dónde se abrió, y al cerrar el foco vuelve ahí.
  // Sin esto, cerrar un modal deja el cursor al principio de la página y hay
  // que volver a bajar hasta el botón que se acaba de pulsar.
  useEffect(() => {
    if (!isOpen) return;
    focoPrevio.current = document.activeElement as HTMLElement | null;
    const dentro =
      caja.current?.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE);
    enfocablesDe([...(dentro ?? [])])[0]?.focus();
    return () => focoPrevio.current?.focus?.();
  }, [isOpen]);

  const alTeclear = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cerrarConEscape) {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !caja.current) return;
      const lista = enfocablesDe([
        ...caja.current.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLE),
      ]);
      if (lista.length === 0) return;
      const actual = lista.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      lista[siguienteFoco(actual, lista.length, e.shiftKey)]?.focus();
    },
    [cerrarConEscape, onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [isOpen, alTeclear]);

  if (!isOpen) return null;

  const clasesCaja = cn(
    'relative',
    !estiloPropio && [
      'bg-surface/95 backdrop-blur-xl rounded-2xl max-w-md w-full mx-4',
      'shadow-2xl shadow-cyan-500/10',
      'border border-line/50',
      'transform transition-all duration-300 ease-out',
      'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4',
      'flex flex-col',
      'min-h-[200px] max-h-[90vh]',
    ],
    hojaEnMovil && 'rounded-b-none sm:rounded-b-2xl mx-0 sm:mx-4',
    className,
  );

  const clasesFuera = cn(
    'fixed inset-0',
    claseDeCapa(capa),
    'flex justify-center',
    hojaEnMovil ? 'items-end sm:items-center' : 'items-center',
    'p-4',
    !estiloPropio && 'animate-in fade-in-0 duration-300',
    classNameWrap,
  );

  return createPortal(
    <div className={clasesFuera}>
      <div
        role="button"
        tabIndex={-1}
        aria-hidden="true"
        className={cn(
          'absolute inset-0 transition-all duration-300',
          classNameFondo ?? FONDOS[variant],
        )}
        onClick={cerrarConFondo ? onClose : undefined}
      />

      <div
        ref={caja}
        className={clasesCaja}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {titulo !== undefined && (
          <div className="flex items-start justify-between gap-4 border-b border-line/50 px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-content">
                {titulo}
              </h2>
              {descripcion !== undefined && (
                <p className="mt-0.5 text-xs text-dim">{descripcion}</p>
              )}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="shrink-0 rounded-lg p-1 text-dim transition-colors hover:bg-elevated hover:text-content"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Sin cabecera ni pie no se envuelve: el envoltorio rompia los paneles
            que traen su propio `flex flex-col` con scroll interno y pie fijo
            (en "Generar Factura" los botones quedaban fuera de la pantalla). */}
        {titulo === undefined && pie === undefined ? (
          children
        ) : (
          <div
            className={cn(
              'min-h-0 flex-1',
              titulo !== undefined && 'overflow-y-auto',
            )}
          >
            {children}
          </div>
        )}

        {pie !== undefined && (
          <div className="border-t border-line/50 px-5 py-4">{pie}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
