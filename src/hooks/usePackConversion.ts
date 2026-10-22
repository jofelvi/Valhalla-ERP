import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Order } from '@odin6/types';
import { orderKeys } from './useOrders';

/**
 * Conversion a pack (tobo / media caja / caja) — la calcula el SERVIDOR.
 *
 * Antes la web tenia su propia tabla de packs con los precios cableados en
 * `@odin6/types`, y esa tabla se habia quedado atras: decia que el tobo de
 * lata costaba $11 cuando la ficha del producto dice $14. Como el servidor
 * pisa el precio del cliente con el del catalogo en cada PATCH, la pantalla
 * habria mostrado un precio y la cuenta habria dicho otro.
 *
 * Ahora la web pregunta y no calcula. Cambiar el precio de un tobo es editar
 * la ficha del producto, no recompilar nada.
 */

export interface OpcionConversion {
  sourceProductId: string;
  sourceProductName: string;
  targetPackId: string;
  packName: string;
  /** Unidades que trae el pack. */
  size: number;
  /** Precio de catalogo. */
  packPrice: number;
  numPacksPossible: number;
  currentDeliveredQty: number;
  savingsUsd: number;
}

export const packConversionKeys = {
  all: ['packConversion'] as const,
  opciones: (orderId: string) =>
    [...packConversionKeys.all, 'opciones', orderId] as const,
};

/**
 * Opciones disponibles para esta orden. El endpoint NO convierte nada: ofrece.
 *
 * Solo se pregunta si hay una orden persistida. Se calcula sobre lo ENTREGADO,
 * asi que un carrito que todavia no salio de la barra no ofrece nada, y eso es
 * a proposito: si el cliente quiere un tobo, se pide el tobo del menu.
 */
export function useOpcionesDeConversion(orderId?: string) {
  return useQuery({
    queryKey: packConversionKeys.opciones(orderId ?? ''),
    queryFn: () =>
      api.get<{ opciones: OpcionConversion[] }>(
        `/api/orders/${orderId}/opciones-conversion`,
      ),
    enabled: Boolean(orderId),
    select: (data) => data.opciones,
  });
}

/**
 * Aplica UNA conversion elegida por la persona.
 *
 * No se manda el precio: el servidor lo saca del catalogo. Mandarlo seria
 * volver al problema que esto viene a cerrar.
 */
export function useConvertirPack() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      sourceProductId,
      targetPackId,
      packsToConvert,
    }: {
      orderId: string;
      sourceProductId: string;
      targetPackId: string;
      packsToConvert: number;
    }) =>
      api.post<Order>(`/api/orders/${orderId}/convertir-pack`, {
        sourceProductId,
        targetPackId,
        packsToConvert,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(vars.orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
      qc.invalidateQueries({ queryKey: orderKeys.pos() });
      qc.invalidateQueries({
        queryKey: packConversionKeys.opciones(vars.orderId),
      });
    },
  });
}
