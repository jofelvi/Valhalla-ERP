export const dynamic = 'force-dynamic';
import { CategoryForm } from '@/features/categories/CategoryForm';
import BackIcon from '@/components/shared/BackButton/BackButton';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';

export default function NewCategoryPage() {
  return (
    <div className="bg-page min-h-screen">
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 flex flex-row items-center gap-4">
          <BackIcon href={PRIVATE_ROUTES.CATEGORIES} />
          <div className="flex flex-col">
            <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent mb-1">
              Nueva Categoría
            </h1>
            <p className="text-dim text-sm sm:text-base">
              Crea y organiza tus productos agrupándolos por familias
            </p>
          </div>
        </div>
        <div className="w-full">
          <CategoryForm isNew />
        </div>
      </div>
    </div>
  );
}
