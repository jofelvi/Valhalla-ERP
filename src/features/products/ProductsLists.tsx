'use client';
import Link from '@/shared/ui/AppLink/AppLink';
import { useProducts } from '@/hooks/useProducts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import Image from 'next/image';
import { Package, Plus } from 'lucide-react';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared';

export default function ProductsLists() {
  const { data: products = [], isLoading } = useProducts();

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">Cargando productos...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Productos</h1>
        <Link
          href={PRIVATE_ROUTES.PRODUCTS_NEW}
          className="bg-brand text-on-brand px-4 py-2 rounded hover:bg-brand/90"
        >
          Nuevo Producto
        </Link>
      </div>

      <div className="bg-surface shadow rounded-lg overflow-hidden">
        {/* Categories Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Link
                key={product.id}
                href={PRIVATE_ROUTES.PRODUCTS_EDIT(product.id)}
                className="group"
              >
                <Card className="h-full cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-0 shadow-sm">
                  {/* Image Section */}
                  <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg overflow-hidden">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name || 'Imagen de categoría'}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-gradient-to-br from-page to-brand/10">
                        <Package className="w-16 h-16 text-brand" />
                      </div>
                    )}

                    {/* Status Badge Overlay */}
                    <div className="absolute top-3 right-3">
                      <Badge
                        variant={product.isActive ? 'default' : 'secondary'}
                        className={`
                                                    shadow-sm font-medium text-xs
                                                    ${
                                                      product.isActive
                                                        ? 'bg-ok/15 text-ok border-ok/20'
                                                        : 'bg-danger/15 text-danger border-danger/20'
                                                    }
                                                `}
                      >
                        {product.isActive ? 'Disponible' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>

                  {/* Content Section */}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-content group-hover:text-brand transition-colors duration-200">
                      {product.name}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <p className="text-dim text-sm leading-relaxed line-clamp-2">
                      {product.description || 'Sin descripción disponible'}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 bg-elevated rounded-full flex items-center justify-center mb-6">
              <Package className="w-12 h-12 text-dim" />
            </div>
            <h3 className="text-xl font-semibold text-content mb-2">
              No hay categorías
            </h3>
            <p className="text-dim mb-6 max-w-md">
              Comienza creando tu primera categoría para organizar mejor tu
              inventario.
            </p>
            <Link href={PRIVATE_ROUTES.CATEGORIES_NEW}>
              <Button className="bg-brand hover:bg-brand/90 text-on-brand">
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Categoría
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
