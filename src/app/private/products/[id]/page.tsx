'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import ProductForm from '@/features/products/ProductForm';
import { useProduct } from '@/hooks/useProducts';
import { PRIVATE_ROUTES } from '@/shared';
import Loader from '@/components/shared/Loader/Loader';
import Link from 'next/link';
import { Button } from '@/components/shared/button/Button';
import { ArrowLeft, Package } from 'lucide-react';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductEditPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: productData, isLoading } = useProduct(id);

  if (isLoading) {
    return (
      <Loader
        fullScreen
        text="Cargando producto..."
        size="lg"
        color="primary"
      />
    );
  }

  if (!productData) {
    router.push(PRIVATE_ROUTES.PRODUCTS);
    return null;
  }

  const product = {
    ...productData,
    createdAt: productData.createdAt ? new Date(productData.createdAt) : null,
    updatedAt: productData.updatedAt ? new Date(productData.updatedAt) : null,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <CabeceraDePantalla
          antes={
            <Link href={PRIVATE_ROUTES.PRODUCTS}>
              <Button variant="ghost" size="sm" className="shrink-0 px-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          }
          icono={<Package className="h-4 w-4 text-brand" />}
          titulo={<>Editar: {product.name}</>}
          classNameTitulo="truncate"
          subtitulo="Modificar datos del producto"
        />

        <ProductForm initialData={product} isNew={false} />
      </div>
    </div>
  );
}
