'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Employee } from '@odin6/types';
import { PayrollCalculation } from '@odin6/types';
import { useActiveEmployees } from '@/hooks/useEmployees';
import { PayrollCalculationService } from '@/services/payrollService';
import { useNominaConfig } from '@/features/payroll/hooks/useNominaConfig';
import {
  PayrollCalculationFormValues,
  payrollCalculationSchema,
} from '@/shared/schemas/payrollSchema';
import {
  AlertCircle,
  Calculator,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatearUsdConMiles } from '@/shared/utils/dinero';

interface PayrollFormProps {
  onSuccess?: (payrollId: string) => void;
  onCancel?: () => void;
  initialData?: Partial<PayrollCalculationFormValues>;
}

export default function PayrollForm({
  onSuccess,
  onCancel,
  initialData,
}: PayrollFormProps) {
  const { data: employeesData = [] } = useActiveEmployees();
  const nomina = useNominaConfig();
  // Las retenciones de ley son configurables (Ajustes → Nómina); se suman en una sola.
  const servicioNomina = useMemo(
    () =>
      new PayrollCalculationService({
        taxRate: nomina.deductions.reduce((s, d) => s + d.rate, 0) * 100,
      }),
    [nomina.deductions],
  );
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [payrollCalculation, setPayrollCalculation] =
    useState<PayrollCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PayrollCalculationFormValues>({
    resolver: yupResolver(payrollCalculationSchema),
    defaultValues: {
      month: initialData?.month || new Date().getMonth() + 1,
      year: initialData?.year || new Date().getFullYear(),
      includeOvertimePay: initialData?.includeOvertimePay ?? true,
      overtimeRate: initialData?.overtimeRate || 1.5,
      bonuses: initialData?.bonuses || 0,
      commissions: initialData?.commissions || 0,
      additionalDeductions: initialData?.additionalDeductions || 0,
    },
  });

  const watchedEmployeeId = watch('employeeId');
  const watchedMonth = watch('month');
  const watchedYear = watch('year');
  const watchedBonuses = watch('bonuses');
  const watchedCommissions = watch('commissions');
  const watchedAdditionalDeductions = watch('additionalDeductions');

  useEffect(() => {
    if (watchedEmployeeId) {
      const employee = employeesData.find((e) => e.id === watchedEmployeeId);
      setSelectedEmployee(employee || null);
      setPayrollCalculation(null);
    }
  }, [watchedEmployeeId, employeesData]);

  const calculatePayroll = async () => {
    if (!watchedEmployeeId || !watchedMonth || !watchedYear) {
      setError('Por favor selecciona empleado, mes y año');
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const calculation = await servicioNomina.calculateEmployeePayroll(
        watchedEmployeeId,
        watchedMonth,
        watchedYear,
        {
          bonuses: watchedBonuses || 0,
          commissions: watchedCommissions || 0,
          additionalDeductions: watchedAdditionalDeductions || 0,
        },
      );

      if (calculation) {
        setPayrollCalculation(calculation);
      } else {
        setError(
          'No se pudo calcular la nómina. Verifica que el empleado tenga registros de asistencia.',
        );
      }
    } catch {
      setError('Error al calcular la nómina');
    } finally {
      setIsCalculating(false);
    }
  };

  const onSubmit = async (data: PayrollCalculationFormValues) => {
    if (!payrollCalculation) {
      setError('Primero debes calcular la nómina');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Actualizar el cálculo con los valores del formulario
      const updatedPayrollCalculation = {
        ...payrollCalculation,
        salary: {
          ...payrollCalculation.salary,
          bonuses: data.bonuses || 0,
          commissions: data.commissions || 0,
        },
        deductions: {
          ...payrollCalculation.deductions,
          other: data.additionalDeductions || 0,
        },
      };

      // Recalcular gross pay y net pay con los nuevos valores
      const newGrossPay =
        updatedPayrollCalculation.salary.baseSalary +
        updatedPayrollCalculation.salary.overtime +
        updatedPayrollCalculation.salary.bonuses +
        updatedPayrollCalculation.salary.commissions;

      const newTotalDeductions =
        updatedPayrollCalculation.deductions.taxes +
        updatedPayrollCalculation.deductions.socialSecurity +
        updatedPayrollCalculation.deductions.insurance +
        updatedPayrollCalculation.deductions.other;

      const finalPayrollCalculation = {
        ...updatedPayrollCalculation,
        grossPay: newGrossPay,
        totalDeductions: newTotalDeductions,
        netPay: newGrossPay - newTotalDeductions,
      };

      const payrollId = await servicioNomina.createPayroll(
        finalPayrollCalculation,
      );
      onSuccess?.(payrollId);
    } catch (err) {
      console.error('Error saving payroll:', err);
      setError('Error al guardar la nómina');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calcular Nómina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-md p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-danger" />
                  <p className="text-danger text-sm">{error}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="employeeId">Empleado *</Label>
                <Select
                  value={watchedEmployeeId || ''}
                  onValueChange={(value) => setValue('employeeId', value)}
                >
                  <SelectTrigger
                    className={errors.employeeId ? 'border-danger' : ''}
                  >
                    <SelectValue placeholder="Selecciona un empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeesData.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        <div className="flex flex-col">
                          <span>
                            {employee.firstName} {employee.lastName}
                          </span>
                          <span className="text-sm text-dim">
                            {employee.position}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.employeeId && (
                  <p className="text-danger text-sm mt-1">
                    {errors.employeeId.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="month">Mes *</Label>
                <Select
                  value={watchedMonth?.toString() || ''}
                  onValueChange={(value) => setValue('month', parseInt(value))}
                >
                  <SelectTrigger
                    className={errors.month ? 'border-danger' : ''}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {new Date(0, i).toLocaleDateString('es-ES', {
                          month: 'long',
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.month && (
                  <p className="text-danger text-sm mt-1">
                    {errors.month.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="year">Año *</Label>
                <Input
                  type="number"
                  {...register('year')}
                  min="2020"
                  max="2030"
                  className={errors.year ? 'border-danger' : ''}
                />
                {errors.year && (
                  <p className="text-danger text-sm mt-1">
                    {errors.year.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="overtimeRate">Tasa Horas Extra</Label>
                <Input
                  type="number"
                  step="0.1"
                  {...register('overtimeRate')}
                  className={errors.overtimeRate ? 'border-danger' : ''}
                />
                {errors.overtimeRate && (
                  <p className="text-danger text-sm mt-1">
                    {errors.overtimeRate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="bonuses">Bonificaciones</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('bonuses')}
                  placeholder="0.00"
                  className={errors.bonuses ? 'border-danger' : ''}
                />
                {errors.bonuses && (
                  <p className="text-danger text-sm mt-1">
                    {errors.bonuses.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="commissions">Comisiones</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('commissions')}
                  placeholder="0.00"
                  className={errors.commissions ? 'border-danger' : ''}
                />
                {errors.commissions && (
                  <p className="text-danger text-sm mt-1">
                    {errors.commissions.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="additionalDeductions">
                  Deducciones Adicionales
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('additionalDeductions')}
                  placeholder="0.00"
                  className={errors.additionalDeductions ? 'border-danger' : ''}
                />
                {errors.additionalDeductions && (
                  <p className="text-danger text-sm mt-1">
                    {errors.additionalDeductions.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                onClick={calculatePayroll}
                disabled={isCalculating || !watchedEmployeeId}
                className="flex items-center gap-2"
              >
                <Calculator className="h-4 w-4" />
                {isCalculating ? 'Calculando...' : 'Calcular Nómina'}
              </Button>
            </div>

            {selectedEmployee && (
              <Card className="bg-elevated border-brand/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <Users className="h-8 w-8 text-brand" />
                    <div>
                      <h3 className="font-medium">
                        {selectedEmployee.firstName} {selectedEmployee.lastName}
                      </h3>
                      <p className="text-sm text-dim">
                        {selectedEmployee.position} -{' '}
                        {selectedEmployee.department}
                      </p>
                      <p className="text-sm text-brand">
                        Salario Base:{' '}
                        {formatearUsdConMiles(selectedEmployee.salary)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {payrollCalculation && (
              <Card className="bg-ok/10 border-ok/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-ok">
                    <CheckCircle className="h-5 w-5" />
                    Cálculo de Nómina
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Attendance Summary */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Resumen de Asistencia
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-ok">
                          {payrollCalculation.attendanceSummary.presentDays}
                        </p>
                        <p className="text-sm text-dim">Días Trabajados</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-brand">
                          {payrollCalculation.hoursWorked.toFixed(1)}h
                        </p>
                        <p className="text-sm text-dim">Horas Totales</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-accent">
                          {payrollCalculation.overtimeHours.toFixed(1)}h
                        </p>
                        <p className="text-sm text-dim">Horas Extra</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-accent">
                          {formatPercentage(
                            payrollCalculation.attendanceSummary.attendanceRate,
                          )}
                        </p>
                        <p className="text-sm text-dim">Asistencia</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Salary Breakdown */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Desglose Salarial
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h5 className="font-medium text-ok">Ingresos</h5>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-sm">Salario Base:</span>
                            <span className="font-medium">
                              {formatearUsdConMiles(
                                payrollCalculation.salary.baseSalary,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Horas Extra:</span>
                            <span className="font-medium">
                              {formatearUsdConMiles(
                                payrollCalculation.salary.overtime,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Bonificaciones:</span>
                            <span className="font-medium">
                              {formatearUsdConMiles(
                                payrollCalculation.salary.bonuses,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Comisiones:</span>
                            <span className="font-medium">
                              {formatearUsdConMiles(
                                payrollCalculation.salary.commissions,
                              )}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-bold text-ok">
                            <span>Salario Bruto:</span>
                            <span>
                              {formatearUsdConMiles(
                                payrollCalculation.grossPay,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-medium text-danger">Deducciones</h5>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-sm">Impuestos:</span>
                            <span className="font-medium">
                              {formatearUsdConMiles(
                                payrollCalculation.deductions.taxes,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Seguro Social:</span>
                            <span className="font-medium">
                              {formatearUsdConMiles(
                                payrollCalculation.deductions.socialSecurity,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Seguros:</span>
                            <span className="font-medium">
                              {formatearUsdConMiles(
                                payrollCalculation.deductions.insurance,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Otras:</span>
                            <span className="font-medium">
                              {formatearUsdConMiles(
                                payrollCalculation.deductions.other,
                              )}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-bold text-danger">
                            <span>Total Deducciones:</span>
                            <span>
                              {formatearUsdConMiles(
                                payrollCalculation.totalDeductions,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Net Pay */}
                  <div className="text-center bg-surface rounded-lg p-4 border-2 border-brand/20">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <TrendingUp className="h-6 w-6 text-brand" />
                      <h4 className="text-lg font-bold text-brand">
                        Salario Neto
                      </h4>
                    </div>
                    <p className="text-3xl font-bold text-brand">
                      {formatearUsdConMiles(payrollCalculation.netPay)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end space-x-4">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting || !payrollCalculation}
                className="flex items-center gap-2"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Nómina'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
