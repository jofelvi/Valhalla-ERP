'use client';

import { OrderItem } from '@/modelTypes/orderItem';
import {
  isPackProduct,
  packCountLabel,
  packUnitPrice,
  stepOf,
} from '@/shared/utils/packs';
import { Product } from '@/modelTypes/product';
import { useProductsByIds } from '@/hooks/useProducts';
import { Button } from '@/components/shared/button/Button';
import { Input } from '@/components/shared/input/input';
import {
  Clock,
  MessageSquare,
  Minus,
  Package,
  Plus,
  X,
  Settings,
  AlertTriangle,
  Hourglass,
  Beer,
} from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import { useTarifas } from '@/shared/config';
import {
  etiquetaImpuesto,
  etiquetaServicio,
} from '@/features/pos/utils/etiquetasDeCobro';

// Estados de printAttempt que indican fallo real de impresion fisica.
// 'queued' y 'skipped' NO son errores: solo significa "aun no impreso"
// (encolado en backend o estacion no aplica). Items del mobile (APK del
// mesonero) traen sentQty pero nunca tienen printAttempts — eso tampoco
// es error: la impresion la hace el cajero al imprimir comanda/precuenta.
const PRINT_ERROR_STATUSES = new Set([
  'service_down',
  'http_500',
  'printer_offline',
  'printer_paper_out',
  'printer_error',
  'network_error',
  'exception',
]);

interface OrderSummaryProps {
  items: OrderItem[];
  products: Product[];
  subtotal?: number;
  serviceCharge?: number;
  tax?: number;
  total: number;
  tableId?: string | null;
  onRemoveItemAction: (e: React.MouseEvent, index: number) => void;
  onQuantityChangeAction: (index: number, quantity: number) => void;
  onItemNotesChangeAction: (index: number, notes: string) => void;
  onDeliveryChangeAction?: (index: number, qty: number) => void;
  onConvertToPacksAction?: () => void;
  /**
   * Si el SERVIDOR ofrece alguna conversion a pack para esta orden.
   *
   * Antes se decidia aca con `canConvertToPack` de `@odin6/types`, que traia
   * su propia tabla de packs con los precios cableados — y decia $11 para un
   * tobo de lata que el catalogo cobra a $14. Ahora lo calcula el servidor
   * sobre lo ENTREGADO y esta pantalla solo muestra o no el boton.
   */
  hayConversionesDisponibles?: boolean;
}

export default function OrderSummary({
  items,
  products,
  subtotal,
  serviceCharge,
  tax,
  total,
  tableId,
  onRemoveItemAction,
  onQuantityChangeAction,
  onItemNotesChangeAction,
  onDeliveryChangeAction,
  onConvertToPacksAction,
  hayConversionesDisponibles = false,
}: OrderSummaryProps) {
  const tarifas = useTarifas();
  const servicioEtiqueta = etiquetaServicio(tarifas);
  const impuestoEtiqueta = etiquetaImpuesto(tarifas);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  // Los ingredientes quitados ("SIN cebolla") son insumos, y el catalogo de
  // tomar pedido solo trae lo vendible: sus nombres se piden aparte, y solo
  // si hay alguno.
  const idsQuitados = useMemo(
    () =>
      [
        ...new Set(
          items.flatMap((i) => i.customizations?.removedIngredients ?? []),
        ),
      ].sort(),
    [items],
  );
  const { data: insumosQuitados } = useProductsByIds(idsQuitados);
  // Los packs se guardan expandidos a unidades (1 tobo = 12 cervezas), asi que
  // +/- tiene que moverse de a un pack: sumar 1 dejaria la linea en 13, que no
  // es ni un tobo ni dos.
  const handleQuantityDecrease = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const item = items[index];
    const step = stepOf(item.productId, item.presentationQty);
    const next = item.quantity - step;
    if (next >= step) {
      onQuantityChangeAction(index, next);
    }
  };

  const handleQuantityIncrease = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const item = items[index];
    onQuantityChangeAction(
      index,
      item.quantity + stepOf(item.productId, item.presentationQty),
    );
  };

  const toggleItemExpansion = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const handleNotesChange = (index: number, notes: string) => {
    onItemNotesChangeAction(index, notes);
  };

  // Generar número de orden único basado en timestamp - solo una vez
  const orderNumber = useMemo(() => Date.now().toString().slice(-8), []);
  const totalGuests = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div className="flex flex-col h-full">
      {/* Header compacto */}
      <div className="px-3 py-2 border-b border-line">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-dim">ORDEN #{orderNumber}</h2>
          <div className="flex items-center gap-2 text-[11px] text-brand">
            {onConvertToPacksAction && hayConversionesDisponibles && (
              <button
                type="button"
                onClick={onConvertToPacksAction}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold shadow-xs animate-pulse"
                title="Ver las conversiones a tobo o caja disponibles"
              >
                <Beer className="w-3 h-3" />
                Convertir a tobo
              </button>
            )}
            <span>{totalGuests} uds</span>
            {tableId ? (
              <span className="px-1.5 py-0.5 bg-elevated rounded text-[10px]">
                Mesa {tableId.slice(-4)}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 bg-accent/10 rounded text-[10px]">
                Para llevar
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lista de productos con scroll */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1.5">
          {items.map((item, index) => {
            const product = products.find((p) => p.id === item.productId);
            const isExpanded = expandedItems.has(index);

            return (
              <div
                key={`${item.productId}-${index}`}
                className="bg-gradient-to-r from-page to-elevated rounded-lg border border-line"
              >
                {/* Main item row */}
                <div className="flex items-center gap-2 p-2">
                  {/* Imagen */}
                  <div className="w-9 h-9 bg-gradient-to-r from-brand/30 to-ok/30 rounded-lg overflow-hidden flex-shrink-0">
                    {product?.imageUrl ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={product.imageUrl}
                          alt={item.name}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-4 h-4 text-brand" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h3 className="text-xs font-semibold text-content truncate">
                        {item.name}
                      </h3>
                      {item.quantity > (item.sentQty ?? 0) && (
                        <span className="flex-shrink-0 px-1 py-0.5 bg-brand/15 text-brand text-[9px] font-bold rounded uppercase leading-none">
                          NUEVO
                        </span>
                      )}
                      {(() => {
                        if ((item.sentQty ?? 0) <= (item.printedQty ?? 0))
                          return null;
                        const lastAttempt = (item.printAttempts ?? []).slice(
                          -1,
                        )[0];
                        const isRealError = lastAttempt
                          ? PRINT_ERROR_STATUSES.has(lastAttempt.status)
                          : false;
                        if (isRealError) {
                          return (
                            <span
                              className="flex-shrink-0 flex items-center gap-0.5 px-1 py-0.5 bg-danger shadow-sm text-on-brand text-[9px] font-bold rounded uppercase leading-none"
                              title={`Fallo de impresion: ${lastAttempt?.errorMessage || lastAttempt?.status}`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5" /> ERROR
                              IMPRESIÓN
                            </span>
                          );
                        }
                        // Solo icono: el texto apretaba el nombre del producto
                        return (
                          <span
                            className="flex-shrink-0 flex items-center p-1 bg-amber-500 shadow-sm text-white rounded"
                            title="Pendiente de imprimir comanda en la estación"
                          >
                            <Hourglass className="w-3 h-3" />
                          </span>
                        );
                      })()}
                      {item.customizations && (
                        <Settings className="w-2.5 h-2.5 text-accent flex-shrink-0" />
                      )}
                      <button
                        type="button"
                        className={`ml-auto flex-shrink-0 p-0.5 rounded transition-colors ${
                          isExpanded || item.notes
                            ? 'text-accent bg-accent/10'
                            : 'text-dim hover:text-brand'
                        }`}
                        onClick={() => toggleItemExpansion(index)}
                      >
                        <MessageSquare size={11} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs font-bold text-dim">
                        {/* En un pack el unitario guardado es el de la cerveza
                            suelta ($0.92): al lado de "Tobo" se lee como si el
                            tobo costara eso. Se muestra el precio del pack. */}
                        $
                        {packUnitPrice(
                          item.unitPrice,
                          item.productId,
                          item.presentationQty,
                        ).toFixed(2)}
                        {isPackProduct(item.productId) && (
                          <span className="text-[10px] text-dim ml-0.5 font-medium">
                            ({item.quantity} cervezas)
                          </span>
                        )}
                        {item.customizations &&
                          item.customizations.customizationPrice > 0 && (
                            <span className="text-[10px] text-accent ml-0.5">
                              (+$
                              {item.customizations.customizationPrice.toFixed(
                                2,
                              )}
                              )
                            </span>
                          )}
                      </span>
                      {item.customizations && !isExpanded && (
                        <span className="text-[10px] text-dim">
                          {item.customizations.removedIngredients.length > 0 &&
                            `- ${item.customizations.removedIngredients.length}`}
                          {item.customizations.addedExtras.length > 0 &&
                            ` + ${item.customizations.addedExtras.length}`}
                        </span>
                      )}
                    </div>
                    {item.notes && !isExpanded && (
                      <p className="text-[10px] text-dim italic truncate mt-0.5">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Quantity + remove */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-6 h-6 p-0 border-line text-dim hover:bg-elevated"
                      onClick={(e: React.MouseEvent) =>
                        handleQuantityDecrease(e, index)
                      }
                      disabled={
                        item.quantity <=
                        stepOf(item.productId, item.presentationQty)
                      }
                    >
                      <Minus size={12} />
                    </Button>
                    <span className="font-bold text-sm min-w-[18px] text-center text-content">
                      {packCountLabel(
                        item.quantity,
                        item.productId,
                        item.presentationQty,
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-6 h-6 p-0 border-line text-dim hover:bg-elevated"
                      onClick={(e: React.MouseEvent) =>
                        handleQuantityIncrease(e, index)
                      }
                    >
                      <Plus size={12} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-6 h-6 p-0 text-danger hover:text-danger hover:bg-danger/10"
                      onClick={(e: React.MouseEvent) =>
                        onRemoveItemAction(e, index)
                      }
                    >
                      <X size={12} />
                    </Button>
                  </div>
                </div>

                {/* Delivery counter row */}
                {onDeliveryChangeAction && (
                  <div className="flex items-center gap-1.5 px-2 pb-1.5">
                    {/* Estado de entrega */}
                    {(() => {
                      const delivered = item.deliveredQty ?? 0;
                      const qty = item.quantity;
                      if (delivered >= qty) {
                        return (
                          <span className="text-[10px] font-medium text-ok bg-ok/10 px-1.5 py-0.5 rounded">
                            ✓ Entregado
                          </span>
                        );
                      } else if (delivered > 0) {
                        return (
                          <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                            {delivered}/{qty} entregados
                          </span>
                        );
                      } else {
                        return (
                          <span className="text-[10px] font-medium text-dim bg-elevated px-1.5 py-0.5 rounded">
                            Pendiente
                          </span>
                        );
                      }
                    })()}
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-5 h-5 p-0 border-line text-dim hover:bg-elevated"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const current = item.deliveredQty ?? 0;
                          if (current > 0) {
                            onDeliveryChangeAction(index, current - 1);
                          }
                        }}
                        disabled={(item.deliveredQty ?? 0) <= 0}
                      >
                        <Minus size={9} />
                      </Button>
                      <span className="text-[11px] font-bold text-dim min-w-[14px] text-center">
                        {item.deliveredQty ?? 0}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-5 h-5 p-0 border-line text-dim hover:bg-elevated"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const current = item.deliveredQty ?? 0;
                          if (current < item.quantity) {
                            onDeliveryChangeAction(index, current + 1);
                          }
                        }}
                        disabled={(item.deliveredQty ?? 0) >= item.quantity}
                      >
                        <Plus size={9} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-2 pb-2">
                    <div className="border-t border-line pt-2 space-y-2">
                      {item.customizations && (
                        <div className="space-y-1">
                          {item.customizations.removedIngredients.length >
                            0 && (
                            <div className="text-[11px] text-danger">
                              Sin:{' '}
                              {item.customizations.removedIngredients.map(
                                (id, idx) => {
                                  const ingredient =
                                    products.find((p) => p.id === id) ??
                                    insumosQuitados?.find((p) => p.id === id);
                                  return (
                                    <span key={idx}>
                                      {idx > 0 && ', '}
                                      {ingredient?.name || id}
                                    </span>
                                  );
                                },
                              )}
                            </div>
                          )}
                          {item.customizations.addedExtras.length > 0 && (
                            <div className="text-[11px] text-accent">
                              {item.customizations.addedExtras.map(
                                (extra, idx) => (
                                  <span key={idx}>
                                    {idx > 0 && ', '}+{extra.name} x
                                    {extra.quantity} ($
                                    {(extra.price * extra.quantity).toFixed(2)})
                                  </span>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <Input
                        type="text"
                        placeholder="Notas para cocina..."
                        value={item.notes || ''}
                        onChange={(e) =>
                          handleNotesChange(index, e.target.value)
                        }
                        className="w-full h-7 text-xs border-line focus:border-brand focus:ring-brand"
                      />
                      {/* Historial de timestamps */}
                      {(item.addedAt || item.quantityLog) && (
                        <div className="mt-1.5 bg-surface/60 rounded p-1.5 space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-dim uppercase">
                            <Clock size={9} />
                            Historial
                          </div>
                          {item.addedAt && (
                            <div className="text-[10px] text-dim">
                              Agregado:{' '}
                              {new Date(item.addedAt).toLocaleString('es-VE', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </div>
                          )}
                          {item.quantityLog && item.quantityLog.length > 1 && (
                            <div className="space-y-0.5">
                              {item.quantityLog
                                .slice(1)
                                .map(
                                  (
                                    log: { qty: number; at: string },
                                    i: number,
                                  ) => (
                                    <div
                                      key={i}
                                      className="text-[10px] text-brand"
                                    >
                                      Cant. → {log.qty} a las{' '}
                                      {new Date(log.at).toLocaleString(
                                        'es-VE',
                                        {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          day: '2-digit',
                                          month: '2-digit',
                                        },
                                      )}
                                    </div>
                                  ),
                                )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 bg-gradient-to-r from-surface to-ok/10 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Package className="w-5 h-5 text-dim" />
            </div>
            <p className="text-xs text-brand font-medium">Sin productos</p>
            <p className="text-[11px] text-brand mt-0.5">
              Selecciona productos para comenzar
            </p>
          </div>
        )}
      </div>

      {/* Footer compacto con total */}
      <div className="border-t border-line px-3 py-2 bg-gradient-to-r from-page to-elevated">
        {items.some((item) => item.customizations) && (
          <div className="flex items-center gap-1.5 text-[11px] text-accent mb-1.5">
            <Settings className="w-3 h-3" />
            <span>
              {items.filter((item) => item.customizations).length}{' '}
              personalizado(s)
            </span>
          </div>
        )}
        {/* Desglose cuando hay recargo por servicio */}
        {((serviceCharge !== undefined && serviceCharge > 0) ||
          (tax ?? 0) > 0) && (
          <div className="mb-1.5 space-y-0.5">
            <FilaDeResumen
              className="text-[11px] text-dim"
              etiqueta="Subtotal:"
              valor={<>${subtotal?.toFixed(2) ?? '0.00'}</>}
            />
            {serviceCharge !== undefined &&
              serviceCharge > 0 &&
              servicioEtiqueta && (
                <FilaDeResumen
                  className="text-[11px] text-ok font-medium"
                  etiqueta={`${servicioEtiqueta}:`}
                  valor={<>${serviceCharge.toFixed(2)}</>}
                />
              )}
            {(tax ?? 0) > 0 && impuestoEtiqueta && (
              <FilaDeResumen
                className="text-[11px] text-dim font-medium"
                etiqueta={`${impuestoEtiqueta}:`}
                valor={<>${(tax ?? 0).toFixed(2)}</>}
              />
            )}
          </div>
        )}
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs font-semibold text-content">TOTAL</div>
            <div className="text-[11px] text-brand">
              {items.length} prod. • {totalGuests} uds
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-content">
              ${total.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
