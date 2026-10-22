'use client';

import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import React, { useEffect, useState } from 'react';
import { Product } from '@odin6/types';
import {
  useCategories,
  useSuppliers,
  useProducts,
  useCreateProduct,
  useUpdateProduct,
} from '@/hooks';
import { ProductPresentationEnum, ProductTypeEnum } from '@/shared';
import { uploadFile } from '@/services/uploads/uploadImage';
import {
  ProductFormData,
  productSchema,
} from '../types/schemaYup/productSchema';
import {
  Info,
  DollarSign,
  ListChecks,
  Box,
  Image as ImageIcon,
  Truck,
  Tag,
  Package,
} from 'lucide-react';
import ProductSuppliers from '@/features/products/ProductSuppliers';
import ProductImageUpload from '@/features/products/ProductImageUpload';
import ProductInventory from './ProductInventory';
import {
  useWarehouses,
  useWarehouseStock,
  useCreateCount,
} from '@/hooks/useInventory';
import { almacenParaEstacion, diferenciaEsGrande } from './stockDeProducto';
import ProductPricing from '@/features/products/ProductPricing';
import ProductPresentation from './ProductPresentation';
import ProductBasicInfo from './ProductBasicInfo';
import ProductTypeSelector from './ProductTypeSelector';
import FormActions from '@/features/forms/FormActions';
import CategoryModal from '@/features/products/CategoryModal';
import ConteoModal from './ConteoModal';
import IngredientsManager from '@/features/products/IngredientsManager';
import {
  calculateMixedProductCost,
  mapFormDataToProduct,
  mapProductToFormData,
} from '@/features/products/productsUtils';
import { FormErrorSummary } from '@/components/shared/formErrorSummary/FormErrorSummary';
import Loader from '@/components/shared/Loader/Loader';
import { PRIVATE_ROUTES } from '@/shared';
import { translateApiError } from '@/shared/utils/apiErrors';
import { useToast } from '@/components/hooks/useToast';

const FormSection = ({
  title,
  icon: Icon,
  children,
  className = '',
  noGrid = false,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  noGrid?: boolean;
}) => (
  <div
    className={`bg-surface/90 backdrop-blur-sm border border-line/50 rounded-xl shadow-sm ${className}`}
  >
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line/40">
      {Icon && (
        <div className="w-7 h-7 bg-brand/15 rounded-lg flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-brand" strokeWidth={2.5} />
        </div>
      )}
      <h3 className="text-sm font-bold text-content">{title}</h3>
    </div>
    <div
      className={`px-4 py-4 ${noGrid ? 'flex flex-col space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}`}
    >
      {children}
    </div>
  </div>
);

interface ProductFormProps {
  initialData?: Product | null;
  isNew?: boolean;
}

export default function ProductForm({
  initialData = null,
  isNew = false,
}: ProductFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [mostrarConteo, setMostrarConteo] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { data: categories = [], isLoading: categoriesLoading } =
    useCategories();
  const { data: suppliers = [] } = useSuppliers();
  const { data: productsData = [] } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    // El schema usa `.when('type', ...)` para condicionar `presentation` e
    // `ingredients`, lo que hace que yup infiera el tipo de salida del
    // resolver por una vía distinta a la del alias `ProductFormData` (mismo
    // shape, pero una instanciación genérica distinta para TS). Sin este cast
    // al tipo real del formulario, TFieldValues/TTransformedValues quedan
    // desalineados entre el resolver y el resto del formulario (control,
    // handleSubmit) aunque describan exactamente los mismos datos.
    resolver: yupResolver(productSchema) as Resolver<ProductFormData>,
    defaultValues: {
      isActive: true,
      isForSale: true,
      supplierIds: [],
      // Sin naturaleza elegida: el servidor la exige y la ficha la pide arriba
      // del todo. Arrancar en BASE hacía que un plato se guardara como insumo
      // por no tocar el selector.
      type: undefined,
      categoryId: '',
      subcategoryId: null,
      name: '',
      description: null,
      price: 0,
      cost: 0,
      sku: null,
      barcode: null,
      minStock: null,
      criticality: null,
      imageUrl: null,
      presentation: ProductPresentationEnum.UNIT,
      presentationQuantity: 1,
      ingredients: [],
      station: null,
    },
  });

  // ── El stock que de verdad manda ──────────────────────────────────────────
  // `product.stock` no lo lee nadie para decidir disponibilidad: el APK/PWA
  // consulta `warehouse_stocks` del almacén de la estación. Por eso aquí se
  // muestra ESE número y, si el usuario lo cambia, se registra un CONTEO —
  // el único camino que mueve stock dejando movimiento en el kardex.
  const crearConteo = useCreateCount();
  const { data: almacenes = [] } = useWarehouses();
  const almacenDestino = almacenParaEstacion(
    (watch('station') as string | null) ?? initialData?.station ?? null,
    (almacenes as Array<{ id?: string; _id?: string; name: string }>).map(
      (a) => ({
        id: String(a.id ?? a._id ?? ''),
        name: a.name,
      }),
    ),
  );
  const { data: stockDelAlmacen = [], isLoading: cargandoStock } =
    useWarehouseStock(almacenDestino?.id ?? '');
  const stockReal = initialData?.id
    ? ((stockDelAlmacen as Array<{ productId: string; qty: number }>).find(
        (s) => s.productId === initialData.id,
      )?.qty ?? null)
    : null;

  // El campo abre con el stock REAL del almacén, no con `product.stock`: si
  // mostrara el legacy, el dueño vería 168 mientras el mesonero ve 216 y
  // seguiríamos discutiendo con dos números distintos. `stockReal` se pasa
  // directo como prop a <ProductInventory>; no hay campo `stock` en el
  // formulario (el schema ya no lo tiene: se cambia con "Registrar conteo").

  // Qué es el producto AHORA MISMO en el formulario: decide qué secciones
  // tienen sentido. Un servicio no lleva presentación ni proveedores, y un
  // preparado no tiene stock propio — mostrar esos campos invitaba a llenarlos
  // con datos que después nadie lee.
  const tipoElegido = watch('type');
  const esInsumo = tipoElegido === ProductTypeEnum.BASE;
  const esPreparado = tipoElegido === ProductTypeEnum.MIXED;
  const esServicio = tipoElegido === ProductTypeEnum.SERVICE;

  useEffect(() => {
    if (initialData) {
      const formData = mapProductToFormData(initialData);
      reset(formData);
      if (initialData.imageUrl) setImagePreview(initialData.imageUrl);
    }
  }, [initialData, reset]);

  // La imagen va a la API propia, que la guarda en el disco del VPS.
  const uploadImage = (file: File): Promise<string> =>
    uploadFile(file, 'products');

  /**
   * Registra el conteo físico del insumo en el almacén de su estación.
   *
   * Es la ÚNICA forma de mover stock desde la ficha, y a propósito: deja
   * movimiento en el kardex con autor y fecha. Antes esto era un efecto
   * colateral de guardar el producto (un campo "Stock" en el formulario), y un
   * número escrito a mano no se puede auditar después.
   *
   * El guardia de la API frena ajustes mayores al 50 % porque suelen ser
   * errores de unidad (kilos donde iban gramos). Se le pregunta al usuario en
   * vez de saltárselo por defecto.
   */
  const registrarConteo = async (cantidad: number) => {
    if (!initialData?.id) return;
    if (!almacenDestino) {
      toast.warning({
        title: 'No se pudo ajustar el inventario',
        description:
          'Este producto no tiene un almacén asociado a su estación. Cárgalo desde Inventario.',
      });
      return;
    }

    if (diferenciaEsGrande(stockReal, cantidad)) {
      const actual =
        typeof stockReal === 'number' ? `${stockReal}` : 'sin registro';
      const confirmado = window.confirm(
        `${initialData.name}

En ${almacenDestino.name} hay ${actual} y vas a dejarlo en ${cantidad}.

` + 'Es un cambio grande: confirma que ese es el conteo físico real.',
      );
      if (!confirmado) return;
    }

    try {
      await crearConteo.mutateAsync({
        warehouseId: almacenDestino.id,
        type: 'DIARIO',
        items: [{ productId: initialData.id, quantity: cantidad, unit: 'UND' }],
        confirmLargeDiffs: true,
      });
      setMostrarConteo(false);
      toast.success({
        title: 'Inventario actualizado',
        description: `${initialData.name}: ${cantidad} en ${almacenDestino.name}. El mesonero ya lo ve.`,
      });
    } catch (error) {
      toast.error({
        title: 'No se pudo registrar el conteo',
        description:
          error instanceof Error
            ? error.message
            : 'Inténtalo desde Inventario.',
      });
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    try {
      let imageUrl = data.imageUrl;
      if (imageFile) imageUrl = await uploadImage(imageFile);

      // Calcular costo automáticamente para productos MIXED
      let finalCost = data.cost;
      if (data.type === ProductTypeEnum.MIXED && data.ingredients) {
        finalCost = calculateMixedProductCost(data.ingredients, productsData);
      }

      const finalData = {
        ...data,
        cost: finalCost,
        imageUrl,
      };

      if (isNew) {
        const productToCreate = mapFormDataToProduct(finalData);
        await createProduct.mutateAsync(productToCreate);
        toast.success({
          title: 'Producto creado',
          description: `${data.name} se creo exitosamente`,
        });
      } else if (initialData?.id) {
        const productToUpdate = mapFormDataToProduct(finalData, initialData.id);
        await updateProduct.mutateAsync({
          id: initialData.id,
          data: productToUpdate,
        });
        toast.success({
          title: 'Producto actualizado',
          description: `${data.name} se actualizo exitosamente`,
        });

        // El stock ya no se edita en la ficha: se muestra el REAL del almacén
        // y se cambia con "Registrar conteo", que deja movimiento en el kardex
        // con autor y fecha. Un número escrito a mano no se puede auditar.
      }

      // El recálculo de costos ya NO se hace aquí. Lo dispara el servidor con
      // cada compra y cada receta, en cascada (harina → masa → pizza), y avisa
      // si algún plato queda por debajo del margen mínimo. Hacerlo en el
      // navegador dependía de que alguien tuviera esta pantalla abierta.

      router.push(PRIVATE_ROUTES.PRODUCTS);
    } catch (error) {
      toast.error({
        title: 'No se pudo guardar el producto',
        description: translateApiError(
          error,
          'Revisa los datos e inténtalo de nuevo.',
        ),
      });
    }
  };

  if (categoriesLoading || !categories) {
    return (
      <Loader
        fullScreen
        text="Cargando categorías..."
        size="lg"
        color="primary"
      />
    );
  }
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full flex flex-col space-y-3"
    >
      {/* Mostrar errores generales */}
      <FormErrorSummary errors={errors} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* COLUMNA IZQUIERDA: Configuraciones primarias */}
        <div className="xl:col-span-8 flex flex-col space-y-4">
          <FormSection title="Naturaleza del producto" icon={Package} noGrid>
            <ProductTypeSelector
              errors={errors}
              watch={watch}
              setValue={setValue}
            />
          </FormSection>

          <FormSection title="Información General" icon={Info}>
            <ProductBasicInfo
              register={register}
              errors={errors}
              categories={categories}
              onAddCategory={() => setShowCategoryModal(true)}
              watch={watch}
              setValue={setValue}
            />
          </FormSection>

          <FormSection title="Costos y Precios" icon={DollarSign}>
            <ProductPricing register={register} errors={errors} watch={watch} />
          </FormSection>

          {/* La receta solo tiene sentido en un PREPARADO. Antes esta sección
              se mostraba según el mismo `type`, pero la ficha no distinguía
              servicios y guardaba `ingredients: null` para todo lo demás:
              cualquier producto BASE con receta cargada por script la perdía
              al abrir y guardar (pasó con 21, los tobos entre ellos). */}
          {esPreparado && (
            <FormSection title="Receta e Ingredientes" icon={ListChecks} noGrid>
              <IngredientsManager
                control={control}
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
                products={productsData}
              />
            </FormSection>
          )}

          {esInsumo && (
            <FormSection title="Inventario" icon={Box}>
              <ProductInventory
                control={control}
                watch={watch}
                setValue={setValue}
                categories={categories}
                esNuevo={isNew}
                onRegistrarConteo={() => setMostrarConteo(true)}
                register={register}
                errors={errors}
                stockReal={stockReal}
                almacenNombre={almacenDestino?.name ?? null}
                cargandoStock={cargandoStock}
              />
            </FormSection>
          )}
        </div>

        {/* COLUMNA DERECHA: Imagen y Adicionales */}
        <div className="xl:col-span-4 flex flex-col space-y-4">
          <FormSection title="Imagen del Producto" icon={ImageIcon} noGrid>
            <ProductImageUpload
              imagePreview={imagePreview}
              setImageFile={setImageFile}
              setImagePreview={setImagePreview}
              register={register}
            />
          </FormSection>

          {esInsumo && (
            <FormSection title="Cómo se compra" icon={Tag}>
              <ProductPresentation
                control={control}
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
              />
            </FormSection>
          )}

          {esInsumo && (
            <FormSection title="Proveedores" icon={Truck} noGrid>
              <ProductSuppliers register={register} suppliers={suppliers} />
            </FormSection>
          )}

          {esServicio && (
            <FormSection title="Sin inventario" icon={Tag} noGrid>
              <p className="text-sm text-dim">
                Un servicio no saca nada del almacén: no lleva presentación,
                proveedores ni stock. Si al venderlo sí sale algo (hielo, vasos,
                una botella), márcalo como <b>Preparado</b> y cárgale la receta.
              </p>
            </FormSection>
          )}
        </div>
      </div>

      {/* Acciones del formulario */}
      <FormActions
        isSubmitting={isSubmitting}
        isNew={isNew}
        onCancel={() => router.push(PRIVATE_ROUTES.PRODUCTS)}
      />

      {/* Conteo físico: la única puerta que mueve stock desde la ficha */}
      {mostrarConteo && (
        <ConteoModal
          nombre={initialData?.name ?? ''}
          almacen={almacenDestino?.name ?? ''}
          stockActual={stockReal}
          guardando={crearConteo.isPending}
          onConfirmAction={registrarConteo}
          onCloseAction={() => setMostrarConteo(false)}
        />
      )}

      {/* modal para nueva categoría */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
      />
    </form>
  );
}
