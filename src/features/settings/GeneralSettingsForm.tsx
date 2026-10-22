'use client';

import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as yup from 'yup';
import { Button, Input, Label, SelectCustom } from '@/shared';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { useToast } from '@/shared/hooks/useToast';
import { useBranch } from '@/shared/hooks/useBranch';
import { FiDollarSign, FiGlobe, FiSave, FiSettings } from 'react-icons/fi';
import {
  transformBranchSettingsToFormData,
  transformGeneralSettingsFormData,
} from './utils/settingsTransformers';

const settingsSchema = yup.object({
  currency: yup.string().required('La moneda es obligatoria'),
  language: yup.string().required('El idioma es obligatorio'),
  timezone: yup.string().required('La zona horaria es obligatoria'),
  dateFormat: yup.string().required('El formato de fecha es obligatorio'),
  taxRate: yup
    .number()
    .min(0)
    .max(100)
    .required('La tasa de impuesto es obligatoria'),
  enableTips: yup.boolean().default(false),
  defaultTipPercentage: yup.number().min(0).max(100).default(0),
});

type SettingsFormValues = yup.InferType<typeof settingsSchema>;

const currencyOptions = [
  { value: 'USD', label: 'Dólar (USD)' },
  { value: 'VES', label: 'Bolívar (VES)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'COP', label: 'Peso Colombiano (COP)' },
];

const languageOptions = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

const timezoneOptions = [
  { value: 'America/Caracas', label: 'Venezuela (UTC-4)' },
  { value: 'America/New_York', label: 'Eastern Time (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8)' },
];

const dateFormatOptions = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

export function GeneralSettingsForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentBranch, currentBranchSettings, updateBranchSettings } =
    useBranch();
  const toast = useToast();

  // Debug logs
  console.log('=== GENERAL SETTINGS FORM RENDER ===');
  console.log('currentBranch:', currentBranch);
  console.log('currentBranchSettings:', currentBranchSettings);
  console.log('updateBranchSettings:', typeof updateBranchSettings);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: yupResolver(settingsSchema),
    defaultValues: {
      currency: 'USD',
      language: 'es',
      timezone: 'America/Caracas',
      dateFormat: 'DD/MM/YYYY',
      taxRate: 16,
      enableTips: true,
      defaultTipPercentage: 10,
    },
  });

  const enableTips = watch('enableTips');

  // Cargar configuración actual
  useEffect(() => {
    if (currentBranchSettings) {
      const formData = transformBranchSettingsToFormData(currentBranchSettings);
      reset(formData);
    }
  }, [currentBranchSettings, reset]);

  const handleFormSubmit = async (data: SettingsFormValues) => {
    console.log('=== FORM SUBMIT STARTED ===');
    console.log('Form data received:', data);
    console.log('Current branch:', currentBranch);
    console.log('updateBranchSettings function:', updateBranchSettings);

    if (!currentBranch) {
      console.log('No current branch found');
      toast.error({
        title: 'Error',
        description: 'No hay sucursal seleccionada',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Transforming form data...');
      const updatedSettings = transformGeneralSettingsFormData(data);
      console.log('Transformed settings:', updatedSettings);

      console.log('Calling updateBranchSettings...');
      await updateBranchSettings(updatedSettings);
      console.log('updateBranchSettings completed successfully');

      toast.success({
        title: 'Configuración guardada',
        description: 'Los ajustes se han actualizado correctamente',
      });
    } catch (error) {
      console.error('Error in handleFormSubmit:', error);
      toast.error({
        title: 'Error al guardar',
        description: 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
      console.log('=== FORM SUBMIT ENDED ===');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="space-y-6 bg-surface p-6 rounded-lg shadow-md"
      >
        <div className="flex items-center mb-6">
          <FiSettings className="text-2xl text-brand mr-2" />
          <div>
            <h2 className="text-xl font-semibold text-content">
              Configuración General
            </h2>
            <p className="text-dim">
              Ajustes para {currentBranch?.name || 'la sucursal actual'}
            </p>
          </div>
        </div>

        {/* Configuración Regional */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <FiGlobe className="text-lg text-dim mr-2" />
            <h3 className="text-lg font-medium text-content">
              Configuración Regional
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectCustom
              id="currency"
              label="Moneda Principal *"
              options={currencyOptions}
              register={register}
              name="currency"
              error={errors.currency}
              placeholder="Seleccionar moneda"
            />

            <SelectCustom
              id="language"
              label="Idioma del Sistema *"
              options={languageOptions}
              register={register}
              name="language"
              error={errors.language}
              placeholder="Seleccionar idioma"
            />

            <SelectCustom
              id="timezone"
              label="Zona Horaria *"
              options={timezoneOptions}
              register={register}
              name="timezone"
              error={errors.timezone}
              placeholder="Seleccionar zona horaria"
            />

            <SelectCustom
              id="dateFormat"
              label="Formato de Fecha *"
              options={dateFormatOptions}
              register={register}
              name="dateFormat"
              error={errors.dateFormat}
              placeholder="Seleccionar formato"
            />
          </div>
        </div>

        {/* Impuestos y Propinas */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <FiDollarSign className="text-lg text-dim mr-2" />
            <h3 className="text-lg font-medium text-content">
              Impuestos y Propinas
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="taxRate">Tasa de Impuesto (%) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="16.00"
                {...register('taxRate', { valueAsNumber: true })}
              />
              {errors.taxRate && (
                <p className="text-sm text-danger mt-1">
                  {errors.taxRate.message}
                </p>
              )}
              <p className="text-sm text-dim mt-1">
                Porcentaje de impuesto aplicado a los productos
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="enableTips"
                  {...register('enableTips')}
                  className="w-4 h-4 text-brand rounded focus:ring-brand"
                />
                <Label htmlFor="enableTips" className="text-sm">
                  Habilitar sistema de propinas
                </Label>
              </div>

              {enableTips && (
                <div>
                  <Label htmlFor="defaultTipPercentage">
                    Propina por defecto (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="10.00"
                    {...register('defaultTipPercentage', {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.defaultTipPercentage && (
                    <p className="text-sm text-danger mt-1">
                      {errors.defaultTipPercentage.message}
                    </p>
                  )}
                  <p className="text-sm text-dim mt-1">
                    Porcentaje sugerido por defecto
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(PRIVATE_ROUTES.SETTINGS)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            <FiSave className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
