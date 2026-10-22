// app/private/almacen/general/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  Minus,
  ChevronLeft,
  Search,
  AlertTriangle,
  Save,
} from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { Card } from '@/components/shared/card/card';
import { Input } from '@/components/shared/input/input';
import { useToast } from '@/components/hooks/useToast';
import { useAlmacenGeneral, useRegistrarMovimiento } from '@/hooks/useAlmacen';
import { useProducts } from '@/hooks/useProducts';
import { PRIVATE_ROUTES } from '@/shared';
import Modal from '@/components/shared/modal';
import { Product } from '@odin6/types';

interface ProductoConStock {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  stockActual: number;
  stockNuevo: number;
  modificado: boolean;
}

export default function AlmacenGeneralPage() {
  const router = useRouter();
  const toast = useToast();

  const { data: almacenData, isLoading } = useAlmacenGeneral();
  const { data: productosAll = [] } = useProducts();
  const registrarMovimiento = useRegistrarMovimiento();

  const [productos, setProductos] = useState<ProductoConStock[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [showAgregarModal, setShowAgregarModal] = useState(false);
  const [productoAAgregar, setProductoAAgregar] = useState<string>('');
  const [cantidadAAgregar, setCantidadAAgregar] = useState<number>(0);

  // Initialize productos from almacen data and products
  useEffect(() => {
    if (almacenData && productosAll.length > 0) {
      const productosConStock: ProductoConStock[] = (
        almacenData.productos ?? []
      )
        .map((item) => {
          const producto = productosAll.find((p) => p.id === item.productId);
          return {
            id: item.productId,
            nombre: producto?.name || 'Producto desconocido',
            categoria: producto?.categoryId || 'Sin categoría',
            precio: producto?.price || 0,
            stockActual: item.stockDisponible,
            stockNuevo: item.stockDisponible,
            modificado: false,
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      setProductos(productosConStock);
    }
  }, [almacenData, productosAll]);

  const actualizarStock = (productId: string, nuevoStock: number) => {
    setProductos((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const stockFinal = Math.max(0, nuevoStock);
          return {
            ...p,
            stockNuevo: stockFinal,
            modificado: stockFinal !== p.stockActual,
          };
        }
        return p;
      }),
    );
  };

  const guardarCambios = async () => {
    const productosModificados = productos.filter((p) => p.modificado);

    if (productosModificados.length === 0) {
      toast.error({
        title: 'Sin cambios',
        description: 'No hay cambios para guardar',
      });
      return;
    }

    try {
      for (const prod of productosModificados) {
        const diferencia = prod.stockNuevo - prod.stockActual;
        if (diferencia !== 0) {
          await registrarMovimiento.mutateAsync({
            productId: prod.id,
            quantity: diferencia,
            type: diferencia > 0 ? 'in' : 'out',
            description: 'Ajuste de stock',
          });
        }
      }

      toast.success({
        title: 'Guardado',
        description: `Se actualizaron ${productosModificados.length} productos`,
      });

      setProductos((prev) =>
        prev.map((p) => ({
          ...p,
          modificado: false,
          stockActual: p.stockNuevo,
        })),
      );
    } catch {
      toast.error({
        title: 'Error',
        description: 'No se pudieron guardar los cambios',
      });
    }
  };

  const agregarNuevoProducto = async () => {
    if (!productoAAgregar || cantidadAAgregar <= 0) {
      toast.error({
        title: 'Error',
        description: 'Selecciona un producto y una cantidad válida',
      });
      return;
    }

    try {
      await registrarMovimiento.mutateAsync({
        productId: productoAAgregar,
        quantity: cantidadAAgregar,
        type: 'in',
        description: 'Agregación de producto al almacén',
      });

      toast.success({
        title: 'Producto agregado',
        description: `Se agregaron ${cantidadAAgregar} unidades al almacén`,
      });

      setShowAgregarModal(false);
      setProductoAAgregar('');
      setCantidadAAgregar(0);
    } catch {
      toast.error({
        title: 'Error',
        description: 'No se pudo agregar el producto',
      });
    }
  };

  const productosFiltrados = useBusqueda(productos, busqueda, [
    'nombre',
    'categoria',
  ]);

  const hayModificaciones = productos.some((p) => p.modificado);

  const productosNoEnAlmacen = productosAll.filter(
    (p: Product) => !productos.some((prod) => prod.id === p.id),
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-elevated flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
          <p className="mt-4 text-dim">Cargando almacén general...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-elevated">
      {/* Header */}
      <div className="bg-surface shadow-sm border-b border-line sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(PRIVATE_ROUTES.ALMACEN)}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-content">
                  Almacén General
                </h1>
                <p className="text-sm text-dim">Gestión del stock principal</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowAgregarModal(true)}
                className="bg-brand hover:bg-brand/80 text-on-brand flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Agregar</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-elevated rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-brand" />
              </div>
              <div>
                <p className="text-sm text-dim">Productos</p>
                <p className="text-2xl font-bold text-content">
                  {productos.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ok/15 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-ok" />
              </div>
              <div>
                <p className="text-sm text-dim">Total Unidades</p>
                <p className="text-2xl font-bold text-content">
                  {productos.reduce((sum, p) => sum + p.stockActual, 0)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/15 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-dim">Stock Bajo</p>
                <p className="text-2xl font-bold text-content">
                  {productos.filter((p) => p.stockActual < 10).length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-danger/15 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <div>
                <p className="text-sm text-dim">Sin Stock</p>
                <p className="text-2xl font-bold text-content">
                  {productos.filter((p) => p.stockActual === 0).length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Barra de acciones */}
        {hayModificaciones && (
          <Card className="bg-accent/10 border-accent/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-accent" />
                <span className="text-accent font-medium">
                  Hay cambios sin guardar
                </span>
              </div>
              <Button
                onClick={guardarCambios}
                disabled={registrarMovimiento.isPending}
                className="bg-accent hover:bg-accent/80 text-on-brand flex items-center gap-2"
              >
                {registrarMovimiento.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Cambios
              </Button>
            </div>
          </Card>
        )}

        {/* Búsqueda */}
        <Card className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dim w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Lista de productos */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-elevated border-b border-line">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-dim">
                    Producto
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-dim">
                    Stock Actual
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-dim">
                    Ajustar Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-dim">
                      No se encontraron productos
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((producto) => (
                    <tr
                      key={producto.id}
                      className={`border-b border-line transition-colors ${
                        producto.modificado
                          ? 'bg-accent/10'
                          : 'hover:bg-elevated'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-content">
                            {producto.nombre}
                          </p>
                          <p className="text-xs text-dim">
                            ${producto.precio.toFixed(2)}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-medium ${
                            producto.stockActual === 0
                              ? 'text-danger'
                              : producto.stockActual < 10
                                ? 'text-accent'
                                : 'text-content'
                          }`}
                        >
                          {producto.stockActual}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              actualizarStock(
                                producto.id,
                                producto.stockNuevo - 1,
                              )
                            }
                            disabled={producto.stockNuevo === 0}
                            className="w-8 h-8 rounded-lg bg-elevated hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            value={producto.stockNuevo}
                            onChange={(e) =>
                              actualizarStock(
                                producto.id,
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-20 text-center border border-line rounded-lg py-1.5 text-sm font-medium focus:ring-2 focus:ring-brand focus:border-transparent"
                            min={0}
                          />
                          <button
                            onClick={() =>
                              actualizarStock(
                                producto.id,
                                producto.stockNuevo + 1,
                              )
                            }
                            className="w-8 h-8 rounded-lg bg-elevated hover:bg-elevated flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal Agregar Producto */}
      <Modal
        isOpen={showAgregarModal}
        onClose={() => setShowAgregarModal(false)}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-content mb-4">
            Agregar Producto al Almacén
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dim mb-1">
                Producto
              </label>
              <select
                value={productoAAgregar}
                onChange={(e) => setProductoAAgregar(e.target.value)}
                className="w-full border border-line rounded-lg py-2 px-3 focus:ring-2 focus:ring-brand focus:border-transparent"
              >
                <option value="">Seleccionar producto...</option>
                {productosNoEnAlmacen.map((p: Product) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - ${p.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dim mb-1">
                Cantidad Inicial
              </label>
              <Input
                type="number"
                value={cantidadAAgregar}
                onChange={(e) =>
                  setCantidadAAgregar(parseInt(e.target.value) || 0)
                }
                min={1}
                placeholder="Cantidad..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowAgregarModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={agregarNuevoProducto}
              disabled={
                registrarMovimiento.isPending ||
                !productoAAgregar ||
                cantidadAAgregar <= 0
              }
              className="flex-1 bg-brand hover:bg-brand/80 text-on-brand"
            >
              {registrarMovimiento.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                'Agregar'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
