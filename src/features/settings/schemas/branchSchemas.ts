import * as yup from 'yup';

// Branch form schema (for create/edit branch)
export const branchFormSchema = yup.object({
  name: yup.string().required('El nombre de la sucursal es obligatorio'),
  description: yup.string().optional(),
  address: yup.string().required('La dirección es obligatoria'),
  city: yup.string().required('La ciudad es obligatoria'),
  country: yup.string().required('El país es obligatorio'),
  phone: yup.string().optional(),
  email: yup.string().email('Email inválido').optional(),
  isDefault: yup.boolean().optional(),
});

// General settings schema
export const generalSettingsSchema = yup.object({
  currency: yup.string().required('La moneda es obligatoria'),
  language: yup.string().required('El idioma es obligatorio'),
  timezone: yup.string().required('La zona horaria es obligatoria'),
  dateFormat: yup.string().required('El formato de fecha es obligatorio'),
  taxRate: yup
    .number()
    .min(0, 'La tasa de impuesto no puede ser negativa')
    .max(100, 'La tasa de impuesto no puede ser mayor al 100%')
    .required('La tasa de impuesto es obligatoria'),
  enableTips: yup.boolean().optional(),
  defaultTipPercentage: yup
    .number()
    .min(0, 'El porcentaje de propina no puede ser negativo')
    .max(100, 'El porcentaje de propina no puede ser mayor al 100%')
    .when('enableTips', {
      is: true,
      then: (schema) =>
        schema.required(
          'El porcentaje de propina es obligatorio cuando las propinas están habilitadas',
        ),
    })
    .optional(),
});

// Branch creation schema (includes settings)
export const newBranchSchema = branchFormSchema.concat(
  yup.object({
    // Basic settings for new branch
    currency: yup.string().required('La moneda es obligatoria'),
    language: yup.string().required('El idioma es obligatorio'),
    timezone: yup.string().required('La zona horaria es obligatoria'),
    taxRate: yup
      .number()
      .min(0, 'La tasa de impuesto no puede ser negativa')
      .max(100, 'La tasa de impuesto no puede ser mayor al 100%')
      .required('La tasa de impuesto es obligatoria'),
    enableTips: yup.boolean().optional(),
    defaultTipPercentage: yup
      .number()
      .min(0, 'El porcentaje de propina no puede ser negativo')
      .max(100, 'El porcentaje de propina no puede ser mayor al 100%')
      .when('enableTips', {
        is: true,
        then: (schema) =>
          schema.required('El porcentaje de propina es obligatorio'),
      })
      .optional(),
  }),
);

// Infer types from schemas
export type BranchFormData = yup.InferType<typeof branchFormSchema>;
export type GeneralSettingsFormData = yup.InferType<
  typeof generalSettingsSchema
>;
export type NewBranchFormData = yup.InferType<typeof newBranchSchema>;
