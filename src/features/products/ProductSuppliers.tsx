import { UseFormRegister } from 'react-hook-form';
import { Supplier } from '@odin6/types';
import { ProductFormData } from '@/features/types/schemaYup/productSchema';

interface ProductSuppliersProps {
  register: UseFormRegister<ProductFormData>;
  suppliers: Supplier[];
  disabled?: boolean;
}

export default function ProductSuppliers({
  register,
  suppliers,
  disabled,
}: ProductSuppliersProps) {
  return (
    <div
      className={`md:col-span-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <label className="block text-sm font-semibold mb-3 text-dim">
        Proveedores
      </label>
      {disabled && (
        <p className="text-sm text-accent bg-accent/10 border border-accent/20 rounded-lg p-2 mb-3">
          ⚠️ Los productos tipo &quot;Mixto&quot; no necesitan proveedores
          directos
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 2xl:grid-cols-2 gap-3">
        {suppliers.map((supplier) => (
          <label
            key={supplier.id}
            htmlFor={`supplier-${supplier.id}`}
            className="flex items-center space-x-3 p-3 rounded-xl border-2 border-line bg-page cursor-pointer transition-all duration-300 hover:border-brand/40 hover:bg-surface has-[:checked]:border-brand has-[:checked]:bg-brand/5 group"
          >
            <div className="relative flex items-center justify-center shrink-0">
              <input
                type="checkbox"
                id={`supplier-${supplier.id}`}
                value={supplier.id}
                {...register('supplierIds')}
                className="peer appearance-none w-5 h-5 border-2 border-line rounded bg-surface checked:bg-brand checked:border-brand transition-colors duration-200 focus:ring-2 focus:ring-brand/30 focus:outline-none cursor-pointer"
              />
              <svg
                className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <span
              className="text-sm font-semibold text-content flex-1 truncate group-has-[:checked]:text-brand transition-colors"
              title={supplier.name}
            >
              {supplier.name}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
