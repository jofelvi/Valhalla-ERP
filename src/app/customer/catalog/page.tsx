'use client';
import Modal from '@/components/shared/modal';
export const dynamic = 'force-dynamic';
import { useState, useMemo } from 'react';
import { useCategories, useProducts } from '@/hooks';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { Product } from '@odin6/types';
import { useCustomerCartStore } from '@/shared/store/useCustomerCartStore';
import { Filter, Minus, Plus, Search, ShoppingCart } from 'lucide-react';

export default function CustomerProducts() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCart, setShowCart] = useState(false);

  // Fetch categories and products using React Query hooks
  const { data: allCategoriesData = [] } = useCategories();
  const { data: allProducts = [], isLoading } = useProducts();

  const categories = useMemo(
    () => allCategoriesData.filter((cat) => cat.isActive && cat.isForSale),
    [allCategoriesData],
  );

  const {
    items,
    addItem,
    updateQuantity,
    removeItem,
    getTotalPrice,
    getTotalItems,
  } = useCustomerCartStore();

  // Filter and sort products based on category and search term
  const activeProducts = useMemo(
    () => allProducts.filter((p) => p.isActive && p.isForSale && p.price > 0),
    [allProducts],
  );

  const filteredByCategory = useMemo(() => {
    if (selectedCategory === 'all') return activeProducts;
    return activeProducts.filter(
      (product) => product.categoryId === selectedCategory,
    );
  }, [activeProducts, selectedCategory]);

  const searchedProducts = useBusqueda(filteredByCategory, searchTerm, [
    'name',
    (p) => p.description,
  ]);

  const products = useMemo(() => {
    // Sort by nivel (priority level)
    const sorted = [...searchedProducts];
    sorted.sort((a, b) => {
      const nivelA = a.nivel ?? 999;
      const nivelB = b.nivel ?? 999;
      return nivelA - nivelB;
    });
    return sorted;
  }, [searchedProducts]);

  const getItemQuantity = (productId: string) => {
    const item = items.find((item) => item.product.id === productId);
    return item ? item.quantity : 0;
  };

  const handleAddToCart = (product: Product) => {
    addItem(product, 1);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) {
      removeItem(productId);
    } else {
      updateQuantity(productId, quantity);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-teal-900">Productos</h1>
          <p className="text-brand">
            Selecciona productos para añadir a tu pedido
          </p>
        </div>

        <button
          onClick={() => setShowCart(!showCart)}
          className="relative bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-4 py-2 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-200 flex items-center space-x-2 shadow-lg shadow-teal-500/25"
        >
          <ShoppingCart className="h-5 w-5" />
          <span>Carrito</span>
          {getTotalItems() > 0 && (
            <span className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-md">
              {getTotalItems()}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface/80 backdrop-blur-sm rounded-xl shadow-sm border border-teal-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-brand" />
            <span className="font-medium text-brand">Filtros:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md'
                  : 'bg-teal-100 text-brand hover:bg-teal-200'
              }`}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md'
                    : 'bg-teal-100 text-brand hover:bg-teal-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-brand" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-teal-200 rounded-xl focus:ring-teal-500 focus:border-brand bg-surface/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => {
          const quantity = getItemQuantity(product.id);
          return (
            <div
              key={product.id}
              className="bg-surface/80 backdrop-blur-sm rounded-xl shadow-sm border border-teal-200 overflow-hidden hover:shadow-lg hover:border-teal-300 transition-all duration-200"
            >
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="font-semibold text-teal-900 mb-2">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-brand text-sm mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                    ${product.price.toFixed(2)}
                  </span>
                  <span className="text-sm text-brand">
                    Stock: {product.stock}
                  </span>
                </div>

                {quantity === 0 ? (
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock === 0}
                    className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white py-2 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-md shadow-teal-500/20"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Agregar al Carrito</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between bg-teal-50 rounded-xl p-2 border border-teal-200">
                    <button
                      onClick={() =>
                        handleUpdateQuantity(product.id, quantity - 1)
                      }
                      className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full p-1.5 hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-sm"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="font-semibold text-teal-900">
                      {quantity}
                    </span>
                    <button
                      onClick={() =>
                        handleUpdateQuantity(product.id, quantity + 1)
                      }
                      disabled={quantity >= product.stock}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full p-1.5 hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-300 shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {products.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <ShoppingCart className="h-12 w-12 text-brand mx-auto mb-4" />
          <h3 className="text-lg font-medium text-teal-900 mb-2">
            No se encontraron productos
          </h3>
          <p className="text-brand">
            Intenta ajustar los filtros o buscar otros términos.
          </p>
        </div>
      )}

      {/* Shopping Cart Sidebar */}
      {showCart && (
        <Modal
          isOpen
          estiloPropio
          onClose={() => setShowCart(false)}
          classNameFondo="bg-black/50 backdrop-blur-sm"
          classNameWrap="p-0 items-stretch justify-end"
          className="h-full w-full max-w-md mx-0 min-h-0 max-h-none rounded-none border-0 bg-gradient-to-b from-teal-900 via-teal-800 to-elevated shadow-2xl backdrop-blur-none animate-none"
        >
          <div className="h-full">
            <div className="flex flex-col h-full">
              <div className="border-b border-teal-700/50 p-4">
                <h2 className="text-lg font-semibold text-brand-light">
                  Tu Carrito ({getTotalItems()} productos)
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {items.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-brand mx-auto mb-4" />
                    <p className="text-brand-light">Tu carrito está vacío</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={item.product.id}
                        className="border border-teal-700/50 rounded-xl p-3 bg-teal-800/50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-teal-100">
                            {item.product.name}
                          </h4>
                          <button
                            onClick={() => removeItem(item.product.id)}
                            className="text-brand hover:text-brand-light text-xl leading-none"
                          >
                            ×
                          </button>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() =>
                                handleUpdateQuantity(
                                  item.product.id,
                                  item.quantity - 1,
                                )
                              }
                              className="bg-teal-700 text-brand-light rounded-full p-1.5 hover:bg-brand transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-medium text-teal-100">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                handleUpdateQuantity(
                                  item.product.id,
                                  item.quantity + 1,
                                )
                              }
                              className="bg-teal-700 text-brand-light rounded-full p-1.5 hover:bg-brand transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="font-semibold text-brand-light">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="border-t border-teal-700/50 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold text-brand-light">
                      Total:
                    </span>
                    <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                      ${getTotalPrice().toFixed(2)}
                    </span>
                  </div>
                  <button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 font-medium shadow-lg shadow-emerald-500/25">
                    Realizar Pedido
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
