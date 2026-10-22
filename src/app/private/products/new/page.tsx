'use client';
import ProductForm from '@/features/products/ProductForm';
import { PRIVATE_ROUTES } from '@/shared';
import Link from 'next/link';
import { Button } from '@/components/shared/button/Button';
import { ArrowLeft, Package } from 'lucide-react';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';

export default function NewProductPage() {
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
          titulo="Nuevo Producto"
          subtitulo="Agrega un nuevo producto al catalogo"
        />

        <ProductForm isNew />
      </div>
    </div>
  );
}
