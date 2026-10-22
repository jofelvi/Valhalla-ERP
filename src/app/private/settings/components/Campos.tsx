'use client';

import type { ReactNode, InputHTMLAttributes } from 'react';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/shared';

const CLASE_CONTROL =
  'w-full rounded-xl border border-line bg-elevated/50 px-3 py-2 text-sm text-content shadow-sm transition-colors placeholder:text-dim/70 focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60';

/** Grupo de campos con leyenda accesible. */
export function Grupo({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 space-y-4 rounded-2xl border border-line bg-surface p-5">
      <legend className="px-1 text-lg font-semibold text-content">
        {titulo}
      </legend>
      {descripcion && <p className="-mt-2 text-sm text-dim">{descripcion}</p>}
      {children}
    </fieldset>
  );
}

/** Mensaje de error debajo de un control; lo anuncia el lector de pantalla. */
function MensajeError({ id, error }: { id: string; error?: FieldError }) {
  if (!error?.message) return null;
  return (
    <p id={id} className="text-sm text-danger">
      {error.message}
    </p>
  );
}

interface CampoTextoProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> {
  id: string;
  etiqueta: string;
  registro: UseFormRegisterReturn;
  error?: FieldError;
  ayuda?: string;
}

/** Campo de texto con su etiqueta, ayuda y error asociados (reutiliza `Input` compartido). */
export function CampoTexto({
  id,
  etiqueta,
  registro,
  error,
  ayuda,
  ...resto
}: CampoTextoProps) {
  return (
    <Input
      id={id}
      label={etiqueta}
      error={error}
      textHelper={ayuda}
      {...registro}
      {...resto}
    />
  );
}

interface CampoAreaProps {
  id: string;
  etiqueta: string;
  registro: UseFormRegisterReturn;
  error?: FieldError;
  ayuda?: string;
  filas?: number;
}

export function CampoArea({
  id,
  etiqueta,
  registro,
  error,
  ayuda,
  filas = 4,
}: CampoAreaProps) {
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-dim">
        {etiqueta}
      </label>
      <textarea
        id={id}
        rows={filas}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [ayuda && idAyuda, error && idError].filter(Boolean).join(' ') ||
          undefined
        }
        className={CLASE_CONTROL}
        {...registro}
      />
      {ayuda && !error && (
        <p id={idAyuda} className="text-xs text-dim">
          {ayuda}
        </p>
      )}
      <MensajeError id={idError} error={error} />
    </div>
  );
}

export interface OpcionSelect {
  valor: string;
  texto: string;
}

interface CampoSelectProps {
  id: string;
  etiqueta: string;
  registro: UseFormRegisterReturn;
  opciones: readonly OpcionSelect[];
  error?: FieldError;
  ayuda?: string;
}

export function CampoSelect({
  id,
  etiqueta,
  registro,
  opciones,
  error,
  ayuda,
}: CampoSelectProps) {
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-dim">
        {etiqueta}
      </label>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [ayuda && idAyuda, error && idError].filter(Boolean).join(' ') ||
          undefined
        }
        className={CLASE_CONTROL}
        {...registro}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {ayuda && !error && (
        <p id={idAyuda} className="text-xs text-dim">
          {ayuda}
        </p>
      )}
      <MensajeError id={idError} error={error} />
    </div>
  );
}

interface CampoCasillaProps {
  id: string;
  etiqueta: string;
  registro: UseFormRegisterReturn;
  descripcion?: string;
  /** Usa `role="switch"` para interruptores de encendido y apagado. */
  interruptor?: boolean;
}

export function CampoCasilla({
  id,
  etiqueta,
  registro,
  descripcion,
  interruptor = false,
}: CampoCasillaProps) {
  const idAyuda = `${id}-ayuda`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        role={interruptor ? 'switch' : undefined}
        aria-describedby={descripcion ? idAyuda : undefined}
        className="mt-1 h-5 w-5 shrink-0 accent-brand"
        {...registro}
      />
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-semibold text-content">
          {etiqueta}
        </label>
        {descripcion && (
          <p id={idAyuda} className="text-xs text-dim">
            {descripcion}
          </p>
        )}
      </div>
    </div>
  );
}
