'use client';

import { useMemo, useState } from 'react';
import { Product } from '@/modelTypes/product';
import { ProductCustomization, AddedExtra } from '@/modelTypes/orderItem';
import { Button } from '@/components/shared/button/Button';
import Modal from '@/components/shared/modal';
import { Package, Plus, Minus, ChefHat, Star, X } from 'lucide-react';
import Image from 'next/image';
import { useCategories } from '@/hooks/useCategories';
import { useProductsByIds, useProductsByCategory } from '@/hooks/useProducts';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

interface ProductCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onConfirm: (customization: ProductCustomization) => void;
  initialCustomization?: ProductCustomization;
}

export default function ProductCustomizationModal({
  isOpen,
  onClose,
  product,
  onConfirm,
  initialCustomization,
}: ProductCustomizationModalProps) {
  const [removedIngredients, setRemovedIngredients] = useState<string[]>(
    initialCustomization?.removedIngredients || [],
  );
  const [addedExtras, setAddedExtras] = useState<AddedExtra[]>(
    initialCustomization?.addedExtras || [],
  );
  const { data: categories = [] } = useCategories();

  // Los insumos no vienen en el catalogo de tomar pedido (no son vendibles):
  // se piden solo los de esta receta, al abrir el modal.
  const ingredientIds = useMemo(
    () => (product.ingredients ?? []).map((ing) => ing.productId),
    [product.ingredients],
  );
  const { data: ingredientProducts = [], isLoading } =
    useProductsByIds(ingredientIds);

  // Identificar categoría de adicionales.
  const additionalCategory = useMemo(
    () =>
      categories.find(
        (cat) =>
          cat.name.toLowerCase().includes('adicional') ||
          cat.name.toLowerCase().includes('extra'),
      ),
    [categories],
  );

  // Traer adicionales de esa categoría bajo demanda.
  const { data: allAdditionalProducts = [] } = useProductsByCategory(
    additionalCategory?.id || '',
  );

  const additionalProductsList = useMemo(
    () => allAdditionalProducts.filter((p) => p.isForSale),
    [allAdditionalProducts],
  );

  const handleIngredientToggle = (ingredientId: string) => {
    setRemovedIngredients((prev) =>
      prev.includes(ingredientId)
        ? prev.filter((id) => id !== ingredientId)
        : [...prev, ingredientId],
    );
  };

  const handleExtraQuantityChange = (extraProduct: Product, change: number) => {
    setAddedExtras((prev) => {
      const existing = prev.find((e) => e.productId === extraProduct.id);

      if (!existing && change > 0) {
        return [
          ...prev,
          {
            productId: extraProduct.id,
            name: extraProduct.name,
            price: extraProduct.price,
            quantity: 1,
          },
        ];
      }

      if (existing) {
        const newQuantity = existing.quantity + change;
        if (newQuantity <= 0) {
          return prev.filter((e) => e.productId !== extraProduct.id);
        }

        return prev.map((e) =>
          e.productId === extraProduct.id ? { ...e, quantity: newQuantity } : e,
        );
      }

      return prev;
    });
  };

  const getExtraQuantity = (productId: string): number => {
    return addedExtras.find((e) => e.productId === productId)?.quantity || 0;
  };

  const calculateCustomizationPrice = (): number => {
    return addedExtras.reduce(
      (total, extra) => total + extra.price * extra.quantity,
      0,
    );
  };

  const handleConfirm = () => {
    const customization: ProductCustomization = {
      removedIngredients,
      addedExtras,
      customizationPrice: calculateCustomizationPrice(),
    };

    onConfirm(customization);
    onClose();
  };

  const handleReset = () => {
    setRemovedIngredients([]);
    setAddedExtras([]);
  };

  if (isLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} className="max-w-4xl">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-dim">Cargando opciones de personalización...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-4xl">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-r from-surface to-ok/10 rounded-xl overflow-hidden">
              {product.imageUrl ? (
                <div className="relative w-full h-full">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-8 h-8 text-brand" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-content">
                Personalizar {product.name}
              </h2>
              <p className="text-dim">
                Precio base:{' '}
                <span className="font-semibold">
                  ${product.price.toFixed(2)}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dim hover:text-dim transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ingredientes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ChefHat className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-semibold text-content">
                Ingredientes
              </h3>
            </div>

            {ingredientProducts.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {ingredientProducts.map((ingredient) => {
                  const isRemoved = removedIngredients.includes(ingredient.id);
                  const ingredientInfo = product.ingredients?.find(
                    (ing) => ing.productId === ingredient.id,
                  );

                  return (
                    <div
                      key={ingredient.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        isRemoved
                          ? 'bg-danger/10 border-danger/20'
                          : 'bg-elevated border-line'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-surface to-elevated rounded-lg overflow-hidden">
                          {ingredient.imageUrl ? (
                            <div className="relative w-full h-full">
                              <Image
                                src={ingredient.imageUrl}
                                alt={ingredient.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-4 h-4 text-dim" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p
                            className={`font-medium ${
                              isRemoved
                                ? 'text-danger line-through'
                                : 'text-content'
                            }`}
                          >
                            {ingredient.name}
                          </p>
                          {ingredientInfo && (
                            <p className="text-xs text-dim">
                              {ingredientInfo.quantity} {ingredientInfo.unit}
                            </p>
                          )}
                        </div>
                      </div>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isRemoved}
                          onChange={() => handleIngredientToggle(ingredient.id)}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isRemoved
                              ? 'bg-danger border-danger'
                              : 'border-line hover:border-danger'
                          }`}
                        >
                          {isRemoved && <X className="w-3 h-3 text-white" />}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <ChefHat className="w-12 h-12 text-dim mx-auto mb-3" />
                <p className="text-dim">
                  Este producto no tiene ingredientes configurados
                </p>
              </div>
            )}
          </div>

          {/* Adicionales */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold text-content">
                Adicionales
              </h3>
            </div>

            {additionalProductsList.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {additionalProductsList.map((extra) => {
                  const quantity = getExtraQuantity(extra.id);

                  return (
                    <div
                      key={extra.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-line bg-elevated"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-accent/20 to-accent/10 rounded-lg overflow-hidden">
                          {extra.imageUrl ? (
                            <div className="relative w-full h-full">
                              <Image
                                src={extra.imageUrl}
                                alt={extra.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Star className="w-4 h-4 text-accent" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-content">
                            {extra.name}
                          </p>
                          <p className="text-sm text-accent font-semibold">
                            +${extra.price.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => handleExtraQuantityChange(extra, -1)}
                          disabled={quantity === 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>

                        <span className="w-8 text-center font-semibold text-content">
                          {quantity}
                        </span>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => handleExtraQuantityChange(extra, 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Star className="w-12 h-12 text-dim mx-auto mb-3" />
                <p className="text-dim">No hay adicionales disponibles</p>
              </div>
            )}
          </div>
        </div>

        {/* Resumen de precio */}
        <div className="mt-6 p-4 bg-gradient-to-r from-elevated to-surface rounded-lg border border-line">
          <FilaDeResumen
            className="items-center mb-2"
            etiqueta="Precio base:"
            classNameEtiqueta="text-dim"
            valor={<>${product.price.toFixed(2)}</>}
            classNameValor="font-semibold"
          />

          {addedExtras.length > 0 && (
            <div className="space-y-1 mb-2">
              {addedExtras.map((extra, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-dim">
                    {extra.name} x{extra.quantity}
                  </span>
                  <span className="text-accent">
                    +${(extra.price * extra.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-line pt-2 flex justify-between items-center">
            <span className="text-lg font-bold text-content">Total:</span>
            <span className="text-xl font-bold text-dim">
              ${(product.price + calculateCustomizationPrice()).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="flex-1"
          >
            Resetear
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            className="flex-1 bg-gradient-to-r from-brand to-ok hover:from-brand hover:to-ok text-on-brand"
          >
            Confirmar Personalización
          </Button>
        </div>
      </div>
    </Modal>
  );
}
