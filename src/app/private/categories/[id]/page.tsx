'use client';

import { CategoryForm } from '@/features/categories/CategoryForm';
import { useCategory } from '@/hooks/useCategories';
import { useRouter } from 'next/navigation';
import { PRIVATE_ROUTES } from '@/shared';
import { use, useEffect } from 'react';
import Loader from '@/components/shared/Loader/Loader';
import Link from 'next/link';
import { Button } from '@/components/shared/button/Button';
import { ArrowLeft, Tag } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CategoryEditPage({ params }: PageProps) {
  const { id: paramId } = use(params);
  const router = useRouter();
  const { data: category, isLoading } = useCategory(paramId);

  useEffect(() => {
    if (!isLoading && !category) {
      router.push(PRIVATE_ROUTES.CATEGORIES);
    }
  }, [category, isLoading, router]);

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

  if (!category) {
    return null;
  }

  const categoryData = {
    ...category,
    createdAt: category.createdAt ? new Date(category.createdAt) : null,
    updatedAt: category.updatedAt ? new Date(category.updatedAt) : null,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="bg-surface/90 backdrop-blur-sm rounded-2xl border border-line/50 shadow-lg p-4 sm:p-5 mb-6">
          <div className="flex items-center gap-3">
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
                Editar: {category.name}
              </h1>
              <p className="text-dim text-xs">
                Modificar datos de la categoria
              </p>
            </div>
          </div>
        </div>

        <CategoryForm initialData={categoryData} />
      </div>
    </div>
  );
}
