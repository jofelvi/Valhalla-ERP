'use client';
import { ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeftIcon,
  SaveIcon,
  CameraIcon,
  XIcon,
  UserIcon,
  BriefcaseIcon,
  ContactIcon,
  CreditCardIcon,
  ClipboardIcon,
  HeartPulseIcon,
  DropletIcon,
} from 'lucide-react';
import {
  EmployeeFormValues,
  employeeSchema,
} from '@/shared/schemas/employeeSchema';
import { Employee } from '@odin6/types';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

interface EmployeeFormProps {
  mode: 'create' | 'edit';
  initialData?: Employee;
  loading: boolean;
  error: string | null;
  onSubmitAction: (data: EmployeeFormValues) => void;
  onBackAction: () => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function EmployeeForm({
  mode,
  initialData,
  loading,
  error,
  onSubmitAction,
  onBackAction,
  imageFile,
  setImageFile,
  imagePreview,
  setImagePreview,
}: EmployeeFormProps) {
  void imageFile;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: yupResolver(employeeSchema),
    defaultValues: initialData
      ? {
          firstName: initialData.firstName,
          lastName: initialData.lastName,
          email: initialData.email,
          phone: initialData.phone,
          address: initialData.address,
          position: initialData.position,
          department: initialData.department,
          hireDate: initialData.hireDate,
          salary: initialData.salary,
          isActive: initialData.isActive,
          pin: initialData.pin || null,
          emergencyContact: initialData.emergencyContact,
          bankAccount: initialData.bankAccount || {
            accountNumber: null,
            bankName: null,
            accountType: null,
          },
          photoUrl: initialData.photoUrl || null,
          observations: initialData.observations || null,
          medicalInfo: initialData.medicalInfo || {
            bloodType: null,
            allergies: null,
            conditions: null,
            notes: null,
          },
        }
      : {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          address: '',
          position: '',
          department: '',
          hireDate: new Date(),
          salary: 0,
          isActive: true,
          pin: null,
          emergencyContact: {
            name: '',
            phone: '',
            relationship: '',
          },
          bankAccount: {
            accountNumber: null,
            bankName: null,
            accountType: null,
          },
          photoUrl: null,
          observations: null,
          medicalInfo: {
            bloodType: null,
            allergies: null,
            conditions: null,
            notes: null,
          },
        },
  });

  const isActive = watch('isActive');
  const bloodType = watch('medicalInfo.bloodType');
  const firstName = watch('firstName');
  const lastName = watch('lastName');

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setValue('photoUrl', null);
  };

  const formatDateForInput = (date: Date | string | undefined): string => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBackAction}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold text-content">
            {mode === 'create'
              ? 'Nuevo Empleado'
              : `Editar: ${initialData?.firstName} ${initialData?.lastName}`}
          </h1>
        </div>
        {mode === 'edit' && (
          <div className="flex items-center space-x-2">
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue('isActive', checked)}
              label="Activo"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
          <p className="text-danger text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmitAction)} className="space-y-6">
        {/* Foto + Datos personales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-brand" />
              Datos Personales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Foto avatar */}
            <div className="flex items-center gap-6 p-4 bg-gradient-to-r from-page/50 to-elevated/50 rounded-xl border border-line">
              <div className="relative shrink-0">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Foto del empleado"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-1 -right-1 bg-danger text-on-brand rounded-full p-1 hover:bg-danger/90 transition-all shadow-sm hover:shadow-md"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-surface flex items-center justify-center border-4 border-white shadow-md">
                    {firstName && lastName ? (
                      <span className="text-2xl font-bold text-dim">
                        {getInitials(firstName, lastName)}
                      </span>
                    ) : (
                      <CameraIcon className="h-8 w-8 text-brand/70" />
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="employeePhoto"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                    bg-surface border border-line text-dim
                    hover:bg-elevated hover:border-line transition-all shadow-sm hover:shadow-md"
                >
                  <CameraIcon className="h-4 w-4" />
                  {imagePreview ? 'Cambiar foto' : 'Subir foto'}
                </label>
                <input
                  id="employeePhoto"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <p className="text-xs text-brand/70">JPG, PNG. Max 5MB</p>
              </div>
            </div>

            <Separator />

            {/* Nombre y Apellido */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                required
                {...register('firstName')}
                placeholder="Ingrese el nombre"
                error={errors.firstName}
              />
              <Input
                label="Apellido"
                required
                {...register('lastName')}
                placeholder="Ingrese el apellido"
                error={errors.lastName}
              />
            </div>

            {/* Email y Telefono */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                required
                type="email"
                {...register('email')}
                placeholder="ejemplo@email.com"
                error={errors.email}
              />
              <Input
                label="Telefono"
                required
                {...register('phone')}
                placeholder="0412-1234567"
                error={errors.phone}
              />
            </div>

            {/* Direccion */}
            <div>
              <Label htmlFor="address">Direccion *</Label>
              <Textarea
                {...register('address')}
                placeholder="Ingrese la direccion completa"
                className={errors.address ? 'border-danger/40' : ''}
              />
              {errors.address && (
                <p className="text-danger text-xs mt-1">
                  {errors.address.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Informacion Laboral */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BriefcaseIcon className="h-5 w-5 text-brand" />
              Informacion Laboral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Cargo"
                required
                {...register('position')}
                placeholder="Ej: Cajero, Mesero, Chef"
                error={errors.position}
              />
              <Input
                label="Departamento"
                required
                {...register('department')}
                placeholder="Ej: Ventas, Cocina"
                error={errors.department}
              />
              <Input
                label="Salario (USD)"
                required
                type="number"
                {...register('salary', { valueAsNumber: true })}
                placeholder="0.00"
                error={errors.salary}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Fecha de Contratacion"
                required
                type="date"
                {...register('hireDate', {
                  setValueAs: (value) => (value ? new Date(value) : undefined),
                })}
                defaultValue={formatDateForInput(initialData?.hireDate)}
                error={errors.hireDate}
              />
              <div>
                <Input
                  label="PIN de Asistencia"
                  type="password"
                  {...register('pin')}
                  placeholder="4 digitos (opcional)"
                  maxLength={4}
                  error={errors.pin}
                />
                <p className="text-xs text-brand/70 mt-1">
                  PIN de 4 digitos para registro de asistencia
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacto de Emergencia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ContactIcon className="h-5 w-5 text-brand" />
              Contacto de Emergencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Nombre"
                required
                {...register('emergencyContact.name')}
                placeholder="Nombre completo"
                error={errors.emergencyContact?.name}
              />
              <Input
                label="Telefono"
                required
                {...register('emergencyContact.phone')}
                placeholder="0412-1234567"
                error={errors.emergencyContact?.phone}
              />
              <Input
                label="Relacion"
                required
                {...register('emergencyContact.relationship')}
                placeholder="Ej: Padre, Madre, Esposo/a"
                error={errors.emergencyContact?.relationship}
              />
            </div>
          </CardContent>
        </Card>

        {/* Informacion Bancaria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-brand" />
              Informacion Bancaria
              <span className="text-sm font-normal text-brand/60 ml-1">
                (Opcional)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Numero de Cuenta"
                {...register('bankAccount.accountNumber')}
                placeholder="0123456789"
              />
              <Input
                label="Banco"
                {...register('bankAccount.bankName')}
                placeholder="Ej: Banesco, Mercantil"
              />
              <Input
                label="Tipo de Cuenta"
                {...register('bankAccount.accountType')}
                placeholder="Ej: Corriente, Ahorro"
              />
            </div>
          </CardContent>
        </Card>

        {/* Observaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardIcon className="h-5 w-5 text-brand" />
              Observaciones
              <span className="text-sm font-normal text-brand/60 ml-1">
                (Opcional)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register('observations')}
              placeholder="Notas sobre el empleado, horario preferido, disponibilidad, etc."
              rows={3}
              className={errors.observations ? 'border-danger/40' : ''}
            />
            {errors.observations && (
              <p className="text-danger text-xs mt-1">
                {errors.observations.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Informacion Medica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulseIcon className="h-5 w-5 text-brand" />
              Informacion Medica
              <span className="text-sm font-normal text-brand/60 ml-1">
                (Opcional)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Grupo sanguineo */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <DropletIcon className="h-3.5 w-3.5" />
                  Grupo Sanguineo
                </Label>
                <Select
                  value={bloodType ?? ''}
                  onValueChange={(value) =>
                    setValue('medicalInfo.bloodType', value || null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notas medicas */}
              <div>
                <Label>Notas medicas</Label>
                <Textarea
                  {...register('medicalInfo.notes')}
                  placeholder="Notas medicas adicionales"
                  rows={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Alergias</Label>
                <Textarea
                  {...register('medicalInfo.allergies')}
                  placeholder="Ej: Penicilina, mariscos, latex..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Condiciones cronicas</Label>
                <Textarea
                  {...register('medicalInfo.conditions')}
                  placeholder="Ej: Diabetes, hipertension..."
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botones de accion */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBackAction}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 min-w-[160px] justify-center"
          >
            <SaveIcon className="h-4 w-4" />
            {loading
              ? 'Guardando...'
              : mode === 'create'
                ? 'Crear Empleado'
                : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
