'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateAttendanceData } from '@odin6/types';
import { useCreateAttendance } from '@/hooks/useAttendance';
import {
  AttendanceFormValues,
  attendanceSchema,
} from '@/shared/schemas/attendanceSchema';
import { AttendanceStatusEnum } from '@/shared';

interface AttendanceFormProps {
  employeeId: string;
  employeeName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: Partial<CreateAttendanceData>;
}

export default function AttendanceForm({
  employeeId,
  employeeName,
  onSuccess,
  onCancel,
  initialData,
}: AttendanceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createAttendance = useCreateAttendance();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AttendanceFormValues>({
    resolver: yupResolver(attendanceSchema),
    defaultValues: {
      employeeId,
      date: initialData?.date || new Date(),
      status: initialData?.status || AttendanceStatusEnum.PRESENT,
      notes: initialData?.notes || '',
      location: initialData?.location || undefined,
    },
  });

  const watchedStatus = watch('status');

  const onSubmit = async (data: AttendanceFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Calculate total hours if both check-in and check-out are provided
      let totalHours = 0;
      let overtimeHours = 0;

      if (data.checkIn && data.checkOut) {
        const checkInTime = new Date(data.checkIn);
        const checkOutTime = new Date(data.checkOut);
        totalHours =
          (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        // Calculate break time if provided
        if (data.breakStart && data.breakEnd) {
          const breakStart = new Date(data.breakStart);
          const breakEnd = new Date(data.breakEnd);
          const breakTime =
            (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
          totalHours -= breakTime;
        }

        // Calculate overtime (assuming 8 hours is standard work day)
        overtimeHours = totalHours > 8 ? totalHours - 8 : 0;
      }

      const attendanceData: CreateAttendanceData = {
        employeeId: data.employeeId,
        date: new Date(data.date),
        checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
        checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
        breakStart: data.breakStart ? new Date(data.breakStart) : undefined,
        breakEnd: data.breakEnd ? new Date(data.breakEnd) : undefined,
        status: data.status as AttendanceStatusEnum,
        notes: data.notes || undefined,
        totalHours,
        overtimeHours,
        location: data.location || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await createAttendance.mutateAsync(attendanceData);

      onSuccess?.();
    } catch (err) {
      setError('Error al guardar la asistencia. Por favor, intenta de nuevo.');
      console.error('Error saving attendance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateLocal = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().slice(0, 10);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Registrar Asistencia</CardTitle>
        <p className="text-sm text-dim">Empleado: {employeeName}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger rounded-md p-4">
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Fecha *</Label>
              <Input
                type="date"
                {...register('date')}
                defaultValue={formatDateLocal(initialData?.date || new Date())}
                className={errors.date ? 'border-danger' : ''}
              />
              {errors.date && (
                <p className="text-danger text-sm mt-1">
                  {errors.date.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="status">Estado *</Label>
              <Select
                value={watchedStatus}
                onValueChange={(value) =>
                  setValue('status', value as AttendanceStatusEnum)
                }
              >
                <SelectTrigger className={errors.status ? 'border-danger' : ''}>
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AttendanceStatusEnum.PRESENT}>
                    Presente
                  </SelectItem>
                  <SelectItem value={AttendanceStatusEnum.ABSENT}>
                    Ausente
                  </SelectItem>
                  <SelectItem value={AttendanceStatusEnum.LATE}>
                    Tardanza
                  </SelectItem>
                  <SelectItem value={AttendanceStatusEnum.EARLY_DEPARTURE}>
                    Salida Temprana
                  </SelectItem>
                  <SelectItem value={AttendanceStatusEnum.HOLIDAY}>
                    Feriado
                  </SelectItem>
                  <SelectItem value={AttendanceStatusEnum.SICK_LEAVE}>
                    Permiso Médico
                  </SelectItem>
                  <SelectItem value={AttendanceStatusEnum.VACATION}>
                    Vacaciones
                  </SelectItem>
                  <SelectItem value={AttendanceStatusEnum.MEDICALREST}>
                    Reposo Médico
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-danger text-sm mt-1">
                  {errors.status.message}
                </p>
              )}
            </div>
          </div>

          {/* Time fields - only show for present/late/early departure */}
          {(watchedStatus === AttendanceStatusEnum.PRESENT ||
            watchedStatus === AttendanceStatusEnum.LATE ||
            watchedStatus === AttendanceStatusEnum.EARLY_DEPARTURE) && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="checkIn">Hora de Entrada</Label>
                  <Input
                    type="datetime-local"
                    {...register('checkIn')}
                    className={errors.checkIn ? 'border-danger' : ''}
                  />
                  {errors.checkIn && (
                    <p className="text-danger text-sm mt-1">
                      {errors.checkIn.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="checkOut">Hora de Salida</Label>
                  <Input
                    type="datetime-local"
                    {...register('checkOut')}
                    className={errors.checkOut ? 'border-danger' : ''}
                  />
                  {errors.checkOut && (
                    <p className="text-danger text-sm mt-1">
                      {errors.checkOut.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="breakStart">Inicio de Descanso</Label>
                  <Input
                    type="datetime-local"
                    {...register('breakStart')}
                    className={errors.breakStart ? 'border-danger' : ''}
                  />
                  {errors.breakStart && (
                    <p className="text-danger text-sm mt-1">
                      {errors.breakStart.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="breakEnd">Fin de Descanso</Label>
                  <Input
                    type="datetime-local"
                    {...register('breakEnd')}
                    className={errors.breakEnd ? 'border-danger' : ''}
                  />
                  {errors.breakEnd && (
                    <p className="text-danger text-sm mt-1">
                      {errors.breakEnd.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              {...register('notes')}
              placeholder="Observaciones adicionales..."
              rows={3}
              className={errors.notes ? 'border-danger' : ''}
            />
            {errors.notes && (
              <p className="text-danger text-sm mt-1">{errors.notes.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Asistencia'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
