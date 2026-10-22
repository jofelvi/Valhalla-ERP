import { notFound } from 'next/navigation';
import ProductDetailsClientComponent from '@/features/products/ProductDetailsClientComponent';
import { api } from '@/services/api/apiClient';
import { Product } from '@odin6/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const product = await api.get<Product>(`/api/products/${id}`);
    if (!product) return notFound();

    return <ProductDetailsClientComponent product={product} />;
  } catch {
    return notFound();
  }
}
