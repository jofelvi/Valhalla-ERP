import * as yup from 'yup';
import { AttendanceStatusEnum } from '@/shared/types/enumShared';

export const attendanceSchema = yup.object().shape({
  employeeId: yup.string().required('Empleado es requerido').defined(),
  date: yup.date().required('Fecha es requerida').defined(),
  checkIn: yup.date().nullable().defined(),
  checkOut: yup.date().nullable().defined(),
  breakStart: yup.date().nullable().defined(),
  breakEnd: yup.date().nullable().defined(),
  totalHours: yup
    .number()
    .min(0, 'Total de horas debe ser positivo')
    .required()
    .defined(),
  overtimeHours: yup
    .number()
    .min(0, 'Horas extra debe ser positivo')
    .required()
    .defined(),
  hoursWorked: yup
    .number()
    .min(0, 'Horas trabajadas debe ser positivo')
    .nullable()
    .defined(),
  status: yup
    .string()
    .oneOf(Object.values(AttendanceStatusEnum))
    .required('Estado es requerido')
    .defined(),
  notes: yup.string().nullable().defined(),
  location: yup
    .object({
      latitude: yup.number().nullable().defined(),
      longitude: yup.number().nullable().defined(),
      accuracy: yup.number().nullable().defined(),
      checkIn: yup
        .object({
          latitude: yup.number().required().defined(),
          longitude: yup.number().required().defined(),
          accuracy: yup.number().required().defined(),
        })
        .nullable()
        .defined(),
      checkOut: yup
        .object({
          latitude: yup.number().required().defined(),
          longitude: yup.number().required().defined(),
          accuracy: yup.number().required().defined(),
        })
        .nullable()
        .defined(),
    })
    .nullable()
    .defined(),
  device: yup
    .object({
      userAgent: yup.string().nullable().defined(),
      timestamp: yup.number().nullable().defined(),
      ipAddress: yup.string().nullable().defined(),
    })
    .nullable()
    .defined(),
});

export type AttendanceFormValues = yup.InferType<typeof attendanceSchema>;
