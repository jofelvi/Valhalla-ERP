'use client';
import { useParams, useRouter } from 'next/navigation';
import { getRouteParam } from '@/shared/utils/routeParams';
import { formatearUsd } from '@/shared/utils/dinero';
import { useState } from 'react';
import { useEmployee } from '@/hooks/useEmployees';
import { usePayrollByEmployee, useCreatePayroll } from '@/hooks/usePayroll';
import { PayrollStatusEnum } from '@/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  DollarSignIcon,
  FileTextIcon,
  PlusIcon,
  XCircleIcon,
} from 'lucide-react';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import { useNominaConfig } from '@/features/payroll/hooks/useNominaConfig';

export default function EmployeePayrollPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = getRouteParam(params.id);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: employee, isLoading: employeeLoading } =
    useEmployee(employeeId);
  const { data: allPayrolls = [] } = usePayrollByEmployee(employeeId);
  const createPayroll = useCreatePayroll();
  const nomina = useNominaConfig();

  const payrolls = allPayrolls.filter((p) => p.period.year === selectedYear);

  const handleBack = () => {
    router.push(`/private/employees/${employee?.id}`);
  };

  const handleCreatePayroll = async (month: number) => {
    if (!employee) return;

    const year = selectedYear;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const baseSalary = employee.salary || 0;
    const grossPay = baseSalary + 0 + 0 + 0; // baseSalary + overtime + bonuses + commissions

    // Retenciones de ley configuradas (ninguna = 0). El modelo de nómina tiene un
    // campo fijo de impuestos: aquí se guarda la suma de todas las retenciones.
    const retenciones =
      Math.round(
        nomina.deductions.reduce((s, d) => s + baseSalary * d.rate, 0) * 100,
      ) / 100;

    // Calculate net pay
    const netPay = grossPay - retenciones;

    const payrollData = {
      employeeId: employee.id,
      period: {
        startDate,
        endDate,
        month,
        year,
      },
      salary: {
        baseSalary,
        overtime: 0,
        bonuses: 0,
        commissions: 0,
      },
      deductions: {
        taxes: retenciones,
        socialSecurity: 0,
        insurance: 0,
        other: 0,
      },
      hoursWorked: 160,
      overtimeHours: 0,
      status: PayrollStatusEnum.DRAFT,
      grossPay,
      netPay,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await createPayroll.mutateAsync(payrollData);
  };

  const getStatusBadge = (status: PayrollStatusEnum) => {
    const statusConfig = {
      [PayrollStatusEnum.DRAFT]: {
        color: 'bg-elevated text-content',
        icon: ClockIcon,
      },
      [PayrollStatusEnum.APPROVED]: {
        color: 'bg-brand/15 text-brand',
        icon: CheckCircleIcon,
      },
      [PayrollStatusEnum.PAID]: {
        color: 'bg-ok/15 text-ok',
        icon: CheckCircleIcon,
      },
      [PayrollStatusEnum.CANCELLED]: {
        color: 'bg-danger/15 text-danger',
        icon: XCircleIcon,
      },
    };

    const config =
      statusConfig[status] || statusConfig[PayrollStatusEnum.DRAFT];
    const IconComponent = config.icon;

    return (
      <Badge className={`${config.color} border-0`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getMonthName = (month: number) => {
    return new Date(0, month - 1).toLocaleDateString('es-ES', {
      month: 'long',
    });
  };

  const getPayrollForMonth = (month: number) => {
    return payrolls.find((p) => p.period.month === month);
  };

  const totalPaidThisYear = payrolls
    .filter((p) => p.status === PayrollStatusEnum.PAID)
    .reduce((acc, p) => acc + p.netPay, 0);

  if (employeeLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-8">
        <p className="text-danger">Empleado no encontrado</p>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nómina</h1>
            <p className="text-dim">
              {employee?.firstName} {employee?.lastName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <Label htmlFor="year">Año</Label>
            <Input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              min="2020"
              max="2030"
              className="w-20"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Información del Empleado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-dim">Salario Base:</span>
                <span className="font-medium">
                  {formatearUsd(employee?.salary || 0)}
                </span>
              </div>
              <FilaDeResumen
                etiqueta="Cargo:"
                classNameEtiqueta="text-sm text-dim"
                valor={employee?.position}
                classNameValor="font-medium"
              />
              <FilaDeResumen
                etiqueta="Departamento:"
                classNameEtiqueta="text-sm text-dim"
                valor={employee?.department}
                classNameValor="font-medium"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Resumen del Año</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-dim">Nóminas procesadas:</span>
                <span className="font-medium">{payrolls.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-dim">Nóminas pagadas:</span>
                <span className="font-medium">
                  {
                    payrolls.filter((p) => p.status === PayrollStatusEnum.PAID)
                      .length
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-dim">Total pagado:</span>
                <span className="font-medium text-ok">
                  {formatearUsd(totalPaidThisYear)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Última Nómina</CardTitle>
          </CardHeader>
          <CardContent>
            {payrolls.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const lastPayroll = payrolls[payrolls.length - 1];
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-dim">Período:</span>
                        <span className="font-medium">
                          {formatDate(lastPayroll.period.startDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-dim">Pago neto:</span>
                        <span className="font-medium">
                          {formatearUsd(lastPayroll.netPay)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-dim">Estado:</span>
                        {getStatusBadge(lastPayroll.status)}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-4 text-dim">
                <FileTextIcon className="h-8 w-8 mx-auto mb-2 text-dim" />
                <p className="text-sm">No hay nóminas registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nóminas por Mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const payroll = getPayrollForMonth(month);
              return (
                <Card
                  key={month}
                  className="border-2 border-line hover:border-brand/50 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">{getMonthName(month)}</h3>
                      {payroll ? (
                        getStatusBadge(payroll.status)
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleCreatePayroll(month)}
                          className="flex items-center gap-1"
                        >
                          <PlusIcon className="h-3 w-3" />
                          Crear
                        </Button>
                      )}
                    </div>

                    {payroll ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-dim">Bruto:</span>
                          <span className="font-medium">
                            {formatearUsd(payroll.grossPay)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-dim">Deducciones:</span>
                          <span className="font-medium text-danger">
                            -{formatearUsd(payroll.grossPay - payroll.netPay)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold border-t pt-2">
                          <span>Neto:</span>
                          <span className="text-ok">
                            {formatearUsd(payroll.netPay)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-dim">Horas:</span>
                          <span className="font-medium">
                            {payroll.hoursWorked}h
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-dim">
                        <DollarSignIcon className="h-8 w-8 mx-auto mb-2 text-dim" />
                        <p className="text-sm">No procesada</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
