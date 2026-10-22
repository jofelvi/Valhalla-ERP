import * as yup from 'yup';
import {
  ProductPresentationEnum,
  ProductStationEnum,
  ProductTypeEnum,
} from '@/shared';

const ingredientSchema = yup.object({
  productId: yup.string().required('El producto es requerido'),
  quantity: yup
    .number()
    .positive('La cantidad debe ser positiva')
    .required('La cantidad es requerida'),
  unit: yup.string().required('La unidad es requerida'),
  wastePercentage: yup // Nuevo campo
    .number()
    .min(0, 'La merma no puede ser negativa')
    .max(100, 'La merma no puede ser mayor a 100%')
    .default(10)
    .required('La merma es requerida'),
});

export const productSchema = yup.object({
  name: yup.string().required('El nombre es requerido').defined(),
  description: yup.string().nullable().optional(),
  // El precio es de VENTA: solo un producto marcado "Disponible para Venta" lo
  // necesita. Un insumo que solo entra en recetas (la cesta de tomate) no se
  // vende, y el servidor ya acepta 0. Vacío cuenta como 0 para no dar un error
  // de tipo.
  price: yup
    .number()
    .transform((value, original) =>
      original === '' || original === null || original === undefined
        ? 0
        : value,
    )
    .when('isForSale', {
      is: true,
      then: (schema) =>
        schema.positive(
          'Un producto a la venta necesita un precio mayor que 0. Si no se vende, apaga "Disponible para Venta".',
        ),
      otherwise: (schema) => schema.min(0, 'El precio no puede ser negativo'),
    })
    .required('El precio es requerido')
    .defined(),
  // La moneda es siempre USD en este negocio; el campo solo lo leía el
  // formateador de precio del APK.
  type: yup
    .string()
    .oneOf(Object.values(ProductTypeEnum))
    // Mensaje alineado con el del servidor (product-nature.util) para que sea
    // claro qué se está eligiendo y por qué es obligatorio.
    .required(
      'Elige qué es el producto: Insumo (se descuenta a sí mismo), Preparado (lleva receta) o Servicio (no toca inventario).',
    )
    .defined(),
  categoryId: yup.string().required('La categoría es requerida').defined(),
  // Subcategoría del insumo (opcional). El servidor la limpia si el producto no
  // es BASE, así que aquí es solo opcional/nullable, sin `.defined()`.
  subcategoryId: yup.string().nullable().optional(),
  supplierIds: yup.array().of(yup.string()).nullable().defined(),
  isActive: yup.boolean().default(true).defined(),
  isForSale: yup.boolean().default(true).defined(),
  // El cliente NO envía isForInventory: el servidor lo DERIVA de `type`
  // (product-nature.util). Por eso aquí es opcional/nullable y NO `.defined()`,
  // que bloqueaba el alta de productos ("isForInventory must be defined").
  isForInventory: yup.boolean().optional().nullable(),
  cost: yup
    .number()
    .min(0, 'El costo no puede ser negativo') // Asegura que no sea negativo, permitiendo el cero
    .optional()
    .defined(),
  sku: yup.string().nullable().optional(),
  barcode: yup.string().nullable().optional(),
  // `stock` ya no se edita aquí: el que manda vive en warehouse_stocks y se
  // cambia registrando un CONTEO, que deja rastro en el kardex.
  minStock: yup
    .number()
    .min(0, 'El stock mínimo no puede ser negativo')
    .nullable()
    .defined(),
  // Solo el INSUMO necesita presentación: es lo que define su unidad base y su
  // costo por unidad. Exigírsela a un preparado o a un servicio era pedir un
  // dato que no significa nada para ellos.
  presentation: yup
    .string()
    .oneOf(Object.values(ProductPresentationEnum))
    .when('type', {
      is: ProductTypeEnum.BASE,
      then: (schema) => schema.required('El insumo necesita su presentación'),
      otherwise: (schema) => schema.optional(),
    })
    .defined(),
  presentationQuantity: yup
    .number()
    .positive('La cantidad debe ser positiva')
    .nullable()
    .defined(),
  // Equivalencias del insumo: sin ellas una receta en otra familia de unidad
  // (ml de algo que se compra por gramos) no se puede costear ni descontar.
  gramsPerMl: yup
    .number()
    .transform((v, orig) => (orig === '' || orig === null ? null : v))
    .positive('Debe ser mayor que 0')
    .nullable()
    .optional(),
  gramsPerUnit: yup
    .number()
    .transform((v, orig) => (orig === '' || orig === null ? null : v))
    .positive('Debe ser mayor que 0')
    .nullable()
    .optional(),
  mlPerUnit: yup
    .number()
    .transform((v, orig) => (orig === '' || orig === null ? null : v))
    .positive('Debe ser mayor que 0')
    .nullable()
    .optional(),
  imageUrl: yup.string().nullable().optional(),
  ingredients: yup
    .array()
    .of(ingredientSchema)
    .when('type', {
      is: ProductTypeEnum.MIXED,
      then: (schema) =>
        schema.min(1, 'Un preparado necesita al menos un ingrediente'),
      otherwise: (schema) => schema.nullable(),
    })
    .nullable()
    .optional()
    .defined(),

  criticality: yup
    .string()
    .oneOf(['ALTA', 'MEDIA', 'BAJA'])
    .nullable()
    .optional()
    .defined(),
  station: yup
    .string()
    .oneOf(Object.values(ProductStationEnum))
    .nullable()
    .optional()
    .defined(),
});

export type ProductFormData = yup.InferType<typeof productSchema>;
