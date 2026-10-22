import * as yup from 'yup';

export const supplierSchema = yup.object().shape({
  name: yup.string().required('El nombre es requerido'),
  contactName: yup.string().nullable().defined(), // Puede ser null
  phone: yup
    .string()
    .matches(/^[0-9]+$/, 'Solo números permitidos')
    .nullable()
    .defined(),
  email: yup.string().email('Email inválido').nullable().defined(),
  address: yup.string().nullable().defined(),
  isActive: yup.boolean().required(),
  productIds: yup.array().of(yup.string().defined()).defined(), // Todos los elementos son string// required pero puede ser array vacío
});

export type SupplierFormData = yup.InferType<typeof supplierSchema>;
