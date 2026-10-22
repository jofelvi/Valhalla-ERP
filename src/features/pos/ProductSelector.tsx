'use client';
import { Product } from '@/modelTypes/product';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  Settings,
} from 'lucide-react';
import ProductCustomizationModal from './ProductCustomizationModal';
import {
  avisoAntesDeVender,
  distintivoDe,
  useDisponibilidad,
} from '@/hooks/useDisponibilidad';
import { ProductCustomization } from '@/modelTypes/orderItem';
import { coincideTexto, prepararBusqueda } from '@/shared/utils/busquedaTexto';

interface ProductSelectorProps {
  products: Product[];
  onAddProductAction: (
    product: Product,
    customization?: ProductCustomization,
  ) => void;
  searchTerm?: string;
}

export default function ProductSelector({
  products,
  onAddProductAction,
  searchTerm = '',
}: ProductSelectorProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [selectedProductForCustomization, setSelectedProductForCustomization] =
    useState<Product | null>(null);

  // Fetch categories using React Query hook
  const { data: allCategories = [] } = useCategories();

  // Qué se puede vender ahora. Solo marca lo accionable (agotado / revisar):
  // con el inventario de hoy, dos tercios del catálogo no tiene stock fiable y
  // pintarlo todo dejaría el distintivo sin significado.
  const { porProducto: disponibilidad } = useDisponibilidad();

  // Memoizado a proposito: sin useMemo este `.filter` devuelve un array NUEVO
  // en cada render y, al estar en las dependencias del calculo de abajo,
  // disparaba un render infinito ("Maximum update depth exceeded").
  const categories = useMemo(
    () => allCategories.filter((category) => category.isForSale === true),
    [allCategories],
  );

  /**
   * Lo que se ve en la rejilla. Es un valor DERIVADO de products + filtros:
   * se calcula, no se guarda.
   *
   * Antes era `useState` + `useEffect` que hacia `setFilteredProducts`. Como
   * `categories` se recreaba en cada render y estaba en las dependencias, el
   * efecto se re-ejecutaba, el setState provocaba otro render, y vuelta a
   * empezar: render infinito. Reventaba la pantalla del pedido y con ella el
   * menu lateral — reportado el 07/09/2026 ("si le das clic al layout
   * cualquier menu no funciona"). React no podia procesar la transicion de
   * ruta porque nunca terminaba de renderizar.
   */
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter only products that are for sale
    result = result.filter((product) => product.isForSale === true);

    if (selectedCategoryId) {
      result = result.filter(
        (product) => product.categoryId === selectedCategoryId,
      );
    }

    // El buscador del POS, que es el que más se usa. Sin tildes, sin
    // mayúsculas y palabra por palabra: `cafe` encuentra «CAFÉ BALLET» y
    // «caja pizza» encuentra «Caja de Pizza». La regla es la misma que aplica
    // el servidor en `?q=`, para que las dos no discrepen.
    const busqueda = prepararBusqueda(searchTerm);
    if (busqueda.length > 0) {
      result = result.filter((product) =>
        coincideTexto(
          [
            product.name,
            categories.find((cat) => cat.id === product.categoryId)?.name,
            product.description,
          ],
          busqueda,
        ),
      );
    }

    // Ordenar productos: agrupar variantes del mismo producto y ordenar tamaños
    const SIZE_ORDER: Record<string, number> = {
      pequeña: 1,
      pequena: 1,
      mediana: 2,
      grande: 3,
      'x4 und': 4,
      'x5 und': 5,
      'x6 und': 6,
      'x8 und': 8,
      'x12 und': 12,
      'x25 und': 25,
      'x8 pzas': 8,
      'x12 pzas': 12,
      'x16 pzas': 16,
      'x24 pzas': 24,
      'x4 piezas': 4,
      'x8 piezas': 8,
      'x10 piezas': 10,
      'x12 piezas': 12,
      'x16 piezas': 16,
      '8 piezas': 8,
      '12 piezas': 12,
      '16 piezas': 16,
      '24 piezas': 24,
    };

    function getBaseName(name: string): string {
      const idx = name.lastIndexOf(' - ');
      return idx > 0 ? name.slice(0, idx) : name;
    }

    function getSizeRank(name: string): number {
      const lower = name.toLowerCase();
      const idx = name.lastIndexOf(' - ');
      if (idx > 0) {
        const suffix = lower.slice(idx + 3);
        if (suffix in SIZE_ORDER) return SIZE_ORDER[suffix];
      }
      // Variantes con "x" al final (ej: "Alas x8 PZAS")
      for (const [key, rank] of Object.entries(SIZE_ORDER)) {
        if (lower.endsWith(key)) return rank;
      }
      return 999;
    }

    result.sort((a, b) => {
      if (a.categoryId !== b.categoryId) {
        return a.categoryId.localeCompare(b.categoryId);
      }
      const baseA = getBaseName(a.name);
      const baseB = getBaseName(b.name);
      if (baseA !== baseB) return baseA.localeCompare(baseB, 'es');
      return getSizeRank(a.name) - getSizeRank(b.name);
    });

    return result;
  }, [products, selectedCategoryId, searchTerm, categories]);

  // Función para verificar si necesita scroll
  const checkScrollButtons = () => {
    if (categoriesScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } =
        categoriesScrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

  // Función para scroll hacia la izquierda
  const scrollLeft = () => {
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  // Función para scroll hacia la derecha
  const scrollRight = () => {
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // useEffect para comprobar scroll cuando cambien las categorías
  useEffect(() => {
    checkScrollButtons();
    const handleResize = () => checkScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [categories]);

  const handleCategoryClick = (
    e: React.MouseEvent,
    categoryId: string | null,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCategoryId((prev) => (prev === categoryId ? null : categoryId));
  };

  const handleProductClick = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    // Avisar, NUNCA bloquear: si falta algo lo más probable es que no se haya
    // cargado la compra. El mesonero decide, con el dato delante.
    const aviso = avisoAntesDeVender(disponibilidad.get(product.id));
    if (aviso && !window.confirm(aviso)) return;

    onAddProductAction(product);
  };

  const handleCustomizeClick = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedProductForCustomization(product);
    setShowCustomizationModal(true);
  };

  const handleCustomizationConfirm = (customization: ProductCustomization) => {
    if (selectedProductForCustomization) {
      onAddProductAction(selectedProductForCustomization, customization);
    }
    setShowCustomizationModal(false);
    setSelectedProductForCustomization(null);
  };

  const handleCustomizationClose = () => {
    setShowCustomizationModal(false);
    setSelectedProductForCustomization(null);
  };

  // Verificar si un producto puede ser personalizado
  const canBeCustomized = (product: Product): boolean => {
    return Boolean(product.ingredients && product.ingredients.length > 0);
  };

  return (
    <div className="space-y-2 xl:h-full flex flex-col">
      {/* Categorias con slider */}
      <div className="relative bg-surface/60 rounded-lg p-2 border border-line">
        <div className="relative">
          {/* Boton scroll izquierda */}
          {canScrollLeft && (
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 w-6 h-6 bg-surface rounded-full border border-line flex items-center justify-center text-dim hover:bg-elevated transition-all shadow-sm"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}

          {/* Contenedor de categorias con scroll — py mas generoso para no
              recortar el shadow-md del tab activo */}
          <div
            ref={categoriesScrollRef}
            onScroll={checkScrollButtons}
            className="flex gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth py-3 px-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Boton "Todas" */}
            <button
              onClick={(e: React.MouseEvent) => handleCategoryClick(e, null)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                selectedCategoryId === null
                  ? 'bg-brand text-on-brand shadow-md'
                  : 'bg-surface text-dim border border-line hover:border-line'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center ${
                  selectedCategoryId === null
                    ? 'bg-brand'
                    : 'bg-gradient-to-br from-surface to-ok/10'
                }`}
              >
                <Package
                  className={`w-4 h-4 ${selectedCategoryId === null ? 'text-white' : 'text-brand'}`}
                />
              </div>
              <span className="text-[11px] font-medium">Todas</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  selectedCategoryId === null
                    ? 'bg-brand text-content'
                    : 'bg-elevated text-dim'
                }`}
              >
                {filteredProducts.length}
              </span>
            </button>

            {/* Categorias */}
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={(e: React.MouseEvent) =>
                  handleCategoryClick(e, category.id)
                }
                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                  selectedCategoryId === category.id
                    ? 'bg-brand text-on-brand shadow-md'
                    : 'bg-surface text-dim border border-line hover:border-line'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-md overflow-hidden flex items-center justify-center flex-shrink-0 ${
                    selectedCategoryId === category.id
                      ? 'ring-1 ring-white/50'
                      : 'bg-gradient-to-br from-surface to-elevated'
                  }`}
                >
                  {category.imageUrl ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={category.imageUrl}
                        alt={category.name}
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <Package
                      className={`w-4 h-4 ${selectedCategoryId === category.id ? 'text-brand-light' : 'text-dim'}`}
                    />
                  )}
                </div>
                <span className="text-[11px] font-medium whitespace-nowrap">
                  {category.name}
                </span>
              </button>
            ))}
          </div>

          {/* Boton scroll derecha */}
          {canScrollRight && (
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 w-6 h-6 bg-surface rounded-full border border-line flex items-center justify-center text-dim hover:bg-elevated transition-all shadow-sm"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Productos */}
      <div className="xl:flex-1 xl:overflow-auto">
        {/* ── Mobile/tablet: lista fila compacta (estilo APK) ── */}
        <div className="flex flex-col gap-2 pb-4 xl:hidden">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={(e) => handleProductClick(e, product)}
              className="flex items-stretch bg-surface border border-line rounded-xl overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
                <div className="min-w-0">
                  <div className="flex items-start gap-1.5">
                    <p className="font-semibold text-content text-sm leading-tight line-clamp-2">
                      {product.name}
                    </p>
                    {(() => {
                      const d = distintivoDe(disponibilidad.get(product.id));
                      return d ? (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${d.clase}`}
                        >
                          {d.texto}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  {product.description && (
                    <p className="text-[11px] text-dim line-clamp-2 mt-0.5">
                      {product.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-base font-bold text-brand">
                    ${product.price.toFixed(2)}
                  </p>
                  {canBeCustomized(product) && (
                    <button
                      type="button"
                      onClick={(e) => handleCustomizeClick(e, product)}
                      className="text-[10px] text-accent font-medium flex items-center gap-0.5"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative w-24 h-24 flex-shrink-0 bg-gradient-to-br from-surface to-elevated">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-dim" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddProductAction(product);
                  }}
                  className="absolute -bottom-2 -right-2 w-9 h-9 bg-brand rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  aria-label="Agregar"
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop (xl+): grid de cards compactas ── */}
        <div className="hidden xl:grid xl:grid-cols-5 gap-2 pb-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="relative rounded-lg overflow-hidden bg-surface shadow-sm hover:shadow-md transition-all duration-200 border border-line hover:border-line group cursor-pointer"
              onClick={(e) => handleProductClick(e, product)}
            >
              {canBeCustomized(product) && (
                <div className="absolute top-1.5 right-1.5 z-10">
                  <div className="w-4.5 h-4.5 bg-accent rounded-full flex items-center justify-center shadow-sm">
                    <Settings className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
              )}
              {(() => {
                const d = distintivoDe(disponibilidad.get(product.id));
                return d ? (
                  <span
                    className={`absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm ${d.clase}`}
                  >
                    {d.texto}
                  </span>
                ) : null;
              })()}
              <div className="relative aspect-[4/3] bg-gradient-to-br from-surface to-elevated">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="20vw"
                    className="object-contain p-1.5"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-dim" />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="font-medium text-content text-xs truncate mb-0.5">
                  {product.name}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-brand">
                    ${product.price.toFixed(2)}
                  </p>
                  {canBeCustomized(product) && (
                    <button
                      type="button"
                      onClick={(e) => handleCustomizeClick(e, product)}
                      className="text-[10px] text-accent hover:text-accent font-medium flex items-center gap-0.5"
                    >
                      <Settings className="w-2.5 h-2.5" />
                      <span>Editar</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="absolute inset-0 bg-brand/0 group-hover:bg-brand/5 transition-all duration-200 flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100">
                <span className="bg-brand/90 text-on-brand px-2 py-1 rounded-full text-[10px] font-medium shadow-md">
                  + Agregar
                </span>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-elevated rounded-full flex items-center justify-center mx-auto mb-3">
              <Package className="w-8 h-8 text-dim" />
            </div>
            <h3 className="text-base font-medium text-dim mb-1">
              No se encontraron productos
            </h3>
            <p className="text-sm text-dim">
              {searchTerm
                ? 'Intenta con otros términos'
                : 'No hay productos en esta categoría'}
            </p>
          </div>
        )}
      </div>

      {/* Modal de personalización */}
      {selectedProductForCustomization && (
        <ProductCustomizationModal
          isOpen={showCustomizationModal}
          onClose={handleCustomizationClose}
          product={selectedProductForCustomization}
          onConfirm={handleCustomizationConfirm}
        />
      )}
    </div>
  );
}
