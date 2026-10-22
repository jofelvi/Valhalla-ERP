import * as yup from 'yup';
import { PayrollStatusEnum } from '@/shared/types/enumShared';

export const payrollSchema = yup.object({
  employeeId: yup.string().required('Empleado es requerido'),
  period: yup.object({
    startDate: yup.date().required('Fecha de inicio es requerida'),
    endDate: yup
      .date()
      .required('Fecha de fin es requerida')
      .min(
        yup.ref('startDate'),
        'La fecha de fin debe ser posterior a la fecha de inicio',
      ),
    month: yup
      .number()
      .required('Mes es requerido')
      .min(1, 'Mes debe ser entre 1 y 12')
      .max(12, 'Mes debe ser entre 1 y 12'),
    year: yup
      .number()
      .required('Año es requerido')
      .min(2020, 'Año debe ser mayor a 2020')
      .max(2030, 'Año debe ser menor a 2030'),
  }),
  salary: yup.object({
    baseSalary: yup
      .number()
      .required('Salario base es requerido')
      .min(0, 'El salario base debe ser mayor a 0'),
    overtime: yup
      .number()
      .min(0, 'Las horas extras deben ser mayor o igual a 0')
      .default(0),
    bonuses: yup
      .number()
      .min(0, 'Los bonos deben ser mayor o igual a 0')
      .default(0),
    commissions: yup
      .number()
      .min(0, 'Las comisiones deben ser mayor o igual a 0')
      .default(0),
  }),
  deductions: yup.object({
    taxes: yup
      .number()
      .min(0, 'Los impuestos deben ser mayor o igual a 0')
      .default(0),
    socialSecurity: yup
      .number()
      .min(0, 'La seguridad social debe ser mayor o igual a 0')
      .default(0),
    insurance: yup
      .number()
      .min(0, 'El seguro debe ser mayor o igual a 0')
      .default(0),
    other: yup
      .number()
      .min(0, 'Otras deducciones deben ser mayor o igual a 0')
      .default(0),
  }),
  hoursWorked: yup
    .number()
    .required('Horas trabajadas es requerido')
    .min(0, 'Las horas trabajadas deben ser mayor o igual a 0'),
  overtimeHours: yup
    .number()
    .min(0, 'Las horas extras deben ser mayor o igual a 0')
    .default(0),
  status: yup
    .string()
    .oneOf(Object.values(PayrollStatusEnum))
    .default(PayrollStatusEnum.DRAFT),
  paymentDate: yup.date().nullable(),
  notes: yup.string(),
});

export const payrollCalculationSchema = yup.object({
  employeeId: yup.string().required('Empleado es requerido'),
  month: yup
    .number()
    .required('Mes es requerido')
    .min(1, 'Mes debe ser entre 1 y 12')
    .max(12, 'Mes debe ser entre 1 y 12'),
  year: yup
    .number()
    .required('Año es requerido')
    .min(2020, 'Año debe ser mayor a 2020')
    .max(2030, 'Año debe ser menor a 2030'),
  includeOvertimePay: yup.boolean().default(true),
  overtimeRate: yup
    .number()
    .min(1, 'La tasa de horas extras debe ser mayor a 1')
    .max(3, 'La tasa de horas extras debe ser menor a 3')
    .default(1.5),
  bonuses: yup
    .number()
    .min(0, 'Los bonos deben ser mayor o igual a 0')
    .default(0),
  commissions: yup
    .number()
    .min(0, 'Las comisiones deben ser mayor o igual a 0')
    .default(0),
  additionalDeductions: yup
    .number()
    .min(0, 'Las deducciones adicionales deben ser mayor o igual a 0')
    .default(0),
});

export const payrollReportSchema = yup.object({
  startDate: yup.date().required('Fecha de inicio es requerida'),
  endDate: yup
    .date()
    .required('Fecha de fin es requerida')
    .min(
      yup.ref('startDate'),
      'La fecha de fin debe ser posterior a la fecha de inicio',
    ),
  employeeId: yup.string(), // Optional for individual employee report
  department: yup.string(), // Optional for department report
  status: yup.string().oneOf(Object.values(PayrollStatusEnum)), // Optional filter by status
});

export type PayrollFormValues = yup.InferType<typeof payrollSchema>;
export type PayrollCalculationFormValues = yup.InferType<
  typeof payrollCalculationSchema
>;
export type PayrollReportFormValues = yup.InferType<typeof payrollReportSchema>;
