/**
 * Supply Chain Supplier Service using NestJS API
 */

import { Supplier } from '@odin6/types';
import { Product } from '@odin6/types';
import { api } from '@/services/api/apiClient';

export const getActiveSuppliers = async (): Promise<Supplier[]> => {
  return await api.get<Supplier[]>('/api/suppliers', { active: 'true' });
};

export const getSuppliersByProduct = async (
  productId: string,
): Promise<Supplier[]> => {
  return await api.get<Supplier[]>('/api/suppliers', { productId });
};

export const getProductsBySupplier = async (
  supplierId: string,
): Promise<Product[]> => {
  return await api.get<Product[]>('/api/products', { supplierId });
};

export const handleSupplierDeletion = async (supplierId: string) => {
  const products = await getProductsBySupplier(supplierId);

  await Promise.all(
    products.map(async (product) => {
      const updatedSupplierIds =
        product.supplierIds?.filter((id) => id !== supplierId) || [];
      await api.patch(`/api/products/${product.id}`, {
        supplierIds: updatedSupplierIds,
      });
    }),
  );
};
