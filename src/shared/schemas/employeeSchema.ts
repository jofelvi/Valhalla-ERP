import * as yup from 'yup';

export const employeeSchema = yup.object().shape({
  firstName: yup.string().required('El nombre es requerido'),
  lastName: yup.string().required('El apellido es requerido'),
  email: yup.string().email('Email inválido').required('El email es requerido'),
  phone: yup.string().required('El teléfono es requerido'),
  address: yup.string().required('La dirección es requerida'),
  position: yup.string().required('El cargo es requerido'),
  department: yup.string().required('El departamento es requerido'),
  hireDate: yup.date().required('La fecha de contratación es requerida'),
  salary: yup
    .number()
    .typeError('Debe ser un número')
    .positive('El salario debe ser mayor a 0')
    .required('El salario es requerido'),
  isActive: yup.boolean().default(true),
  pin: yup
    .string()
    .nullable()
    .default(null)
    .test(
      'pin-validation',
      'El PIN debe tener exactamente 4 dígitos',
      (value) => !value || /^\d{4}$/.test(value),
    ),
  emergencyContact: yup
    .object({
      name: yup
        .string()
        .required('El nombre del contacto de emergencia es requerido'),
      phone: yup
        .string()
        .required('El teléfono del contacto de emergencia es requerido'),
      relationship: yup.string().required('La relación es requerida'),
    })
    .required(),
  bankAccount: yup
    .object({
      accountNumber: yup.string().nullable().default(null),
      bankName: yup.string().nullable().default(null),
      accountType: yup.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  photoUrl: yup.string().nullable().default(null),
  observations: yup
    .string()
    .nullable()
    .default(null)
    .max(2000, 'Maximo 2000 caracteres'),
  medicalInfo: yup
    .object({
      bloodType: yup.string().nullable().default(null),
      allergies: yup.string().nullable().default(null),
      conditions: yup.string().nullable().default(null),
      notes: yup.string().nullable().default(null),
    })
    .nullable()
    .default(null),
});

export type EmployeeFormValues = yup.InferType<typeof employeeSchema>;
