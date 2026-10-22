'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Product } from '@odin6/types';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts, useUpdateProduct } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { PRIVATE_ROUTES, ProductTypeEnum } from '@/shared';
import { Card, CardContent } from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { calculateMixedProductCost } from '@/features/products/productsUtils';
import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  Box,
  Calendar,
  ChefHat,
  DollarSign,
  FileText,
  ImageIcon,
  Layers,
  Package,
  Pencil,
  Pizza,
  ShoppingBag,
  Tag,
  TrendingUp,
  Truck,
  Wine,
} from 'lucide-react';
import { Panel } from '@/components/shared/panel/Panel';

interface ProductDetailsClientComponentProps {
  product: Product;
}

export default function ProductDetailsClientComponent({
  product: initialProduct,
}: ProductDetailsClientComponentProps) {
  const { data: suppliers = [] } = useSuppliers();
  const { data: allProducts = [] } = useProducts();
  const { data: categories = [] } = useCategories();
  const updateProduct = useUpdateProduct();

  const product = useMemo(() => {
    const p = { ...initialProduct };
    if (p.type === ProductTypeEnum.MIXED && p.ingredients?.length) {
      const correctCost = calculateMixedProductCost(p.ingredients, allProducts);
      if (Math.abs((p.cost || 0) - correctCost) > 0.01) {
        updateProduct.mutateAsync({
          id: p.id,
          data: { cost: correctCost, updatedAt: new Date() },
        });
        p.cost = correctCost;
      }
    }
    return p;
  }, [initialProduct, allProducts, updateProduct]);

  const validSuppliers = useMemo(() => {
    if (!product.supplierIds?.length) return [];
    return product.supplierIds
      .map((id) => suppliers.find((s) => s.id === id))
      .filter(Boolean) as typeof suppliers;
  }, [product.supplierIds, suppliers]);

  const categoryName =
    categories.find((c) => c.id === product.categoryId)?.name ||
    'Sin categoria';

  const margin =
    product.cost && product.cost > 0 && product.price > 0
      ? ((product.price - product.cost) / product.price) * 100
      : null;

  const isLowStock = product.minStock && product.stock <= product.minStock;

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const StationIcon =
    product.station === 'KITCHEN'
      ? ChefHat
      : product.station === 'BAR'
        ? Wine
        : product.station === 'PIZZA'
          ? Pizza
          : Layers;
  const stationLabel =
    product.station === 'KITCHEN'
      ? 'Cocina'
      : product.station === 'BAR'
        ? 'Barra'
        : product.station === 'PIZZA'
          ? 'Pizza'
          : 'Sin asignar';

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 max-w-7xl">
        {/* Header */}
        <Panel className="p-3.5 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href={PRIVATE_ROUTES.PRODUCTS}>
              <Button variant="ghost" size="sm" className="shrink-0 px-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-10 h-10 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-brand" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-content truncate">
                {product.name}
              </h1>
              <p className="text-dim text-xs">
                {categoryName} ·{' '}
                {product.type === ProductTypeEnum.MIXED ? 'Compuesto' : 'Base'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={product.isActive ? 'success' : 'secondary'}>
                {product.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
              <Link href={PRIVATE_ROUTES.PRODUCTS_EDIT(product.id)}>
                <Button variant="outline" size="sm">
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </Button>
              </Link>
            </div>
          </div>
        </Panel>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Card className="bg-surface/90 border-line/50 shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-ok/15 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-3.5 w-3.5 text-ok" />
                </div>
                <span className="text-xs text-dim">Precio</span>
              </div>
              <p className="text-xl font-bold text-ok">
                ${product.price.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface/90 border-line/50 shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-brand/15 rounded-lg flex items-center justify-center">
                  <Tag className="h-3.5 w-3.5 text-brand" />
                </div>
                <span className="text-xs text-dim">Costo</span>
              </div>
              <p className="text-xl font-bold text-content">
                {product.cost != null ? `$${product.cost.toFixed(2)}` : '—'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface/90 border-line/50 shadow-sm">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-accent/15 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                </div>
                <span className="text-xs text-dim">Margen</span>
              </div>
              <p
                className={`text-xl font-bold ${margin !== null && margin >= 0 ? 'text-ok' : margin !== null ? 'text-danger' : 'text-dim'}`}
              >
                {margin !== null ? `${margin.toFixed(0)}%` : '—'}
              </p>
            </CardContent>
          </Card>

          <Card
            className={`bg-surface/90 shadow-sm ${isLowStock ? 'border-danger/40' : 'border-line/50'}`}
          >
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${isLowStock ? 'bg-danger/15' : 'bg-brand/15'}`}
                >
                  <Box
                    className={`h-3.5 w-3.5 ${isLowStock ? 'text-danger' : 'text-brand'}`}
                  />
                </div>
                <span className="text-xs text-dim">Stock</span>
              </div>
              <p
                className={`text-xl font-bold ${isLowStock ? 'text-danger' : 'text-content'}`}
              >
                {product.stock}
              </p>
              {isLowStock && (
                <p className="text-[10px] text-danger mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Min: {product.minStock}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-3">
            {/* Descripcion */}
            {product.description && (
              <Card className="bg-surface/90 border-line/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-brand/15 rounded-lg flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <span className="text-sm font-bold text-content">
                      Descripcion
                    </span>
                  </div>
                  <p className="text-sm text-content leading-relaxed pl-9">
                    {product.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Detalles */}
            <Card className="bg-surface/90 border-line/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-brand/15 rounded-lg flex items-center justify-center">
                    <Package className="h-3.5 w-3.5 text-brand" />
                  </div>
                  <span className="text-sm font-bold text-content">
                    Informacion del Producto
                  </span>
                </div>
                <div className="pl-9 grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className="text-xs text-dim">Categoria</p>
                    <p className="text-sm font-medium text-content">
                      {categoryName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-dim">Tipo</p>
                    <p className="text-sm font-medium text-content">
                      {product.type === ProductTypeEnum.MIXED
                        ? 'Compuesto'
                        : 'Base'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-dim">Estacion</p>
                    <div className="flex items-center gap-1.5">
                      <StationIcon className="w-3.5 h-3.5 text-brand" />
                      <p className="text-sm font-medium text-content">
                        {stationLabel}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-dim">Moneda</p>
                    <p className="text-sm font-medium text-content">
                      {product.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-dim">Para venta</p>
                    <Badge
                      variant={product.isForSale ? 'success' : 'secondary'}
                      className="text-xs mt-0.5"
                    >
                      {product.isForSale ? 'Si' : 'No'}
                    </Badge>
                  </div>
                  {product.presentation && (
                    <div>
                      <p className="text-xs text-dim">Presentacion</p>
                      <p className="text-sm font-medium text-content">
                        {product.presentation}
                        {product.presentationQuantity &&
                        product.presentationQuantity > 1
                          ? ` (x${product.presentationQuantity})`
                          : ''}
                      </p>
                    </div>
                  )}
                  {product.sku && (
                    <div>
                      <p className="text-xs text-dim">SKU</p>
                      <p className="text-sm font-mono text-content">
                        {product.sku}
                      </p>
                    </div>
                  )}
                  {product.barcode && (
                    <div>
                      <p className="text-xs text-dim">Codigo de Barras</p>
                      <div className="flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-dim" />
                        <p className="text-sm font-mono text-content">
                          {product.barcode}
                        </p>
                      </div>
                    </div>
                  )}
                  {product.minStock != null && (
                    <div>
                      <p className="text-xs text-dim">Stock Minimo</p>
                      <p className="text-sm font-medium text-content">
                        {product.minStock} uds
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Ingredientes (productos compuestos) */}
            {product.type === ProductTypeEnum.MIXED &&
              product.ingredients &&
              product.ingredients.length > 0 && (
                <Card className="bg-surface/90 border-line/50 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 bg-accent/15 rounded-lg flex items-center justify-center">
                        <Layers className="h-3.5 w-3.5 text-accent" />
                      </div>
                      <span className="text-sm font-bold text-content">
                        Ingredientes ({product.ingredients.length})
                      </span>
                    </div>
                    <div className="pl-9 space-y-2">
                      {product.ingredients.map((ing, idx) => {
                        const ingProduct = allProducts.find(
                          (p) => p.id === ing.productId,
                        );
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5 px-3 bg-elevated/50 rounded-lg"
                          >
                            <span className="text-sm text-content">
                              {ingProduct?.name || ing.productId}
                            </span>
                            <div className="flex items-center gap-3 text-xs text-dim">
                              <span>{ing.quantity} uds</span>
                              {ingProduct && (
                                <span>
                                  $
                                  {(ingProduct.price * ing.quantity).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            {/* Imagen */}
            {product.imageUrl && (
              <Card className="bg-surface/90 border-line/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-brand/15 rounded-lg flex items-center justify-center">
                      <ImageIcon className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <span className="text-sm font-bold text-content">
                      Imagen
                    </span>
                  </div>
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full rounded-xl object-cover border border-line/50"
                  />
                </CardContent>
              </Card>
            )}

            {/* Proveedores */}
            <Card className="bg-surface/90 border-line/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-brand/15 rounded-lg flex items-center justify-center">
                    <Truck className="h-3.5 w-3.5 text-brand" />
                  </div>
                  <span className="text-sm font-bold text-content">
                    Proveedores
                  </span>
                </div>
                {validSuppliers.length > 0 ? (
                  <div className="space-y-2">
                    {validSuppliers.map((supplier) => (
                      <Link
                        key={supplier.id}
                        href={PRIVATE_ROUTES.SUPPLIERS_EDIT(supplier.id)}
                        className="block"
                      >
                        <div className="p-3 bg-elevated/50 rounded-lg hover:bg-elevated transition-colors">
                          <p className="text-sm font-semibold text-brand">
                            {supplier.name}
                          </p>
                          {supplier.phone && (
                            <p className="text-xs text-dim mt-0.5">
                              {supplier.phone}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <ShoppingBag className="w-8 h-8 text-dim mx-auto mb-2" />
                    <p className="text-xs text-dim">
                      Sin proveedores asociados
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fechas */}
            {(product.createdAt || product.updatedAt) && (
              <Card className="bg-surface/90 border-line/50 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-brand/15 rounded-lg flex items-center justify-center">
                      <Calendar className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <span className="text-sm font-bold text-content">
                      Fechas
                    </span>
                  </div>
                  <div className="pl-9 space-y-2">
                    {product.createdAt && (
                      <div>
                        <p className="text-xs text-dim">Creado</p>
                        <p className="text-sm font-medium text-content">
                          {formatDate(product.createdAt)}
                        </p>
                      </div>
                    )}
                    {product.updatedAt && (
                      <div>
                        <p className="text-xs text-dim">Actualizado</p>
                        <p className="text-sm font-medium text-content">
                          {formatDate(product.updatedAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
