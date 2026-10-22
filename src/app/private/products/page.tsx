// app/products/page.tsx
'use client';
import { useMemo, useState } from 'react';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import Link from 'next/link';
import { FiPackage, FiPlus, FiSearch, FiX } from 'react-icons/fi';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import {
  useProducts,
  useDeleteProduct,
  productKeys,
} from '@/hooks/useProducts';
import { api } from '@/services/api/apiClient';
import { useCategories } from '@/hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { Product } from '@odin6/types';
import { DeleteConfirmationModal } from '@/features/categories/DeleteConfirmationModal';
import { Button } from '@/components/shared/button/Button';
import { EntityGrid } from '@/components/shared/EntityGrid/EntityGrid';
import { EmptyState } from '@/components/shared/EmptyState/EmptyState';
import '@/features/products/producs.css';
import { OrderGridSkeleton } from '@/features/purchaseOrders/order-skeleton';
import { PRIVATE_ROUTES } from '@/shared';
import { useProductFiltersStore } from '@/shared/store/useProductFiltersStore';
import RecalcularCostosModal from '@/features/products/components/RecalcularCostosModal';
import { CategoryFilterCards } from '@/features/products/components/CategoryFilterCards';
import { StockFilters } from '@/features/products/components/StockFilters';
import { ProductTypeFilters } from '@/features/products/components/ProductTypeFilters';
import { MargenFilters } from '@/features/products/components/MargenFilters';
import { useWarehouses, useWarehouseStock } from '@/hooks/useInventory';
import { useDisponibilidad } from '@/hooks/useDisponibilidad';
import { almacenParaEstacion } from '@/features/products/stockDeProducto';
import { margenPct } from '@/features/products/naturaleza';
import { ProductsTable } from '@/features/products/ProductsTable';
import { useToast } from '@/shared/hooks/useToast';
import { Panel } from '@/components/shared/panel/Panel';
import { CampoDeBusqueda } from '@/components/shared/busqueda/CampoDeBusqueda';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';

type ViewMode = 'grid' | 'table';

const VIEW_MODE_KEY = 'products-view-mode';
const PAGE_SIZE_TABLE = 20;
const PAGE_SIZE_GRID = 24;

export default function ProductsPage() {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  // "Recalcular" abre una vista previa: el servidor calcula en seco y nada se
  // guarda hasta que se confirma (antes se guardaba producto por producto).
  const [recalcularAbierto, setRecalcularAbierto] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'grid';
    }
    return 'grid';
  });
  const toast = useToast();
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useCategories();
  const { data: products = [] } = useProducts();
  const deleteProduct = useDeleteProduct();

  const {
    selectedCategory,
    stockFilter,
    productTypeFilter,
    margenFilter,
    sort,
    searchQuery,
    setSelectedCategory,
    setStockFilter,
    setProductTypeFilter,
    setMargenFilter,
    setSort,
    setSearchQuery,
    clearFilters,
  } = useProductFiltersStore();

  // ── Stock REAL, el que ve el mesonero ──────────────────────────────────────
  // `product.stock` lleva congelado desde la migración: nadie lo escribe y la
  // tabla mostraba ese número muerto. El bueno vive en warehouse_stocks, por
  // almacén, y se resuelve por la estación del producto.
  const { data: almacenes = [] } = useWarehouses();
  const listaAlmacenes = (
    almacenes as Array<{ id?: string; _id?: string; name: string }>
  ).map((a) => ({ id: String(a.id ?? a._id ?? ''), name: a.name }));
  const idDe = (estacion: string | null) =>
    almacenParaEstacion(estacion, listaAlmacenes)?.id ?? '';
  const stockCocina = useWarehouseStock(idDe('KITCHEN'));
  const stockBarra = useWarehouseStock(idDe('BAR'));
  const stockGeneral = useWarehouseStock(null as unknown as string);
  // Cuántas salen de cada preparado con el stock de hoy: es lo único que se
  // puede decir de una pizza o un plato, que no tienen fila de stock propia.
  const { porProducto: disponibilidad } = useDisponibilidad();

  const stockPorProducto = useMemo(() => {
    const mapa = new Map<string, { qty: number; almacen: string }>();
    const cargar = (filas: unknown, nombreAlmacen: string) => {
      for (const f of (filas as Array<{ productId: string; qty: number }>) ??
        []) {
        mapa.set(f.productId, { qty: f.qty, almacen: nombreAlmacen });
      }
    };
    cargar(stockGeneral.data, 'Depósito');
    cargar(stockCocina.data, 'Cocina');
    cargar(stockBarra.data, 'Barra');
    return mapa;
  }, [stockCocina.data, stockBarra.data, stockGeneral.data]);

  const hasActiveFilters =
    selectedCategory !== null ||
    stockFilter !== 'all' ||
    productTypeFilter !== 'all' ||
    margenFilter !== 'all' ||
    sort !== 'catalogo' ||
    searchQuery.length > 0;

  // Búsqueda por texto: nombre y descripción
  const searchedProducts = useBusqueda(products, searchQuery, [
    'name',
    (p) => p.description ?? undefined,
  ]);

  // Filtrar y ordenar productos por categoría, stock y otros filtros
  const filteredProducts = searchedProducts
    .filter((product) => {
      // Filtro por categoría
      const matchesCategory =
        !selectedCategory || product.categoryId === selectedCategory;

      // Filtro por stock — sobre el número del ALMACÉN, no sobre product.stock
      const real = stockPorProducto.get(product.id)?.qty;
      let matchesStock = true;
      if (stockFilter === 'outOfStock') {
        matchesStock = (real ?? 0) <= 0;
      } else if (stockFilter === 'lowStock') {
        const minStock = product.minStock || 5;
        matchesStock = (real ?? 0) > 0 && (real ?? 0) <= minStock;
      }

      // Filtro por naturaleza
      const matchesType =
        productTypeFilter === 'all' || product.type === productTypeFilter;

      // Filtro por ganancia — cinco bandas del margen en %
      let matchesMargen = true;
      if (margenFilter !== 'all') {
        const m = margenPct(product);
        if (margenFilter === 'sinCosto') matchesMargen = m === null;
        else if (m === null) matchesMargen = false;
        else if (margenFilter === 'negativo') matchesMargen = m <= 0;
        else if (margenFilter === 'critico') matchesMargen = m > 0 && m < 30;
        else if (margenFilter === 'sano') matchesMargen = m >= 30 && m <= 50;
        else if (margenFilter === 'excelente') matchesMargen = m > 50;
      }

      return matchesCategory && matchesStock && matchesType && matchesMargen;
    })
    .sort((a, b) => {
      if (sort === 'nombre') return a.name.localeCompare(b.name);

      if (sort === 'gananciaAsc' || sort === 'gananciaDesc') {
        const ma = margenPct(a);
        const mb = margenPct(b);
        // Los que no tienen costo cargado van SIEMPRE al final, en los dos
        // sentidos: no son "los peores" ni "los mejores", es que no se sabe.
        if (ma === null && mb === null) return a.name.localeCompare(b.name);
        if (ma === null) return 1;
        if (mb === null) return -1;
        return sort === 'gananciaAsc' ? ma - mb : mb - ma;
      }

      // Orden del catálogo: por categoría y luego por el nivel legacy.
      // Nullish-safe: un producto sin categoryId (dato incompleto) no debe
      // romper el sort y tumbar toda la página.
      if (!selectedCategory) {
        const catA = a.categoryId ?? '';
        const catB = b.categoryId ?? '';
        if (catA !== catB) return catA.localeCompare(catB);
      }
      return (a.nivel ?? 999) - (b.nivel ?? 999);
    });

  // Paginación
  const pageSize = viewMode === 'table' ? PAGE_SIZE_TABLE : PAGE_SIZE_GRID;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(
    () =>
      filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredProducts, safePage, pageSize],
  );

  // Reset página al cambiar filtros o vista
  const resetPage = () => setCurrentPage(1);

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await deleteProduct.mutateAsync(productToDelete.id);
        setDeleteModalOpen(false);
      } catch {
        // Error deleting product - consider showing user feedback
        // The delete modal will remain open for user to retry
      } finally {
        setProductToDelete(null);
      }
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
    resetPage();
  };

  const handleProductUpdate = async (id: string, updates: Partial<Product>) => {
    // Optimistic update: actualizar cache local inmediatamente
    const queryKey = productKeys.list(undefined);
    const previousProducts = qc.getQueryData<Product[]>(queryKey);

    qc.setQueryData<Product[]>(queryKey, (old) =>
      old?.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );

    try {
      await api.patch(`/api/products/${id}`, updates);
    } catch {
      // Revertir si falla
      qc.setQueryData(queryKey, previousProducts);
      toast.error({
        title: 'Error',
        description: 'No se pudo actualizar el producto',
      });
    }
  };

  if (isLoading) {
    return <OrderGridSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onCloseAction={() => setDeleteModalOpen(false)}
        onConfirmAction={confirmDelete}
        title={`¿Eliminar producto ${productToDelete?.name}?`}
        description="Esta acción no se puede deshacer. Todos los datos relacionados con este producto se perderán permanentemente."
        isLoading={deleteProduct.isPending}
      />

      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6">
        {/* Header */}
        <CabeceraDePantalla
          classNameFila="flex-wrap"
          icono={<FiPackage className="text-brand w-4 h-4" />}
          titulo="Productos"
          subtitulo={
            <>
              {filteredProducts.length}{' '}
              {filteredProducts.length === 1 ? 'producto' : 'productos'}
              {hasActiveFilters ? ' (filtrados)' : ''}
            </>
          }
          acciones={
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center bg-elevated rounded-lg p-0.5">
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-surface text-brand shadow-sm' : 'text-dim'}`}
                  title="Vista grilla"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleViewModeChange('table')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-surface text-brand shadow-sm' : 'text-dim'}`}
                  title="Vista tabla"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRecalcularAbierto(true)}
                className="h-8"
              >
                <Calculator className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Recalcular</span>
              </Button>
              <Link href={PRIVATE_ROUTES.PRODUCTS_NEW}>
                <Button size="sm" className="h-8">
                  <FiPlus className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Nuevo Producto</span>
                </Button>
              </Link>
            </div>
          }
        />

        {/* Toolbar */}
        <Panel className="p-3 mb-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Buscador */}
            <CampoDeBusqueda
              className="flex-1"
              valor={searchQuery}
              onCambio={setSearchQuery}
              placeholder="Buscar productos..."
              Icono={FiSearch}
              IconoLimpiar={FiX}
              classNameLimpiar="right-3 hover:text-dim"
              classNameIconoLimpiar="w-4 h-4"
            />

            {/* Filtro de tipo */}
            <div className="w-full sm:w-48">
              <ProductTypeFilters
                productTypeFilter={productTypeFilter}
                onProductTypeFilterChangeAction={setProductTypeFilter}
              />
            </div>

            {/* Filtro de stock */}
            <div className="w-full sm:w-56">
              <MargenFilters
                margenFilter={margenFilter}
                sort={sort}
                onMargenFilterChangeAction={(f) => {
                  setMargenFilter(f);
                  resetPage();
                }}
                onSortChangeAction={(o) => {
                  setSort(o);
                  resetPage();
                }}
              />

              <StockFilters
                stockFilter={stockFilter}
                onStockFilterChangeAction={setStockFilter}
              />
            </div>

            {/* Limpiar filtros */}
            {hasActiveFilters && (
              <Button
                onClick={clearFilters}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-sm text-dim hover:text-content hover:bg-elevated whitespace-nowrap"
              >
                <FiX className="w-4 h-4" />
                Limpiar
              </Button>
            )}
          </div>
        </Panel>

        {/* Filtro de categorías */}
        <CategoryFilterCards
          categories={categories}
          products={products}
          selectedCategory={selectedCategory}
          onCategorySelectAction={setSelectedCategory}
        />

        {/* Products Grid / Table */}
        <div className="bg-surface rounded-xl shadow-sm border border-line p-4 sm:p-6">
          {filteredProducts.length === 0 ? (
            <EmptyState
              title={
                hasActiveFilters
                  ? 'No se encontraron productos'
                  : 'No hay productos'
              }
              description={
                hasActiveFilters
                  ? 'No se encontraron productos con los filtros aplicados. Intenta con otros filtros o crea un nuevo producto.'
                  : 'Comienza creando tu primer producto para gestionar tu inventario.'
              }
              actionLabel={
                hasActiveFilters ? 'Limpiar filtros' : 'Crear Primer Producto'
              }
              actionHref={
                hasActiveFilters
                  ? PRIVATE_ROUTES.PRODUCTS
                  : PRIVATE_ROUTES.PRODUCTS_NEW
              }
              actionIcon={<FiPlus className="w-4 h-4" />}
              icon={<FiPackage className="w-12 h-12 text-dim" />}
            />
          ) : viewMode === 'table' ? (
            <ProductsTable
              stockPorProducto={stockPorProducto}
              porcionesPorProducto={disponibilidad}
              products={paginatedProducts}
              categories={categories}
              onDelete={handleDeleteClick}
              onProductUpdate={handleProductUpdate}
            />
          ) : (
            <EntityGrid<Product>
              items={paginatedProducts}
              getDetailPath={(id) => PRIVATE_ROUTES.PRODUCTS_DETAILS(id)}
              imageKey="imageUrl"
              nameKey="name"
              descriptionKey="description"
              statusKey="isActive"
              statusLabels={{
                true: 'Disponible',
                false: 'Inactivo',
              }}
              statusColors={{
                true: 'bg-ok/15 text-ok border-ok/20',
                false: 'bg-danger/15 text-danger border-danger/20',
              }}
              onDelete={handleDeleteClick}
              emptyState={<></>}
            />
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-line">
              <p className="text-xs text-dim">
                {(safePage - 1) * pageSize + 1}-
                {Math.min(safePage * pageSize, filteredProducts.length)} de{' '}
                {filteredProducts.length} productos
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - safePage) <= 1,
                  )
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                      acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    typeof p === 'string' ? (
                      <span
                        key={`dots-${idx}`}
                        className="px-1 text-xs text-dim"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={p}
                        variant={safePage === p ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(p)}
                        className="h-8 w-8 p-0 text-xs"
                      >
                        {p}
                      </Button>
                    ),
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, safePage + 1))
                  }
                  disabled={safePage >= totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <RecalcularCostosModal
        isOpen={recalcularAbierto}
        onClose={() => setRecalcularAbierto(false)}
      />
    </div>
  );
}
