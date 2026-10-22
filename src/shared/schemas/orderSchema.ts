import * as yup from 'yup';
import {
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
} from '@/shared/types/enumShared';

const productCustomizationSchema = yup
  .object()
  .shape({
    removedIngredients: yup.array().of(yup.string().required()).required(),
    addedExtras: yup
      .array()
      .of(
        yup.object().shape({
          productId: yup.string().required(),
          name: yup.string().required(),
          price: yup.number().required(),
          quantity: yup.number().required(),
        }),
      )
      .required(),
    customizationPrice: yup.number().required(),
  })
  .default(undefined);

export const orderItemSchema = yup.object().shape({
  productId: yup.string().required(),
  name: yup.string().required(),
  productName: yup.string().optional(),
  quantity: yup.number().required().positive().integer(),
  unitPrice: yup.number().required().min(0),
  total: yup.number().required().min(0),
  totalPrice: yup.number().optional(),
  // notes: permite undefined | string | null (compatible con ModelTypes y convertOrderItemsToPacks)
  notes: yup.string().nullable().optional(),
  customizations: productCustomizationSchema.nullable().optional(),
  cancelledAt: yup.string().nullable().optional(),
  station: yup.string<'KITCHEN' | 'BAR' | 'PIZZA'>().nullable().optional(),
  sentQty: yup.number().min(0).optional(),
  deliveredQty: yup.number().min(0).optional(),
  // Packs (tobos/cajas): `quantity` va EXPANDIDA a unidades y esto guarda
  // cuantas trae el pack, para poder mostrar "1 tobo" en vez de "12".
  presentationQty: yup.number().min(1).optional(),
  quantityLog: yup
    .array()
    .of(
      yup.object().shape({
        qty: yup.number().required(),
        at: yup.string().required(),
      }),
    )
    .optional(),
});

export const orderSchema = yup.object().shape({
  tableId: yup.string().nullable().defined(),
  waiterId: yup.string().nullable().defined(),
  customerAlias: yup.string().nullable().defined(),
  associateNumber: yup.string().nullable().defined(),
  sector: yup.string().nullable().defined(),
  customerId: yup.string().nullable().defined(),
  status: yup
    .mixed<OrderStatusEnum>()
    .oneOf(Object.values(OrderStatusEnum))
    .required()
    .defined(),
  items: yup.array().of(orderItemSchema).required().min(1).defined(),
  subtotal: yup.number().required().positive().defined(),
  serviceCharge: yup.number().required().min(0).defined(),
  tax: yup.number().required().min(0).defined(),
  total: yup.number().required().positive().defined(),
  // Cambia esta línea - elimina .defined() para hacer el campo opcional
  paymentMethod: yup
    .mixed<PaymentMethodEnum>()
    .oneOf(Object.values(PaymentMethodEnum))
    .nullable()
    .defined(),
  paymentStatus: yup
    .string<PaymentStatusEnum>()
    .oneOf(Object.values(PaymentStatusEnum))
    .required()
    .defined(),
  notes: yup.string().nullable().defined(),
});

export type OrderFormValues = yup.InferType<typeof orderSchema>;
