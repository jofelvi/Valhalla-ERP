import * as yup from 'yup';

export interface ProductFormValues {
  name: string;
  description: string;
  categoryId: string;
  price: string; // string en el input, se parsea al guardar
  cost: string;
  station: 'KITCHEN' | 'BAR' | 'PIZZA' | 'NONE';
  isActive: boolean;
  isForSale: boolean;
  barcode: string;
}

export const productFormSchema: yup.ObjectSchema<ProductFormValues> =
  yup.object({
    name: yup.string().trim().required('El nombre es obligatorio'),
    description: yup.string().defined().default(''),
    categoryId: yup.string().required('La categoría es obligatoria'),
    price: yup
      .string()
      .required('El precio es obligatorio')
      .test(
        'is-positive',
        'El precio debe ser mayor a 0',
        (v) => Number(v) > 0,
      ),
    cost: yup
      .string()
      .defined()
      .default('')
      .test('is-valid-cost', 'El costo no puede ser negativo', (v) =>
        v === '' || v == null ? true : Number(v) >= 0,
      ),
    station: yup
      .mixed<'KITCHEN' | 'BAR' | 'PIZZA' | 'NONE'>()
      .oneOf(['KITCHEN', 'BAR', 'PIZZA', 'NONE'])
      .required(),
    isActive: yup.boolean().required(),
    isForSale: yup.boolean().required(),
    barcode: yup.string().defined().default(''),
  });
