// features/categories/CategoryForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Category } from '@odin6/types';
import {
  CategoryFormValues,
  categorySchema,
} from '@/features/types/schemaYup/categorySchema';
import { uploadFile } from '@/services/uploads/uploadImage';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@/hooks/useCategories';
import { useToast } from '@/components/hooks/useToast';
import { useEntityForm } from '@/shared/hooks/useEntityForm';
import Image from 'next/image';
import { Input } from '@/components/shared/input/input';
import SearchableSelect from '@/components/shared/searchableSelect/SearchableSelect';
import { FormErrorSummary } from '@/components/shared/formErrorSummary/FormErrorSummary';
import { Button } from '@/components/shared/button/Button';
import {
  FiCheckSquare,
  FiImage,
  FiInfo,
  FiSave,
  FiShoppingBag,
} from 'react-icons/fi';
import { Grid3X3 } from 'lucide-react';

interface CategoryFormProps {
  initialData?: Category | null;
  isNew?: boolean;
  isFromProduct?: boolean;
  onClose?: () => void;
}

export function CategoryForm({
  initialData = null,
  isNew: _isNew = false,
  isFromProduct,
  onClose,
}: CategoryFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const { data: categories = [] } = useCategories();

  const { form, handleFormSubmit } = useEntityForm<CategoryFormValues>({
    schema: categorySchema,
    defaultValues: {
      name: '',
      description: null,
      isActive: true,
      isForSale: true,
      imageUrl: null,
      parentId: null,
    },
    initialData: initialData ?? undefined,
    onCreate: async (data: CategoryFormValues) => {
      let uploadedImageUrl: string | null = null;
      if (imageFile) {
        uploadedImageUrl = await uploadFile(imageFile, 'categories');
      }

      const finalImageUrl = uploadedImageUrl || data.imageUrl;

      const categoryToCreate: Omit<Category, 'id'> = {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        isForSale: data.isForSale,
        imageUrl: finalImageUrl,
        parentId: data.parentId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await createCategory.mutateAsync(categoryToCreate);
      toast.success({
        title: 'Categoria creada',
        description: `${data.name} se creo exitosamente`,
      });
      if (isFromProduct && onClose) {
        onClose();
      } else {
        router.push('/private/categories');
      }
    },
    onUpdate: async (data: CategoryFormValues) => {
      if (!initialData || !initialData.id) {
        return;
      }

      let uploadedImageUrl: string | null = null;
      if (imageFile) {
        uploadedImageUrl = await uploadFile(imageFile, 'categories');
      }

      const finalImageUrl = uploadedImageUrl || data.imageUrl;

      const categoryToUpdate: Category = {
        id: initialData.id,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        isForSale: data.isForSale,
        imageUrl: finalImageUrl,
        parentId: data.parentId ?? null,
        createdAt: initialData.createdAt,
        updatedAt: new Date(),
      };
      await updateCategory.mutateAsync({
        id: initialData.id,
        data: categoryToUpdate,
      });
      toast.success({
        title: 'Categoria actualizada',
        description: `${data.name} se actualizo exitosamente`,
      });
      if (isFromProduct && onClose) {
        onClose();
      } else {
        router.push('/private/categories');
      }
    },
  });

  // Sincronizar preview de imagen con initialData
  useEffect(() => {
    if (initialData?.imageUrl) {
      setImagePreview(initialData.imageUrl);
    }
  }, [initialData?.imageUrl]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmitHandler = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit(handleFormSubmit)(e);
  };

  return (
    <form
      onSubmit={onSubmitHandler}
      className="w-full space-y-6 bg-surface p-5 sm:p-8 lg:p-10 rounded-2xl shadow-sm border border-line"
    >
      <div className="flex items-center mb-2">
        <Grid3X3 className="w-8 h-8 text-brand mr-3" />
        <h2 className="text-2xl font-bold text-content">
          {!initialData ? 'Detalles de la Categoría' : 'Editar Categoría'}
        </h2>
      </div>

      <FormErrorSummary errors={form.formState.errors} />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 md:gap-x-8 lg:gap-x-10">
        {/* === COLUMNA IZQUIERDA: Textos y Datos === */}
        <div className="md:col-span-7 flex flex-col space-y-6">
          {/* Campo Nombre */}
          <div>
            <div className="flex items-center mb-1">
              <FiInfo className="text-dim mr-2" />
              <label className="block text-sm font-medium text-dim">
                Nombre *
              </label>
            </div>
            <Input
              id="name"
              type="text"
              placeholder="Ej: Bebidas y Alcohol"
              {...form.register('name')}
              error={form.formState.errors.name}
              className="w-full text-base"
            />
          </div>

          {/* Campo Descripción */}
          <div>
            <div className="flex items-center mb-2">
              <FiInfo className="text-dim mr-2" />
              <label className="block text-sm font-medium text-dim">
                Descripción Corta
              </label>
            </div>
            <textarea
              id="description"
              {...form.register('description')}
              rows={4}
              placeholder="Escribe para qué es esta categoría..."
              className="w-full px-4 py-3 bg-elevated/50 border border-line rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-content placeholder:text-dim/70 resize-none transition-all duration-200"
            />
          </div>

          {/* Categoría padre (opcional): convierte esta categoría en subcategoría */}
          <div>
            <div className="flex items-center mb-1">
              <FiInfo className="text-dim mr-2" />
              <label className="block text-sm font-medium text-dim">
                Categoría padre (opcional)
              </label>
            </div>
            <SearchableSelect
              id="parentId"
              // Solo categorías raíz pueden ser padre (sin anidar en profundidad),
              // y una categoría no puede ser su propio padre.
              options={categories
                .filter((c) => !c.parentId && c.id !== initialData?.id)
                .map((c) => ({ value: c.id, label: c.name }))}
              value={form.watch('parentId') || ''}
              onChange={(val) =>
                form.setValue('parentId', val || null, { shouldValidate: true })
              }
              placeholder="Ninguna (es una categoría principal)"
              searchPlaceholder="Buscar categoría padre..."
              className="w-full"
            />
            <p className="text-xs text-dim mt-1">
              Déjala vacía para una categoría principal. Al elegir un padre,
              esta pasa a ser una subcategoría usable por los insumos de ese
              padre.
            </p>
          </div>
        </div>

        {/* === COLUMNA DERECHA: Imagen === */}
        <div className="md:col-span-5 flex flex-col h-full">
          <div className="flex items-center mb-1">
            <FiImage className="text-dim mr-2" />
            <label className="block text-sm font-medium text-dim">
              Imagen Descriptiva
            </label>
          </div>
          <div className="flex flex-col space-y-2 mt-1 h-full flex-grow">
            <label className="flex flex-col items-center justify-center w-full bg-elevated/20 h-full min-h-[200px] border-2 border-dashed border-line rounded-xl cursor-pointer hover:bg-elevated/50 hover:border-brand/40 hover:text-brand transition-all duration-300 group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FiImage className="w-10 h-10 text-dim group-hover:text-brand/70 mb-3 transition-colors" />
                <p className="text-sm text-content text-center px-4">
                  <span className="font-semibold text-brand group-hover:text-brand-light transition-colors">
                    Haz clic para buscar
                  </span>{' '}
                  o arrastra una imagen
                </p>
                <p className="text-xs text-dim mt-1">
                  PNG, JPG (Recomendado 500x500px)
                </p>
              </div>
              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
            <input type="hidden" {...form.register('imageUrl')} />

            {imagePreview && (
              <div className="mt-2">
                <p className="text-sm text-dim mb-1">Vista previa:</p>
                <div className="border border-line rounded-lg overflow-hidden">
                  <Image
                    src={imagePreview}
                    alt="Vista previa de la categoría"
                    className="object-cover w-full"
                    width={512}
                    height={200}
                    style={{ maxHeight: '200px' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === PARTE INFERIOR: Campos de estado === */}
        <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 md:mt-4 pt-6 border-t border-line/50">
          {/* Estado activo */}
          <div className="bg-elevated/30 p-5 rounded-xl border border-line hover:border-brand/30 transition-colors">
            <div className="flex items-center mb-3">
              <FiCheckSquare className="text-dim mr-2" />
              <label className="block text-sm font-medium text-dim">
                Estado del Sistema
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                {...form.register('isActive')}
                className="h-5 w-5 text-brand rounded focus:ring-brand/50"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-dim">
                Categoría activa
              </label>
            </div>
          </div>

          {/* Nuevo campo: Disponible para venta */}
          <div className="bg-elevated/30 p-5 rounded-xl border border-line hover:border-brand/30 transition-colors">
            <div className="flex items-center mb-3">
              <FiShoppingBag className="text-dim mr-2" />
              <label className="block text-sm font-medium text-dim">
                Visible en Catálogo
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isForSale"
                {...form.register('isForSale')}
                className="h-5 w-5 text-brand rounded focus:ring-brand/50"
              />
              <label
                htmlFor="isForSale"
                className="ml-2 block text-sm text-dim"
              >
                Disponible para venta
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-6 mt-4 border-t border-line/50">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            isFromProduct && onClose
              ? onClose()
              : router.push('/private/categories')
          }
          disabled={createCategory.isPending || updateCategory.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          color="primary"
          disabled={createCategory.isPending || updateCategory.isPending}
          isLoading={createCategory.isPending || updateCategory.isPending}
          startIcon={<FiSave />}
        >
          {!initialData ? 'Crear Categoría' : 'Guardar Cambios'}
        </Button>
      </div>
    </form>
  );
}
