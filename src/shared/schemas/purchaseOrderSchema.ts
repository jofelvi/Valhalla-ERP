// schemas/purchaseOrderSchema.ts
import * as yup from 'yup';
import {
  CurrencyEnum,
  PurchaseOrderStatusEnum,
} from '@/shared/types/enumShared';

export const purchaseOrderItemSchema = yup.object().shape({
  productId: yup.string().required('Producto es requerido').defined(),
  quantity: yup
    .number()
    .required('Cantidad es requerida')
    .positive('Debe ser positivo')
    .integer('Debe ser entero')
    .defined(),
  unitCost: yup
    .number()
    .required('Costo unitario es requerido')
    .positive('Debe ser positivo')
    .defined(),
  subtotal: yup.number().positive().defined(),
});

export const purchaseOrderSchema = yup.object().shape({
  supplierId: yup.string().required('Proveedor es requerido').defined(),
  items: yup
    .array()
    .of(purchaseOrderItemSchema)
    .required('Items son requeridos')
    .min(1, 'Debe tener al menos un item')
    .defined(),
  totalAmount: yup.number().positive('Monto debe ser positivo').defined(),
  currency: yup
    .string()
    .oneOf(Object.values(CurrencyEnum))
    .required('Moneda es requerida'),
  status: yup
    .string()
    .oneOf(Object.values(PurchaseOrderStatusEnum))
    .required('Estado es requerido'),
  expectedDeliveryDate: yup.date().nullable().defined(),
});

export type PurchaseOrderFormValues = yup.InferType<typeof purchaseOrderSchema>;
export type PurchaseOrderItemFormValues = yup.InferType<
  typeof purchaseOrderItemSchema
>;
