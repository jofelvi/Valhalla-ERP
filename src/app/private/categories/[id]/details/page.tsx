'use client';

import { useRouter } from 'next/navigation';
import { useCategory } from '@/hooks/useCategories';
import { Button } from '@/components/shared/button/Button';
import { Card, CardContent } from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { PRIVATE_ROUTES } from '@/shared';
import Link from 'next/link';
import { use, useEffect } from 'react';
import Loader from '@/components/shared/Loader/Loader';
import {
  ArrowLeft,
  Calendar,
  FileText,
  ImageIcon,
  Info,
  Pencil,
  Tag,
  ToggleRight,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CategoryDetailPage({ params }: PageProps) {
  const { id: paramId } = use(params);
  const router = useRouter();
  const { data: categoryData, isLoading } = useCategory(paramId);

  useEffect(() => {
    if (!isLoading && !categoryData) {
      router.push(PRIVATE_ROUTES.CATEGORIES);
    }
  }, [categoryData, isLoading, router]);

  if (isLoading) {
    return (
      <Loader
        fullScreen
        text="Cargando categoria..."
        size="lg"
        color="primary"
      />
    );
  }

  if (!categoryData) {
    return null;
  }

  const category = {
    ...categoryData,
    createdAt: categoryData.createdAt ? new Date(categoryData.createdAt) : null,
    updatedAt: categoryData.updatedAt ? new Date(categoryData.updatedAt) : null,
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="bg-surface/90 backdrop-blur-sm rounded-2xl border border-line/50 shadow-lg p-4 sm:p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href={PRIVATE_ROUTES.CATEGORIES}>
              <Button variant="ghost" size="sm" className="shrink-0 px-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 shrink-0">
              <Tag className="h-5 w-5 text-brand" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-content truncate">
                {category.name}
              </h1>
              <p className="text-dim text-xs">Detalle de categoria</p>
            </div>
            <Badge
              variant={category.isActive ? 'success' : 'secondary'}
              className="shrink-0"
            >
              {category.isActive ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>

          <div className="border-t border-line/50 mb-3" />

          <div className="flex flex-wrap gap-2">
            <Link href={PRIVATE_ROUTES.CATEGORIES_EDIT(category.id)}>
              <Button variant="outline" size="sm">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Editar
              </Button>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Descripcion */}
          <Card className="bg-surface/90 backdrop-blur-sm shadow-md border border-line/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center">
                  <FileText className="h-4 w-4 text-brand" />
                </div>
                <span className="text-sm font-semibold text-content">
                  Descripcion
                </span>
              </div>
              <p className="text-content leading-relaxed pl-10">
                {category.description || 'Sin descripcion'}
              </p>
            </CardContent>
          </Card>

          {/* Estado y Venta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-surface/90 backdrop-blur-sm shadow-md border border-line/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-ok/20 rounded-lg flex items-center justify-center">
                    <ToggleRight className="h-4 w-4 text-ok" />
                  </div>
                  <span className="text-sm font-semibold text-content">
                    Estado
                  </span>
                </div>
                <div className="pl-10">
                  <Badge
                    variant={category.isActive ? 'success' : 'destructive'}
                    className="text-xs"
                  >
                    {category.isActive
                      ? 'Activa y visible'
                      : 'Inactiva y oculta'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-surface/90 backdrop-blur-sm shadow-md border border-line/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                    <Info className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-sm font-semibold text-content">
                    Disponible para venta
                  </span>
                </div>
                <div className="pl-10">
                  <Badge
                    variant={category.isForSale ? 'success' : 'secondary'}
                    className="text-xs"
                  >
                    {category.isForSale
                      ? 'Si, se muestra en POS'
                      : 'No, solo inventario'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fechas */}
          {(category.createdAt || category.updatedAt) && (
            <Card className="bg-surface/90 backdrop-blur-sm shadow-md border border-line/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-brand" />
                  </div>
                  <span className="text-sm font-semibold text-content">
                    Fechas
                  </span>
                </div>
                <div className="pl-10 grid grid-cols-2 gap-3">
                  {category.createdAt && (
                    <div>
                      <p className="text-xs text-dim">Creada</p>
                      <p className="text-sm font-medium text-content">
                        {formatDate(category.createdAt)}
                      </p>
                    </div>
                  )}
                  {category.updatedAt && (
                    <div>
                      <p className="text-xs text-dim">Actualizada</p>
                      <p className="text-sm font-medium text-content">
                        {formatDate(category.updatedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Imagen */}
          {category.imageUrl && (
            <Card className="bg-surface/90 backdrop-blur-sm shadow-md border border-line/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-brand" />
                  </div>
                  <span className="text-sm font-semibold text-content">
                    Imagen
                  </span>
                </div>
                <div className="pl-10">
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="w-full max-w-md h-48 object-contain rounded-xl border border-line/50"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
