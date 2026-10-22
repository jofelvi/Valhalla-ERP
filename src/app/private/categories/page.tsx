'use client';
import Link from '@/shared/ui/AppLink/AppLink';
import Image from 'next/image';
import { Button } from '@/components/shared/button/Button';
import { useCategories, useDeleteCategory } from '@/hooks/useCategories';
import { useState, useMemo } from 'react';
import { Category } from '@odin6/types';
import { useProducts } from '@/hooks/useProducts';
import Loader from '@/components/shared/Loader/Loader';
import { DeleteConfirmationModal } from '@/features/categories/DeleteConfirmationModal';
import { PRIVATE_ROUTES } from '@/shared';
import { Card, CardContent } from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import {
  Eye,
  EyeOff,
  Grid3X3,
  Package,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';

import Table from '@/components/shared/Table';
import { ColumnDef } from '@tanstack/react-table';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';
import { Panel } from '@/components/shared/panel/Panel';
import { CampoDeBusqueda } from '@/components/shared/busqueda/CampoDeBusqueda';
import { useBusqueda } from '@/shared/hooks/useBusqueda';

export default function CategoriesPage() {
  const { data: categories = [], isLoading: loading } = useCategories();
  const { data: allProducts = [] } = useProducts();
  const deleteCategory = useDeleteCategory();
  const [searchQuery, setSearchQuery] = useState('');
  const filtered = useBusqueda(categories, searchQuery, [
    'name',
    'description',
  ]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null,
  );

  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      counts[cat.id] = allProducts.filter(
        (p) => p.categoryId === cat.id,
      ).length;
    });
    return counts;
  }, [categories, allProducts]);

  const productsInCategory = useMemo(() => {
    if (!categoryToDelete) return [];
    return allProducts
      .filter((p) => p.categoryId === categoryToDelete.id)
      .map((p) => p.name);
  }, [categoryToDelete, allProducts]);

  const handleDeleteClick = (e: React.MouseEvent, category: Category) => {
    e.preventDefault();
    e.stopPropagation();
    setCategoryToDelete(category);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (categoryToDelete) {
      deleteCategory.mutate(categoryToDelete.id, {
        onSuccess: () => {
          setDeleteModalOpen(false);
          setCategoryToDelete(null);
        },
      });
    }
  };

  const activeCount = categories.filter((c) => c.isActive).length;
  const forSaleCount = categories.filter((c) => c.isForSale).length;

  const categoryColumns: ColumnDef<Category>[] = [
    {
      accessorKey: 'imageUrl',
      header: 'Imagen',
      cell: ({ row }) => (
        <div className="w-10 h-10 rounded-lg overflow-hidden relative bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          {row.original.imageUrl ? (
            <Image
              src={row.original.imageUrl}
              alt={row.original.name}
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <Grid3X3 className="w-5 h-5 text-brand" />
          )}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Categoria',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[120px]">
          <span className="font-bold text-content text-sm">
            {row.original.name}
          </span>
          {row.original.description && (
            <span className="text-xs text-dim truncate max-w-[200px]">
              {row.original.description}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'products',
      header: 'Productos',
      cell: ({ row }) => {
        const count = productCounts[row.original.id];
        return (
          <div className="flex items-center gap-1.5 bg-elevated rounded-full px-2.5 py-1 w-max border border-line/50">
            <Package className="w-3.5 h-3.5 text-brand" />
            <span className="text-xs font-semibold text-content">
              {count ?? 0}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <div className="flex gap-1.5 flex-wrap">
          <Badge
            variant={row.original.isActive ? 'success' : 'destructive'}
            className="text-[10px]"
          >
            {row.original.isActive ? 'Activa' : 'Inactiva'}
          </Badge>
          {row.original.isForSale && (
            <Badge variant="info" className="text-[10px]">
              En venta
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Link href={PRIVATE_ROUTES.CATEGORIES_DETAILS(row.original.id)}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-dim hover:text-brand"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          <Link href={PRIVATE_ROUTES.CATEGORIES_EDIT(row.original.id)}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-dim hover:text-brand"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-dim hover:text-danger"
            onClick={(e) => handleDeleteClick(e, row.original)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <Loader fullScreen text="Cargando categorias..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onCloseAction={() => setDeleteModalOpen(false)}
        onConfirmAction={confirmDelete}
        title={`Eliminar categoria ${categoryToDelete?.name}?`}
        description="Esta accion no se puede deshacer."
        isLoading={deleteCategory.isPending}
        items={productsInCategory}
      />

      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header */}
        <CabeceraDePantalla
          icono={<Grid3X3 className="h-4 w-4 text-brand" />}
          titulo="Categorias"
          subtitulo={
            <>
              {categories.length} categorias · {activeCount} activas ·{' '}
              {forSaleCount} en venta
            </>
          }
          acciones={
            <Link href={PRIVATE_ROUTES.CATEGORIES_NEW}>
              <Button size="sm" className="h-8">
                <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Nueva Categoria</span>
              </Button>
            </Link>
          }
        />

        {/* Search */}
        {categories.length > 0 && (
          <Panel className="p-3 mb-3">
            <CampoDeBusqueda
              valor={searchQuery}
              onCambio={setSearchQuery}
              placeholder="Buscar categoria..."
            />
          </Panel>
        )}

        {/* Content */}
        {filtered.length === 0 ? (
          <Panel className="text-center py-16">
            <Grid3X3 className="h-10 w-10 text-dim mx-auto mb-3" />
            <p className="text-content font-semibold mb-1">
              {searchQuery ? 'Sin resultados' : 'No hay categorias'}
            </p>
            <p className="text-dim text-sm mb-4">
              {searchQuery
                ? `No se encontro "${searchQuery}"`
                : 'Crea tu primera categoria'}
            </p>
            {!searchQuery && (
              <Link href={PRIVATE_ROUTES.CATEGORIES_NEW}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Crear Categoria
                </Button>
              </Link>
            )}
          </Panel>
        ) : (
          <>
            {/* Desktop: Table */}
            <div className="hidden md:block">
              <Table data={filtered} columns={categoryColumns} />
            </div>

            {/* Mobile: Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
              {filtered.map((category) => {
                const count = productCounts[category.id];
                return (
                  <Link
                    key={category.id}
                    href={PRIVATE_ROUTES.CATEGORIES_DETAILS(category.id)}
                  >
                    <Card className="bg-surface/90 backdrop-blur-sm border-line/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
                      <div className="relative h-32 bg-gradient-to-br from-page to-elevated overflow-hidden">
                        {category.imageUrl ? (
                          <Image
                            src={category.imageUrl}
                            alt={category.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="w-10 h-10 text-brand/30" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex gap-1">
                          <Badge
                            variant={
                              category.isActive ? 'success' : 'destructive'
                            }
                            className="text-[10px] shadow-sm"
                          >
                            {category.isActive ? (
                              <>
                                <Eye className="w-3 h-3 mr-0.5" />
                                Activa
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 mr-0.5" />
                                Inactiva
                              </>
                            )}
                          </Badge>
                          {category.isForSale && (
                            <Badge
                              variant="info"
                              className="text-[10px] shadow-sm"
                            >
                              <ShoppingBag className="w-3 h-3 mr-0.5" />
                              Venta
                            </Badge>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDeleteClick(e, category)}
                          className="absolute top-2 right-2 bg-surface/90 hover:bg-danger/10 rounded-lg p-1.5 shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-danger" />
                        </button>
                      </div>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-content text-sm truncate">
                              {category.name}
                            </h3>
                            {category.description && (
                              <p className="text-dim text-xs mt-0.5 line-clamp-1">
                                {category.description}
                              </p>
                            )}
                          </div>
                          {count !== undefined && (
                            <div className="shrink-0 bg-elevated rounded-lg px-2 py-1 text-center border border-line/50">
                              <p className="text-sm font-bold text-content leading-tight">
                                {count}
                              </p>
                              <p className="text-[9px] text-dim">prod.</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
