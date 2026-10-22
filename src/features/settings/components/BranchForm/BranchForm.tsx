import React from 'react';
import { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Building2, MapPin, Phone } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  SelectCustom,
  Textarea,
} from '@/shared';
import {
  BranchFormData,
  countryOptions,
  NewBranchFormData,
} from '@/features/settings';

// Extract branch fields from NewBranchFormData using Pick utility type
type BranchFields = Pick<NewBranchFormData, keyof BranchFormData>;

interface BranchFormProps<T extends BranchFields = BranchFormData> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  showDefaultOption?: boolean;
}

export default function BranchForm({
  register,
  errors,
  showDefaultOption = true,
}: BranchFormProps) {
  return (
    <>
      {/* Basic Information */}
      <Card className="border-0 bg-surface/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-brand to-brand rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            Información Básica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Sucursal *</Label>
              <Input
                type="text"
                placeholder="Sucursal Principal"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-danger">{errors.name.message}</p>
              )}
            </div>

            {showDefaultOption && (
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="isDefault"
                  {...register('isDefault')}
                  className="w-4 h-4 text-brand bg-elevated border-line rounded focus:ring-brand focus:ring-2"
                />
                <Label
                  htmlFor="isDefault"
                  className="text-sm font-medium text-content"
                >
                  Establecer como sucursal por defecto
                </Label>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              placeholder="Descripción opcional de la sucursal"
              {...register('description')}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-danger">
                {errors.description.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Information */}
      <Card className="border-0 bg-surface/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-brand to-brand rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            Ubicación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="address">Dirección *</Label>
            <Input
              type="text"
              placeholder="Av. Principal, Edificio Torre, Local 1"
              {...register('address')}
            />
            {errors.address && (
              <p className="text-sm text-danger">{errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad *</Label>
              <Input type="text" placeholder="Caracas" {...register('city')} />
              {errors.city && (
                <p className="text-sm text-danger">{errors.city.message}</p>
              )}
            </div>

            <SelectCustom
              id="country"
              label="País"
              options={countryOptions}
              register={register}
              name="country"
              error={errors.country}
              required
              placeholder="Seleccionar país"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="border-0 bg-surface/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-ok to-ok rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            Información de Contacto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                type="tel"
                placeholder="+58 212 555-0123"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-sm text-danger">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                placeholder="sucursal@miempresa.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-danger">{errors.email.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
