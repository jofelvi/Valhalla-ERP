'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import ProductDetailsClientComponent from '@/features/products/ProductDetailsClientComponent';
import { useProduct } from '@/hooks/useProducts';
import Loader from '@/components/shared/Loader/Loader';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Se carga en el navegador y no en el servidor: la sesion de next-auth vive en
// el cliente, y desde el servidor la API respondia 401 sin token, que el
// catch convertia en un 404 para cualquier producto.
export default function ProductDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: product, isLoading } = useProduct(id);

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

  if (!product) notFound();

  return <ProductDetailsClientComponent product={product} />;
}
