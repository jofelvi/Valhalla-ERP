'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChefHat, Loader2 } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/modelTypes/product';
import { UserRoleEnum } from '@/shared';
import { EmptyState } from '@/components/shared/EmptyState/EmptyState';
import RecipeEditorModal from '@/features/recipes/RecipeEditorModal';
import { RecipeAuditSection } from '@/features/recipes/components/RecipeAuditSection';
import { auditRecetas } from '@/features/recipes/utils/auditRecipes';

// Cada estación carga SOLO las recetas de su mundo: barra bebidas y tragos,
// pizza pizzas, cocina platos. El backend valida lo mismo al guardar.
const STATION_BY_ROLE: Partial<Record<UserRoleEnum, string>> = {
  [UserRoleEnum.KITCHEN]: 'KITCHEN',
  [UserRoleEnum.BAR]: 'BAR',
  [UserRoleEnum.PIZZA]: 'PIZZA',
};
const STATION_LABEL: Record<string, string> = {
  KITCHEN: 'Cocina',
  BAR: 'Barra',
  PIZZA: 'Pizza',
};

export default function RecipesPage() {
  const { data: session, status } = useSession();
  const { data: products, isLoading } = useProducts();
  const [editando, setEditando] = useState<Product | null>(null);

  const rol = session?.user?.role as UserRoleEnum | undefined;
  const estacionDelRol = rol ? STATION_BY_ROLE[rol] : undefined;
  const esAdmin = rol === UserRoleEnum.ADMIN || rol === UserRoleEnum.MANAGER;

  // Filtrar productos por estación (rol del usuario)
  const productosDelRol = useMemo(() => {
    if (!products) return [];

    let lista = products.filter(
      (p) => p.isActive !== false && p.isForSale !== false,
    );

    if (estacionDelRol) {
      lista = lista.filter(
        (p) => String(p.station ?? '').toUpperCase() === estacionDelRol,
      );
    }

    return lista;
  }, [products, estacionDelRol]);

  // Crear mapa para rápida búsqueda de todos los productos
  const allProductsMap = useMemo(() => {
    if (!products) return new Map<string, Product>();
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  // Auditar productos
  const sections = useMemo(() => {
    if (!productosDelRol) return [];
    return auditRecetas(productosDelRol, allProductsMap, esAdmin);
  }, [productosDelRol, allProductsMap, esAdmin]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-surface rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <EmptyState
        title="Acceso denegado"
        description="Debes iniciar sesión para ver esta página"
        icon="🔒"
        actionLabel=""
        actionHref=""
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-brand/15">
            <ChefHat className="w-6 h-6 text-brand" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-content">
              Recetas
              {estacionDelRol ? ` · ${STATION_LABEL[estacionDelRol]}` : ''}
            </h1>
            <p className="text-xs sm:text-sm text-dim">
              Qué sale del almacén cuando se vende cada cosa.
            </p>
          </div>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-16 text-dim border rounded-lg bg-surface/50">
          <Loader2 className="w-10 h-10 mx-auto mb-3 opacity-40 animate-spin" />
          <p>Cargando auditoría de recetas…</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <RecipeAuditSection
              key={section.titulo}
              section={section}
              onEditProduct={setEditando}
            />
          ))}
        </div>
      )}

      {editando && (
        <RecipeEditorModal
          product={editando}
          products={products ?? []}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}
