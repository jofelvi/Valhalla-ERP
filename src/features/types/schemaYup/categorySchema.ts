import * as yup from 'yup';

export const categorySchema = yup.object().shape({
  name: yup.string().required('El nombre es requerido').defined(),
  description: yup.string().nullable().defined(),
  isActive: yup.boolean().required().defined(),
  imageUrl: yup.string().url('Debe ser una URL válida').nullable().defined(),
  isForSale: yup.boolean().required().defined(), // Nuevo campo
  // Categoría padre: si se elige, esta categoría pasa a ser una subcategoría.
  // Opcional para no obligar a nadie ni migrar datos.
  parentId: yup.string().nullable().optional(),
});

export type CategoryFormValues = yup.InferType<typeof categorySchema>;
