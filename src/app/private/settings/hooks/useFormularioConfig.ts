'use client';

import { useEffect, type BaseSyntheticEvent } from 'react';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { CONFIG_DEFAULTS, type ConfigId, type ConfigMap } from '@odin6/types';
import {
  useConfigDoc,
  useGuardarConfig,
  type DeepPartial,
} from '@/shared/config';
import { useToast } from '@/shared/hooks/useToast';
import { useAcceso } from './useAcceso';
import { useSalidaConfirmada } from './useSalidaConfirmada';
import { listaErrores } from '../lib/errores';
import { mensajeDeError } from '../lib/mensajes';

type EsquemaYup = Parameters<typeof yupResolver>[0];

/** Todo lo que necesita una pantalla de Ajustes para pintarse y guardar. */
export interface VistaFormulario<F extends FieldValues> {
  form: UseFormReturn<F>;
  onSubmit: (e?: BaseSyntheticEvent) => Promise<void>;
  descartar: () => void;
  cargando: boolean;
  errorCarga: boolean;
  guardando: boolean;
  guardado: boolean;
  sucio: boolean;
  puedeVer: boolean;
  puedeEditar: boolean;
  errores: string[];
}

interface Opciones<K extends ConfigId, F extends FieldValues> {
  id: K;
  /** Nombre de la sección para los avisos ("Negocio guardado."). */
  nombre: string;
  esquema: EsquemaYup;
  aFormulario: (valor: ConfigMap[K]) => F;
  aValor: (formulario: F) => DeepPartial<ConfigMap[K]>;
}

/**
 * Carga un documento de `configs`, lo lleva a un formulario de React Hook Form, valida con
 * Yup y guarda solo lo que cambió (el PATCH es parcial). Un refetch en segundo plano no
 * pisa lo que el dueño está escribiendo: solo reemplaza el formulario si está limpio.
 */
export function useFormularioConfig<K extends ConfigId, F extends FieldValues>({
  id,
  nombre,
  esquema,
  aFormulario,
  aValor,
}: Opciones<K, F>): VistaFormulario<F> {
  const { puedeVer, puedeEditar, cargandoSesion } = useAcceso();
  const toast = useToast();
  const consulta = useConfigDoc(id);
  const guardar = useGuardarConfig(id);

  const form: UseFormReturn<F> = useForm<F>({
    resolver: yupResolver(esquema) as Resolver<F>,
    defaultValues: aFormulario(CONFIG_DEFAULTS[id]) as DefaultValues<F>,
  });

  const { isDirty } = form.formState;
  useSalidaConfirmada(isDirty);

  const valorServidor = consulta.data?.valor;
  useEffect(() => {
    if (valorServidor && !form.formState.isDirty) {
      form.reset(aFormulario(valorServidor));
    }
  }, [valorServidor, form, aFormulario]);

  const onSubmit = form.handleSubmit(async (formulario) => {
    try {
      const guardado = await guardar.mutateAsync(aValor(formulario));
      form.reset(aFormulario(guardado.valor));
      toast.success({
        title: 'Guardado',
        description: `${nombre} actualizado.`,
      });
    } catch (error: unknown) {
      toast.error({
        title: 'No se pudo guardar',
        description: mensajeDeError(error),
      });
    }
  });

  const descartar = () => {
    form.reset(aFormulario(valorServidor ?? CONFIG_DEFAULTS[id]));
  };

  return {
    form,
    onSubmit,
    descartar,
    cargando: consulta.isPending || cargandoSesion,
    errorCarga: consulta.isError,
    guardando: guardar.isPending,
    guardado: guardar.isSuccess && !isDirty,
    sucio: isDirty,
    puedeVer,
    puedeEditar,
    errores: listaErrores(form.formState.errors),
  };
}
