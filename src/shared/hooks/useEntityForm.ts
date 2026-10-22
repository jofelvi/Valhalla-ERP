'use client';

import {
  useForm,
  FieldValues,
  UseFormReturn,
  DefaultValues,
  Resolver,
} from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { AnyObjectSchema } from 'yup';

/**
 * Opciones para el hook useEntityForm.
 * @template TForm - Tipo del formulario (debe extender FieldValues)
 */
interface UseEntityFormOptions<TForm extends FieldValues> {
  /** Schema de validación Yup */
  schema: AnyObjectSchema;
  /** Valores por defecto del formulario */
  defaultValues: DefaultValues<TForm>;
  /** Datos iniciales para edición (null o undefined = modo crear) */
  initialData?: DefaultValues<TForm> | null;
  /** Callback para crear entidad */
  onCreate: (data: TForm) => Promise<void>;
  /** Callback para actualizar entidad */
  onUpdate: (data: TForm) => Promise<void>;
}

/**
 * Retorno del hook useEntityForm.
 * @template TForm - Tipo del formulario
 */
interface UseEntityFormReturn<TForm extends FieldValues> {
  /** Instancia de useForm configurada con el schema y valores por defecto */
  form: UseFormReturn<TForm>;
  /** Indica si el formulario se está enviando */
  isSubmitting: boolean;
  /** Error del servidor durante el envío */
  serverError: string | null;
  /** Handler de submit que maneja la bifurcación create/update */
  handleFormSubmit: (data: TForm) => Promise<void>;
}

/**
 * Hook reutilizable para formularios CRUD con React Hook Form + Yup.
 *
 * Encapsula:
 * - Setup de useForm con validación Yup
 * - Reset automático cuando cambia initialData
 * - Bifurcación entre create/update en el submit
 * - Manejo básico de errores del servidor
 *
 * @template TForm - Tipo del formulario
 * @param options - Opciones del hook
 * @returns Objeto con form, isSubmitting, serverError y handleFormSubmit
 */
export function useEntityForm<TForm extends FieldValues>({
  schema,
  defaultValues,
  initialData = null,
  onCreate,
  onUpdate,
}: UseEntityFormOptions<TForm>): UseEntityFormReturn<TForm> {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<TForm>({
    resolver: yupResolver(schema) as Resolver<TForm>,
    defaultValues,
  });

  const { reset } = form;

  // Reset automático cuando cambia initialData
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  // Wrapper del submit que maneja la bifurcación create/update
  const handleFormSubmit = async (data: TForm): Promise<void> => {
    try {
      setServerError(null);
      if (initialData) {
        await onUpdate(data);
      } else {
        await onCreate(data);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      setServerError(message);
      throw error;
    }
  };

  return {
    form,
    isSubmitting: form.formState.isSubmitting,
    serverError,
    handleFormSubmit,
  };
}
