import { cn } from '@/shared/utils/utils';
import { ReactNode } from 'react';
import { Panel } from '../panel/Panel';

/**
 * El cuadro de color que lleva el icono de una pantalla o de una tarjeta.
 *
 * El glifo lo pone quien llama, ya con su tamaño y color
 * (`<Users className="w-5 h-5 text-brand" />`), porque varía entre pantallas
 * y es lo único que de verdad cambia.
 */
export const IconoEnCuadro = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'w-9 h-9 bg-brand/20 rounded-xl flex items-center justify-center shrink-0',
      className,
    )}
  >
    {children}
  </div>
);

/**
 * Título de pantalla con su línea de contexto debajo.
 *
 * `subtitulo` acepta cualquier nodo porque casi siempre es un recuento vivo
 * ("12 proveedores · 8 activos"), no un texto fijo.
 *
 * No trae clases de disposición a propósito: quien lo coloca decide si crece
 * o no. `CabeceraDePantalla` le pone `min-w-0 flex-1`; las pantallas cuya
 * cabecera reparte el espacio con `justify-between` lo usan tal cual.
 */
export const TituloDePantalla = ({
  titulo,
  subtitulo,
  className,
  classNameTitulo,
  classNameSubtitulo,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  className?: string;
  classNameTitulo?: string;
  classNameSubtitulo?: string;
}) => (
  <div className={className}>
    <h1 className={cn('text-lg font-bold text-content', classNameTitulo)}>
      {titulo}
    </h1>
    {subtitulo !== undefined && subtitulo !== null && (
      <p className={cn('text-dim text-xs', classNameSubtitulo)}>{subtitulo}</p>
    )}
  </div>
);

interface CabeceraDePantallaProps {
  /** Lo que va ANTES del icono: normalmente el boton de volver. */
  antes?: ReactNode;
  /** El glifo, ya con su tamaño y color. */
  icono: ReactNode;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** Lo que va a la derecha: botones, enlaces, filtros. */
  acciones?: ReactNode;
  /** Debajo de la fila: pestañas, buscador, chips… */
  children?: ReactNode;
  className?: string;
  /** La fila que contiene icono, titulo y acciones. */
  classNameFila?: string;
  classNameCuadro?: string;
  /** El bloque de texto, por si la pantalla no quiere que crezca. */
  classNameTexto?: string;
  classNameTitulo?: string;
  classNameSubtitulo?: string;
}

/**
 * La cabecera que abre casi todas las pantallas del POS: panel con el cuadro
 * del icono, el título, una línea de contexto y las acciones a la derecha.
 *
 * Estaba escrita a mano en 38 archivos, con los mismos cuatro `<div>`
 * anidados. Para las pantallas cuya cabecera no encaja en esta composición
 * (las que apilan en móvil, por ejemplo) están sueltas las tres piezas
 * —`Panel`, `IconoEnCuadro` y `TituloDePantalla`— y la pantalla las combina
 * como necesite: así tampoco queda HTML repetido, sin llenar este componente
 * de perillas que solo usa una pantalla.
 */
export const CabeceraDePantalla = ({
  antes,
  icono,
  titulo,
  subtitulo,
  acciones,
  children,
  className,
  classNameFila,
  classNameCuadro,
  classNameTexto,
  classNameTitulo,
  classNameSubtitulo,
}: CabeceraDePantallaProps) => (
  <Panel className={cn('p-3.5 mb-3', className)}>
    <div className={cn('flex items-center gap-3', classNameFila)}>
      {antes}
      <IconoEnCuadro className={classNameCuadro}>{icono}</IconoEnCuadro>
      <TituloDePantalla
        titulo={titulo}
        subtitulo={subtitulo}
        className={cn('min-w-0 flex-1', classNameTexto)}
        classNameTitulo={classNameTitulo}
        classNameSubtitulo={classNameSubtitulo}
      />
      {acciones}
    </div>
    {children}
  </Panel>
);
