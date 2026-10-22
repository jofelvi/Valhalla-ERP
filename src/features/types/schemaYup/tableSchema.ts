// schemas/tableSchema.ts
import * as yup from 'yup';
import { TableStatusEnum } from '@/shared';

export const tableSchema = yup.object().shape({
  name: yup.string().required('El nombre es requerido').defined(),
  number: yup
    .number()
    .required('El número es requerido')
    .positive('Debe ser positivo')
    .integer('Debe ser un número entero')
    .defined(),
  capacity: yup
    .number()
    .required('La capacidad es requerida')
    .positive('Debe ser positivo')
    .integer('Debe ser un número entero')
    .min(1, 'Mínimo 1 persona')
    .defined(),
  status: yup
    .mixed<TableStatusEnum>()
    .oneOf(Object.values(TableStatusEnum), 'Estado inválido')
    .required('El estado es requerido')
    .defined(),
  isAvailable: yup.boolean().required().defined(),
  orderId: yup.string().nullable().defined(),
});

export type TableFormValues = yup.InferType<typeof tableSchema>;
