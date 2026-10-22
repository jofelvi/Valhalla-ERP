// Componente que muestra mensaje cuando no hay items en la orden
'use client';

interface EmptyItemsMessageProps {
  selectedSupplier: string | null;
}

/**
 * Mensaje para cuando no hay items agregados a la orden
 */
export function EmptyItemsMessage({
  selectedSupplier,
}: EmptyItemsMessageProps) {
  return (
    <div className="text-center py-8 bg-gradient-to-br from-elevated to-page rounded-xl border border-line">
      <div className="w-16 h-16 bg-gradient-to-br from-elevated to-elevated rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8 text-dim"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <h4 className="text-lg font-semibold text-dim mb-2">
        No hay productos agregados
      </h4>
      <p className="text-sm text-dim mb-4">
        Comienza agregando productos a tu orden de compra
      </p>
      {!selectedSupplier && (
        <p className="text-xs text-accent bg-accent/15 px-3 py-1 rounded-full inline-block">
          ⚠️ Primero selecciona un proveedor
        </p>
      )}
    </div>
  );
}
