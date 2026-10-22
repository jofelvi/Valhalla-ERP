// schemas/customerSchema.ts
import * as yup from 'yup';
import { IdentificationType } from '@/shared/types/enumShared';

export const customerSchema = yup.object({
  name: yup.string().required('El nombre es requerido').defined(),
  phone: yup.string().required('El teléfono es requerido').nullable().defined(),
  email: yup.string().email('Email inválido').nullable().defined(),
  address: yup.string().nullable().notRequired().defined(),
  identificationId: yup.string().nullable().notRequired().defined(),
  identificationType: yup
    .mixed<IdentificationType>()
    .oneOf(Object.values(IdentificationType))
    .nullable()
    .notRequired()
    .defined(),
  isActive: yup.boolean().default(true).defined(),
});

export type CustomerFormData = yup.InferType<typeof customerSchema>;
