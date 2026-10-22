'use client';

import { useState, type ChangeEvent, type CSSProperties } from 'react';
import type {
  FieldError,
  UseFormRegisterReturn,
  UseFormReturn,
} from 'react-hook-form';
import {
  PALETA_CLARA_DEFAULT,
  PALETA_OSCURA_DEFAULT,
  PALETA_CLAVES,
  type PaletaTokens,
} from '@odin6/types';
import { Button } from '@/shared';
import { uploadFile } from '@/services/uploads/uploadImage';
import { PantallaSeccion } from '../components/PantallaSeccion';
import { CampoSelect, CampoTexto, Grupo } from '../components/Campos';
import { useFormularioConfig } from '../hooks/useFormularioConfig';
import { revisarContraste } from '../lib/contraste';
import { variablesCss } from '../lib/tokensCss';
import { ETIQUETAS_PALETA } from './etiquetasPaleta';
import {
  aFormulario,
  aValor,
  marcaEsquema,
  type MarcaFormulario,
} from './marcaFormulario';

const TEMAS = [
  { valor: 'system', texto: 'Según el dispositivo de cada persona' },
  { valor: 'light', texto: 'Claro' },
  { valor: 'dark', texto: 'Oscuro' },
];

const TAMANO_MAXIMO_MB = 20;

export function MarcaForm() {
  const vista = useFormularioConfig({
    id: 'marca',
    nombre: 'Marca',
    esquema: marcaEsquema,
    aFormulario,
    aValor,
  });
  const { form } = vista;
  const { register, setValue, watch, formState } = form;
  const { errors } = formState;
  const claro = watch('claro');
  const oscuro = watch('oscuro');
  const logos = {
    claro: watch('logoLightUrl'),
    oscuro: watch('logoDarkUrl'),
    icono: watch('iconUrl'),
  };

  const restablecerColores = () => {
    setValue(
      'claro',
      { ...PALETA_CLARA_DEFAULT },
      { shouldDirty: true, shouldValidate: true },
    );
    setValue(
      'oscuro',
      { ...PALETA_OSCURA_DEFAULT },
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <PantallaSeccion
      titulo="Marca"
      descripcion="Cómo se ve y cómo se llama la aplicación para su negocio."
      vista={vista}
    >
      <Grupo titulo="Nombre y logos">
        <CampoTexto
          id="appName"
          etiqueta="Nombre de la aplicación"
          registro={register('appName')}
          error={errors.appName}
          ayuda="Si lo deja vacío se usa el nombre comercial. Si tampoco hay, aparece «Punto de venta»."
        />
        <CampoImagen
          id="logoLightUrl"
          etiqueta="Logo para fondo claro"
          ayuda="Se muestra sobre las pantallas claras."
          registro={register('logoLightUrl')}
          error={errors.logoLightUrl}
          valor={logos.claro}
          onCambio={(url) =>
            setValue('logoLightUrl', url, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        <CampoImagen
          id="logoDarkUrl"
          etiqueta="Logo para fondo oscuro"
          ayuda="Se muestra sobre las pantallas oscuras."
          registro={register('logoDarkUrl')}
          error={errors.logoDarkUrl}
          valor={logos.oscuro}
          onCambio={(url) =>
            setValue('logoDarkUrl', url, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        <CampoImagen
          id="iconUrl"
          etiqueta="Ícono cuadrado"
          ayuda="Para la pestaña del navegador y la pantalla de inicio del celular."
          registro={register('iconUrl')}
          error={errors.iconUrl}
          valor={logos.icono}
          onCambio={(url) =>
            setValue('iconUrl', url, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
      </Grupo>

      <Grupo titulo="Tema">
        <CampoSelect
          id="defaultTheme"
          etiqueta="Tema por defecto"
          registro={register('defaultTheme')}
          opciones={TEMAS.map((t) => ({ valor: t.valor, texto: t.texto }))}
          error={errors.defaultTheme}
          ayuda="Lo ve cada persona que todavía no eligió un tema para sí misma."
        />
      </Grupo>

      <Grupo
        titulo="Colores"
        descripcion="Cada color pinta una parte de la pantalla. La vista previa se actualiza mientras escribe; el resto de la aplicación no cambia hasta guardar."
      >
        <div className="flex flex-wrap justify-end">
          <Button type="button" variant="outline" onClick={restablecerColores}>
            Restablecer colores
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-semibold text-content">Pantalla clara</h3>
            <EditorPaleta form={form} prefijo="claro" valores={claro} />
            <AvisoContraste titulo="pantalla clara" paleta={claro} />
            <VistaPreviaPaleta
              titulo="Vista previa: pantalla clara"
              paleta={claro}
            />
          </div>
          <div className="space-y-4">
            <h3 className="font-semibold text-content">Pantalla oscura</h3>
            <EditorPaleta form={form} prefijo="oscuro" valores={oscuro} />
            <AvisoContraste titulo="pantalla oscura" paleta={oscuro} />
            <VistaPreviaPaleta
              titulo="Vista previa: pantalla oscura"
              paleta={oscuro}
            />
          </div>
        </div>
      </Grupo>
    </PantallaSeccion>
  );
}

interface CampoImagenProps {
  id: string;
  etiqueta: string;
  ayuda: string;
  registro: UseFormRegisterReturn;
  error?: FieldError;
  valor: string;
  onCambio: (url: string) => void;
}

/** URL del logo + subida del archivo. La subida rellena la misma URL. */
function CampoImagen({
  id,
  etiqueta,
  ayuda,
  registro,
  error,
  valor,
  onCambio,
}: CampoImagenProps) {
  const [subiendo, setSubiendo] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  const alElegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setProblema(
        `La imagen supera ${TAMANO_MAXIMO_MB} MB. Use una más liviana.`,
      );
      return;
    }
    setSubiendo(true);
    setProblema(null);
    try {
      onCambio(await uploadFile(archivo, 'generic/marca'));
    } catch {
      setProblema(
        'No se pudo subir la imagen. Pruebe con PNG, JPG o WEBP, o intente más tarde.',
      );
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="space-y-2">
      <CampoTexto
        id={id}
        etiqueta={etiqueta}
        registro={registro}
        error={error}
        ayuda={ayuda}
        type="url"
        placeholder="https://… o /ruta"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand px-4 py-2 text-sm font-semibold text-brand focus-within:ring-2 focus-within:ring-brand hover:bg-brand/5">
          {subiendo ? 'Subiendo…' : 'Subir imagen'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={alElegir}
            disabled={subiendo}
            className="sr-only"
            aria-label={`Subir imagen para ${etiqueta.toLowerCase()}`}
          />
        </label>
        {valor && (
          // Vista previa decorativa: el nombre accesible lo da la etiqueta del campo.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={valor}
            alt=""
            className="h-12 w-auto rounded-lg border border-line bg-surface p-1"
          />
        )}
      </div>
      {problema && (
        <p role="alert" className="text-sm text-danger">
          {problema}
        </p>
      )}
    </div>
  );
}

interface EditorPaletaProps {
  form: UseFormReturn<MarcaFormulario>;
  prefijo: 'claro' | 'oscuro';
  valores: PaletaTokens;
}

function EditorPaleta({ form, prefijo, valores }: EditorPaletaProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PALETA_CLAVES.map((clave) => (
        <FilaColor
          key={`${prefijo}-${clave}`}
          form={form}
          prefijo={prefijo}
          clave={clave}
          valor={valores[clave]}
        />
      ))}
    </div>
  );
}

interface FilaColorProps {
  form: UseFormReturn<MarcaFormulario>;
  prefijo: 'claro' | 'oscuro';
  clave: (typeof PALETA_CLAVES)[number];
  valor: string;
}

function FilaColor({ form, prefijo, clave, valor }: FilaColorProps) {
  const nombre = `${prefijo}.${clave}` as const;
  const id = `color-${prefijo}-${clave}`;
  const etiqueta = ETIQUETAS_PALETA[clave];
  const error = form.formState.errors[prefijo]?.[clave];
  const idError = `${id}-error`;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={
            /^#[0-9a-fA-F]{6}$/.test(valor) ? valor.toLowerCase() : '#000000'
          }
          onChange={(e) =>
            form.setValue(nombre, e.target.value.toUpperCase(), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          aria-label={`${etiqueta}: elegir color`}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-sm font-semibold text-dim">
            {etiqueta}
          </label>
          <input
            id={id}
            type="text"
            maxLength={7}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? idError : undefined}
            className="w-full rounded-lg border border-line bg-elevated/50 px-2 py-1 font-mono text-sm uppercase text-content focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...form.register(nombre)}
          />
        </div>
      </div>
      {error?.message && (
        <p id={idError} className="text-xs text-danger">
          {error.message}
        </p>
      )}
    </div>
  );
}

/** Pares de texto que no llegan a AA 4.5:1. Se anuncia cada cambio, no se bloquea el guardado. */
function AvisoContraste({
  titulo,
  paleta,
}: {
  titulo: string;
  paleta: PaletaTokens;
}) {
  const fallos = revisarContraste(paleta).filter((r) => !r.cumple);
  if (fallos.length === 0) {
    return (
      <p role="status" aria-live="polite" className="text-sm text-success">
        Todos los textos de la {titulo} llegan al contraste mínimo (AA).
      </p>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-1 rounded-xl border border-warning bg-surface p-3"
    >
      <p className="text-sm font-semibold text-warning">
        Estos textos de la {titulo} se leen mal (se piden 4,5 a 1 como mínimo):
      </p>
      <ul className="list-disc pl-5 text-sm text-content">
        {fallos.map((f) => (
          <li key={`${f.texto}-${f.fondo}`}>
            {f.descripcion}:{' '}
            {f.razon === null
              ? 'color no válido'
              : `${String(f.razon).replace('.', ',')} a 1`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Mini pantalla con los tokens aplicados solo dentro de este contenedor (variables CSS
 * locales). Usa las mismas clases del design system que el resto de la app.
 */
function VistaPreviaPaleta({
  titulo,
  paleta,
}: {
  titulo: string;
  paleta: PaletaTokens;
}) {
  return (
    <section
      aria-label={titulo}
      style={variablesCss(paleta) as CSSProperties}
      className="space-y-3 rounded-2xl border border-line bg-page p-4"
    >
      <p className="text-xs uppercase tracking-wide text-dim">Vista previa</p>
      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h4 className="font-semibold text-content">Tarjeta de ejemplo</h4>
        <p className="text-sm text-dim">Texto secundario de apoyo.</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-on-brand">
            Botón principal
          </span>
          <span className="inline-flex rounded-lg border border-accent px-3 py-1.5 text-sm font-semibold text-accent">
            Acento
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-dim">
              <th className="py-1 font-semibold">Producto</th>
              <th className="py-1 text-right font-semibold">Precio</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line text-content">
              <td className="py-1">Plato del día</td>
              <td className="py-1 text-right">$8,00</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm text-success">Mensaje de éxito.</p>
        <p className="text-sm text-danger">Mensaje de error.</p>
        <p className="text-sm text-warning">Aviso.</p>
      </div>
    </section>
  );
}
