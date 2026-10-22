'use client';

import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as yup from 'yup';
import { Branch, BranchSettings } from '@odin6/types';
import { Button, Input, Label, SelectCustom, Textarea } from '@/shared';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { useToast } from '@/shared/hooks/useToast';
import { useBranch } from '@/shared/hooks/useBranch';
import {
  FiDollarSign,
  FiGlobe,
  FiMapPin,
  FiPhone,
  FiSave,
} from 'react-icons/fi';
import { FaBuilding } from 'react-icons/fa';

interface BranchFormValues {
  name: string;
  description?: string;
  address: string;
  city: string;
  country: string;
  phone?: string;
  email?: string;
  isDefault?: boolean;
  currency: string;
  language: string;
  timezone: string;
  taxRate: number;
  enableTips?: boolean;
  defaultTipPercentage?: number;
}

// Schema simple y directo
const branchSchema: yup.ObjectSchema<BranchFormValues> = yup.object({
  name: yup.string().required('El nombre de la sucursal es obligatorio'),
  description: yup.string().optional(),
  address: yup.string().required('La dirección es obligatoria'),
  city: yup.string().required('La ciudad es obligatoria'),
  country: yup.string().required('El país es obligatorio'),
  phone: yup.string().optional(),
  email: yup.string().email('Email inválido').optional(),
  isDefault: yup.boolean().optional(),
  // Settings básicos
  currency: yup.string().required('La moneda es obligatoria'),
  language: yup.string().required('El idioma es obligatorio'),
  timezone: yup.string().required('La zona horaria es obligatoria'),
  taxRate: yup
    .number()
    .min(0)
    .max(100)
    .required('La tasa de impuesto es obligatoria'),
  enableTips: yup.boolean().optional(),
  defaultTipPercentage: yup
    .number()
    .min(0)
    .max(100)
    .when('enableTips', {
      is: true,
      then: (schema) =>
        schema.required('El porcentaje de propina es obligatorio'),
      otherwise: (schema) => schema.optional(),
    })
    .optional(),
});

// Opciones simples
const countryOptions = [
  { value: 'VE', label: 'Venezuela' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'CO', label: 'Colombia' },
  { value: 'PE', label: 'Perú' },
  { value: 'MX', label: 'México' },
];

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

interface BranchFormProps {
  initialData?: Branch | null;
  isNew?: boolean;
}

export function BranchForm({
  initialData = null,
  isNew = false,
}: BranchFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createBranch } = useBranch();
  const toast = useToast();
  const { data: session } = useSession();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<BranchFormValues>({
    resolver: yupResolver(branchSchema),
    defaultValues: {
      name: '',
      description: '',
      address: '',
      city: '',
      country: 'VE',
      phone: '',
      email: '',
      isDefault: false,
      currency: 'USD',
      language: 'es',
      timezone: 'America/Caracas',
      taxRate: 16,
      enableTips: true,
      defaultTipPercentage: 10,
    },
  });

  const enableTips = watch('enableTips');

  // Cargar datos iniciales
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        description: initialData.description || '',
        address: initialData.location?.address || '',
        city: initialData.city,
        country: initialData.country,
        phone: initialData.phone || '',
        email: initialData.email || '',
        isDefault: initialData.isDefault || false,
        currency: initialData.settings?.currency || 'USD',
        language: initialData.settings?.language || 'es',
        timezone: initialData.settings?.timezone || 'America/Caracas',
        taxRate: initialData.settings?.taxRate || 16,
        enableTips: initialData.settings?.enableTips ?? true,
        defaultTipPercentage: initialData.settings?.defaultTipPercentage || 10,
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: BranchFormValues) => {
    setIsSubmitting(true);
    try {
      if (isNew) {
        const branchData: Omit<Branch, 'id'> = {
          organizationId: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: session?.user?.id || '',
          name: data.name,
          description: data.description || '',
          phone: data.phone || '',
          email: data.email || '',
          country: data.country,
          city: data.city,
          location: { address: data.address },
          isDefault: data.isDefault || false,
          isActive: true,
          settings: {
            currency: data.currency,
            language: data.language,
            timezone: data.timezone,
            dateFormat: 'DD/MM/YYYY',
            taxRate: data.taxRate,
            enableTips: data.enableTips || false,
            defaultTipPercentage: data.enableTips
              ? data.defaultTipPercentage || 0
              : 0,
            tipEnabled: data.enableTips || false,
            tipSuggestions: [10, 15, 20],
            serviceChargeEnabled: false,
            serviceChargeRate: 0,
            businessHours: {
              monday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
              tuesday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
              wednesday: {
                isOpen: true,
                openTime: '08:00',
                closeTime: '22:00',
              },
              thursday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
              friday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
              saturday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
              sunday: { isOpen: true, openTime: '10:00', closeTime: '20:00' },
            },
            paymentMethods: {
              cash: true,
              card: true,
              digitalWallet: true,
              bankTransfer: true,
            },
            receiptSettings: {
              showLogo: true,
              showTaxNumber: true,
              footerMessage: 'Gracias por su compra',
              autoprint: false,
            },
            notifications: {
              lowStock: true,
              newOrders: true,
              dailyReports: false,
              systemAlerts: true,
            },
          } as BranchSettings,
        };

        await createBranch(branchData);
        toast.success({
          title: 'Sucursal creada',
          description: `La sucursal "${data.name}" se ha creado correctamente`,
        });
      } else {
        // TODO: Implementar edición
        toast.info({
          title: 'Funcionalidad pendiente',
          description:
            'La edición de sucursales estará disponible próximamente',
        });
      }
      router.push(PRIVATE_ROUTES.SETTINGS_BRANCHES);
    } catch (_error) {
      toast.error({
        title: 'Error',
        description: 'No se pudo procesar la solicitud. Inténtalo de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="space-y-6 bg-surface p-6 rounded-lg shadow-md"
      >
        <div className="flex items-center mb-6">
          <FaBuilding className="text-2xl text-brand mr-2" />
          <h2 className="text-xl font-semibold text-content">
            {isNew ? 'Nueva Sucursal' : 'Editar Sucursal'}
          </h2>
        </div>

        {/* Información Básica */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Label htmlFor="name">Nombre de la Sucursal *</Label>
            <Input
              type="text"
              placeholder="Sucursal Principal"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-danger mt-1">{errors.name.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              placeholder="Descripción opcional"
              {...register('description')}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefault"
              {...register('isDefault')}
              className="w-4 h-4 text-brand rounded focus:ring-brand"
            />
            <Label htmlFor="isDefault" className="text-sm">
              Establecer como sucursal por defecto
            </Label>
          </div>
        </div>

        {/* Ubicación */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <FiMapPin className="text-lg text-dim mr-2" />
            <h3 className="text-lg font-medium text-content">Ubicación</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Label htmlFor="address">Dirección *</Label>
              <Input
                type="text"
                placeholder="Av. Principal, Edificio Torre, Local 1"
                {...register('address')}
              />
              {errors.address && (
                <p className="text-sm text-danger mt-1">
                  {errors.address.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="city">Ciudad *</Label>
              <Input type="text" placeholder="Caracas" {...register('city')} />
              {errors.city && (
                <p className="text-sm text-danger mt-1">
                  {errors.city.message}
                </p>
              )}
            </div>

            <SelectCustom
              id="country"
              label="País *"
              options={countryOptions}
              register={register}
              name="country"
              error={errors.country}
              placeholder="Seleccionar país"
            />
          </div>
        </div>

        {/* Contacto */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <FiPhone className="text-lg text-dim mr-2" />
            <h3 className="text-lg font-medium text-content">
              Información de Contacto
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                type="tel"
                placeholder="+58 212 555-0123"
                {...register('phone')}
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                placeholder="sucursal@empresa.com"
                {...register('email')}
              />
            </div>
          </div>
        </div>

        {/* Configuración */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <FiGlobe className="text-lg text-dim mr-2" />
            <h3 className="text-lg font-medium text-content">Configuración</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SelectCustom
              id="currency"
              label="Moneda *"
              options={currencyOptions}
              register={register}
              name="currency"
              error={errors.currency}
              placeholder="Seleccionar moneda"
            />

            <SelectCustom
              id="language"
              label="Idioma *"
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
                  Habilitar propinas
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
            onClick={() => router.push(PRIVATE_ROUTES.SETTINGS_BRANCHES)}
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
            {isNew ? 'Crear Sucursal' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
