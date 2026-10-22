'use client';
import { useRouter } from 'next/navigation';
import { Supplier } from '@odin6/types';
import { useProducts, useUpdateProduct } from '@/hooks/useProducts';
import { useCreateSupplier, useUpdateSupplier } from '@/hooks/useSuppliers';
import {
  SupplierFormData,
  supplierSchema,
} from '@/shared/schemas/supplier-schema';
import { useEntityForm } from '@/shared/hooks/useEntityForm';

interface SupplierFormProps {
  initialData?: Supplier | null;
}

export default function SupplierForm({ initialData }: SupplierFormProps) {
  const router = useRouter();
  const { data: productsData = [] } = useProducts();
  const updateProduct = useUpdateProduct();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  const { form, handleFormSubmit } = useEntityForm<SupplierFormData>({
    schema: supplierSchema,
    defaultValues: {
      isActive: true,
      productIds: [],
    },
    initialData: initialData ?? undefined,
    onCreate: async (data: SupplierFormData) => {
      const supplierData = {
        ...data,
        createdAt: new Date(),
      };

      const createdSupplier = await createSupplier.mutateAsync(supplierData);

      // Actualizar productos con el proveedor
      if (createdSupplier && 'id' in createdSupplier) {
        const supplierId = createdSupplier.id as string;
        await updateProductsWithSupplier(supplierId, data.productIds || []);
      }

      router.push('/private/suppliers');
    },
    onUpdate: async (data: SupplierFormData) => {
      if (!initialData?.id) {
        return;
      }

      const supplierData = {
        ...data,
        createdAt: initialData.createdAt,
      };

      await updateSupplier.mutateAsync({
        id: initialData.id,
        data: supplierData,
      });

      // Actualizar productos con el proveedor
      await updateProductsWithSupplier(initialData.id, data.productIds || []);

      router.push('/private/suppliers');
    },
  });

  // Actualizar la relación proveedor-producto
  const updateProductsWithSupplier = async (
    supplierId: string,
    selectedProductIds: string[],
  ) => {
    // Para cada producto, actualizar la lista de proveedores
    for (const product of productsData) {
      const currentSupplierIds = product.supplierIds || [];
      const isSelected = selectedProductIds.includes(product.id);
      const shouldUpdate =
        (isSelected && !currentSupplierIds.includes(supplierId)) ||
        (!isSelected && currentSupplierIds.includes(supplierId));

      if (shouldUpdate) {
        const updatedSupplierIds = isSelected
          ? [...currentSupplierIds, supplierId]
          : currentSupplierIds.filter((id) => id !== supplierId);

        await updateProduct.mutateAsync({
          id: product.id,
          data: { supplierIds: updatedSupplierIds },
        });
      }
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Campo Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-dim">
            Nombre del Proveedor *
          </label>
          <input
            id="name"
            {...form.register('name')}
            className={`mt-1 block w-full border ${form.formState.errors.name ? 'border-danger' : 'border-line'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          />
          {form.formState.errors.name && (
            <p className="mt-1 text-sm text-danger">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        {/* Campo Persona de Contacto */}
        <div>
          <label
            htmlFor="contactName"
            className="block text-sm font-medium text-dim"
          >
            Persona de Contacto
          </label>
          <input
            id="contactName"
            {...form.register('contactName')}
            className="mt-1 block w-full border border-line rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand"
          />
        </div>

        {/* Campo Teléfono */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-dim">
            Teléfono
          </label>
          <input
            id="phone"
            {...form.register('phone')}
            className={`mt-1 block w-full border ${form.formState.errors.phone ? 'border-danger' : 'border-line'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          />
          {form.formState.errors.phone && (
            <p className="mt-1 text-sm text-danger">
              {form.formState.errors.phone.message}
            </p>
          )}
        </div>

        {/* Campo Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-dim">
            Email
          </label>
          <input
            type="email"
            id="email"
            {...form.register('email')}
            className={`mt-1 block w-full border ${form.formState.errors.email ? 'border-danger' : 'border-line'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand`}
          />
          {form.formState.errors.email && (
            <p className="mt-1 text-sm text-danger">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* Campo Dirección */}
        <div className="md:col-span-2">
          <label
            htmlFor="address"
            className="block text-sm font-medium text-dim"
          >
            Dirección
          </label>
          <input
            id="address"
            {...form.register('address')}
            className="mt-1 block w-full border border-line rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand focus:border-brand"
          />
        </div>

        {/* Campo Estado */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            {...form.register('isActive')}
            className="h-4 w-4 text-brand focus:ring-brand border-line rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-dim">
            Proveedor activo
          </label>
        </div>

        {/* Campo Productos */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-dim mb-2">
            Productos que provee
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {productsData.map((product) => (
              <div key={product.id} className="flex items-center">
                <input
                  type="checkbox"
                  id={`product-${product.id}`}
                  value={product.id}
                  {...form.register('productIds')}
                  className="h-4 w-4 text-brand focus:ring-brand border-line rounded"
                />
                <label
                  htmlFor={`product-${product.id}`}
                  className="ml-2 block text-sm text-dim"
                >
                  {product.name} ({product.sku || 'sin SKU'})
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.push('/private/suppliers')}
          className="bg-surface py-2 px-4 border border-line rounded-md shadow-sm text-sm font-medium text-dim hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand"
          disabled={form.formState.isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="bg-brand py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-on-brand hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:opacity-50"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {initialData ? 'Actualizando...' : 'Creando...'}
            </span>
          ) : initialData ? (
            'Actualizar'
          ) : (
            'Crear Proveedor'
          )}
        </button>
      </div>
    </form>
  );
}
