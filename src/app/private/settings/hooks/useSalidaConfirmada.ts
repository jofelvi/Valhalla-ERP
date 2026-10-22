'use client';

import { useEffect } from 'react';

const MENSAJE =
  'Tiene cambios sin guardar. Si sale ahora, se perderán. ¿Salir de todos modos?';

/**
 * Avisa antes de perder cambios: al cerrar o recargar la pestaña y al pulsar un enlace
 * de la app. El botón "Atrás" del navegador no se puede interceptar aquí; por eso la
 * pantalla también ofrece "Descartar cambios" y el botón de guardar siempre a la vista.
 */
export function useSalidaConfirmada(sucio: boolean): void {
  useEffect(() => {
    if (!sucio) return;

    const alCerrar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const alHacerClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const origen = e.target;
      if (!(origen instanceof Element)) return;
      const enlace = origen.closest('a[href]');
      if (!(enlace instanceof HTMLAnchorElement)) return;
      if (
        enlace.target === '_blank' ||
        enlace.origin !== window.location.origin
      )
        return;
      if (
        enlace.pathname === window.location.pathname &&
        enlace.search === window.location.search
      ) {
        return;
      }
      if (!window.confirm(MENSAJE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', alCerrar);
    document.addEventListener('click', alHacerClic, true);
    return () => {
      window.removeEventListener('beforeunload', alCerrar);
      document.removeEventListener('click', alHacerClic, true);
    };
  }, [sucio]);
}
