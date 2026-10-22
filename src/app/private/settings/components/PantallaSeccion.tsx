'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { FieldValues } from 'react-hook-form';
import { Button } from '@/shared';
import { AJUSTES_RUTA } from '../secciones';
import type { VistaFormulario } from '../hooks/useFormularioConfig';

interface PantallaSeccionProps<F extends FieldValues> {
  titulo: string;
  descripcion: string;
  vista: VistaFormulario<F>;
  children: ReactNode;
}

/**
 * Esqueleto común de las 7 pantallas de Ajustes: cabecera, acceso por rol, carga,
 * error, resumen de errores y la barra de guardar. Cada pantalla pone solo sus campos.
 */
export function PantallaSeccion<F extends FieldValues>({
  titulo,
  descripcion,
  vista,
  children,
}: PantallaSeccionProps<F>) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <CabeceraAjustes titulo={titulo} descripcion={descripcion} />

      {vista.cargando ? (
        <EstadoCarga />
      ) : !vista.puedeVer ? (
        <AvisoSinAcceso />
      ) : vista.errorCarga ? (
        <ErrorCarga />
      ) : (
        <form
          noValidate
          onSubmit={vista.onSubmit}
          aria-label={titulo}
          className="space-y-8"
        >
          {!vista.puedeEditar && <AvisoSoloLectura />}
          {vista.errores.length > 0 && (
            <ResumenErrores errores={vista.errores} />
          )}

          <fieldset
            disabled={!vista.puedeEditar}
            className="min-w-0 space-y-8 border-0 p-0"
          >
            {children}
          </fieldset>

          {vista.puedeEditar && (
            <BarraGuardar
              sucio={vista.sucio}
              guardando={vista.guardando}
              guardado={vista.guardado}
              descartar={vista.descartar}
            />
          )}
        </form>
      )}
    </main>
  );
}

function CabeceraAjustes({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion: string;
}) {
  return (
    <header className="space-y-3">
      <Link
        href={AJUSTES_RUTA}
        className="inline-flex items-center gap-2 rounded-lg text-sm text-dim hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Ajustes
      </Link>
      <h1 className="text-3xl font-bold text-content">{titulo}</h1>
      <p className="text-base text-dim">{descripcion}</p>
    </header>
  );
}

function EstadoCarga() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="text-sm text-dim">Cargando…</p>
      <div className="h-12 animate-pulse rounded-xl bg-elevated" />
      <div className="h-32 animate-pulse rounded-xl bg-elevated" />
    </div>
  );
}

function ErrorCarga() {
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger bg-surface p-4"
    >
      <p className="font-semibold text-danger">
        No se pudo cargar esta sección.
      </p>
      <p className="mt-1 text-sm text-dim">
        Revise la conexión y recargue la página. Si sigue igual, avise al
        administrador.
      </p>
    </div>
  );
}

function AvisoSinAcceso() {
  return (
    <div role="status" className="rounded-xl border border-line bg-surface p-4">
      <p className="text-content">Esta sección es solo para administradores.</p>
    </div>
  );
}

function AvisoSoloLectura() {
  return (
    <p
      role="note"
      className="rounded-xl border border-line bg-surface p-4 text-sm text-dim"
    >
      Puede ver estos datos, pero solo el administrador puede cambiarlos.
    </p>
  );
}

function ResumenErrores({ errores }: { errores: string[] }) {
  return (
    <div
      role="alert"
      tabIndex={-1}
      className="rounded-xl border border-danger bg-surface p-4"
    >
      <p className="font-semibold text-danger">
        Revise estos campos antes de guardar:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-content">
        {errores.map((mensaje) => (
          <li key={mensaje}>{mensaje}</li>
        ))}
      </ul>
    </div>
  );
}

interface BarraGuardarProps {
  sucio: boolean;
  guardando: boolean;
  guardado: boolean;
  descartar: () => void;
}

function BarraGuardar({
  sucio,
  guardando,
  guardado,
  descartar,
}: BarraGuardarProps) {
  const estado = sucio
    ? 'Hay cambios sin guardar.'
    : guardado
      ? 'Cambios guardados.'
      : '';
  return (
    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-page px-4 py-4 sm:-mx-6 sm:px-6">
      <p role="status" aria-live="polite" className="text-sm text-dim">
        {guardando ? 'Guardando…' : estado}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={descartar}
          disabled={!sucio || guardando}
        >
          Descartar cambios
        </Button>
        <Button
          type="submit"
          isLoading={guardando}
          disabled={!sucio || guardando}
        >
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
