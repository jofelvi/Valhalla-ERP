'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { Plus, Trash2, Search, FileText, Users, Calendar } from 'lucide-react';

import { Budget, BudgetItem } from '@odin6/types';
import { Product } from '@odin6/types';
import { BudgetStatusEnum } from '@/shared/types/enumShared';
import { useCreateBudget, useUpdateBudget, useProducts } from '@/hooks';
import { useUserStore } from '@/shared/store/useUserStore';
import { Button } from '@/components/shared/button/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Input } from '@/components/shared/input/input';
import { useToast } from '@/components/hooks/useToast';
import { calcularServiceCharge } from '@odin6/types';
import { formatearUsd } from '@/shared/utils/dinero';
import { useOperacion, useTarifas } from '@/shared/config';
import { porcentaje } from '@/features/pos/utils/etiquetasDeCobro';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetFormProps {
  budget?: Budget;
  onSuccess?: () => void;
}

interface BudgetFormValues {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerRif: string;
  customerIdType: string;
  customerAddress: string;
  customerType: string;
  eventName: string;
  eventDate: string;
  eventGuests: number | '';
  notes: string;
  validUntil: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  serviceCharge: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBudgetNumber(): string {
  return `PRES-${Date.now().toString().slice(-8)}`;
}

function getDefaultValidUntil(): string {
  const date = new Date();
  date.setDate(date.getDate() + 15);
  return date.toISOString().split('T')[0];
}

function formatDateForInput(
  date: Date | string | undefined,
  timeZone: string,
): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  // Usar la zona horaria del negocio para que "2026-05-13T00:00:00Z" (00:00 UTC
  // del 12 en el local) se muestre como 2026-05-13 y no como 2026-05-12.
  return d.toLocaleDateString('en-CA', { timeZone });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BudgetForm({ budget, onSuccess }: BudgetFormProps) {
  const router = useRouter();
  const toast = useToast();
  const user = useUserStore((state) => state.user);
  const { data: productsData = [] } = useProducts();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const operacion = useOperacion();

  const isEditMode = Boolean(budget);

  // Product search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [items, setItems] = useState<BudgetItem[]>(budget?.items ?? []);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const isSubmitting = createBudget.isPending || updateBudget.isPending;
  const products = productsData.filter((p) => p.isForSale && p.price > 0);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    defaultValues: {
      customerName: budget?.customerName ?? '',
      customerPhone: budget?.customerPhone ?? '',
      customerEmail: budget?.customerEmail ?? '',
      customerRif: budget?.customerRif ?? '',
      customerIdType: budget?.customerIdType ?? 'V',
      customerAddress: budget?.customerAddress ?? '',
      customerType: budget?.customerType ?? 'no_contribuyente',
      eventName: budget?.eventName ?? '',
      eventDate: formatDateForInput(budget?.eventDate, operacion.timezone),
      eventGuests: budget?.eventGuests ?? '',
      notes: budget?.notes ?? '',
      validUntil:
        formatDateForInput(budget?.validUntil, operacion.timezone) ||
        getDefaultValidUntil(),
      discountType: budget?.discountType ?? 'fixed',
      discountValue: budget?.discountValue ?? 0,
      serviceCharge: (budget?.serviceCharge ?? 0) > 0,
    },
  });

  const serviceChargeEnabled = watch('serviceCharge');
  const discountTypeValue = watch('discountType');
  const discountInputValue = watch('discountValue');

  // ─── Close dropdown on outside click ──────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Calculated values ────────────────────────────────────────────────────

  const tarifas = useTarifas();
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  // El presupuesto cobra servicio solo si la pantalla lo marca; la tasa sale de la configuración.
  const serviceChargeAmount = serviceChargeEnabled
    ? calcularServiceCharge(subtotal, true, tarifas)
    : 0;
  const subtotalWithService = subtotal + serviceChargeAmount;
  const rawDiscountValue = Number(discountInputValue) || 0;
  const discount =
    discountTypeValue === 'percentage'
      ? subtotalWithService * (Math.min(rawDiscountValue, 100) / 100)
      : rawDiscountValue;
  const total = Math.max(0, subtotalWithService - discount);

  // ─── Filtered products for search ─────────────────────────────────────────

  const searched = useBusqueda(products, searchQuery, ['name']);
  const filteredProducts = useMemo(() => searched.slice(0, 8), [searched]);

  // ─── Item handlers ────────────────────────────────────────────────────────

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === product.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQuantity = existing.quantity + 1;
        updated[existingIndex] = {
          ...existing,
          quantity: newQuantity,
          total: newQuantity * existing.unitPrice,
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          description: product.description ?? undefined,
          quantity: 1,
          unitPrice: product.price,
          total: product.price,
        },
      ];
    });
    setSearchQuery('');
    setShowDropdown(false);
  }, []);

  const updateItemQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity < 1) return;
      setItems((prev) =>
        prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity, total: quantity * item.unitPrice }
            : item,
        ),
      );
    },
    [],
  );

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  // ─── Submit ───────────────────────────────────────────────────────────────

  const onSubmit = async (data: BudgetFormValues) => {
    if (items.length === 0) {
      toast.warning({
        description: 'Agrega al menos un producto al presupuesto',
      });
      return;
    }

    try {
      const budgetData: Omit<Budget, 'id'> = {
        budgetNumber: budget?.budgetNumber ?? generateBudgetNumber(),
        customerName: data.customerName.trim(),
        customerPhone: data.customerPhone.trim() || undefined,
        customerEmail: data.customerEmail.trim() || undefined,
        customerRif: data.customerRif.trim() || undefined,
        customerIdType: data.customerRif.trim()
          ? data.customerIdType
          : undefined,
        customerAddress: data.customerAddress.trim() || undefined,
        customerType: data.customerType || undefined,
        eventName: data.eventName.trim(),
        // Anchorar a mediodia UTC: asi la misma fecha se muestra igual en
        // cualquier timezone del servidor o cliente (ningun +/- 12h la corre
        // a otro dia). Requerido porque en input type=date llega "YYYY-MM-DD"
        // y new Date(str) lo interpretaria como 00:00 UTC, desplazando el dia
        // al mostrarse en timezones < UTC.
        eventDate: data.eventDate
          ? new Date(`${data.eventDate}T12:00:00.000Z`)
          : undefined,
        eventGuests: data.eventGuests ? Number(data.eventGuests) : undefined,
        items,
        subtotal,
        serviceCharge: serviceChargeAmount,
        tax: 0,
        discountType: data.discountType,
        discountValue: rawDiscountValue,
        discount,
        total,
        notes: data.notes.trim() || undefined,
        status: budget?.status ?? BudgetStatusEnum.DRAFT,
        validUntil: data.validUntil
          ? new Date(`${data.validUntil}T12:00:00.000Z`)
          : undefined,
        createdAt: budget?.createdAt ?? new Date(),
        updatedAt: new Date(),
        createdBy: budget?.createdBy ?? user?.id ?? '',
      };

      if (isEditMode && budget) {
        await updateBudget.mutateAsync({
          id: budget.id,
          data: budgetData,
        });
        toast.success({ description: 'Presupuesto actualizado correctamente' });
      } else {
        await createBudget.mutateAsync(budgetData);
        toast.success({ description: 'Presupuesto creado correctamente' });
      }

      onSuccess?.();
      router.push('/private/budgets');
    } catch (error) {
      console.error('Error al guardar presupuesto:', error);
      toast.error({ description: 'Error al guardar el presupuesto' });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Client & Event Info ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand" />
              Datos del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Nombre del cliente"
              required
              placeholder="Nombre completo"
              error={errors.customerName}
              {...register('customerName', {
                required: 'El nombre del cliente es obligatorio',
              })}
            />
            <Input
              label="Teléfono"
              type="tel"
              placeholder="+58 412 1234567"
              {...register('customerPhone')}
            />
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="cliente@email.com"
              error={errors.customerEmail}
              {...register('customerEmail', {
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Correo electrónico inválido',
                },
              })}
            />

            {/* Datos fiscales (opcional, se reusan al generar factura) */}
            <div className="pt-3 mt-3 border-t border-line/40">
              <p className="text-xs text-dim mb-2">
                Datos fiscales (opcional, se usan si despues generas factura
                fiscal)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-dim block mb-1">Tipo</label>
                  <select
                    {...register('customerIdType')}
                    className="w-full px-3 py-2 text-sm bg-surface border border-line rounded-lg text-content focus:border-brand focus:outline-none"
                  >
                    <option value="V">V</option>
                    <option value="E">E</option>
                    <option value="J">J</option>
                    <option value="G">G</option>
                    <option value="P">P</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Input
                    label="RIF / Cédula"
                    placeholder="12345678 o 40123456-7"
                    {...register('customerRif')}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Input
                  label="Dirección fiscal"
                  placeholder="Av. Principal, edificio, número"
                  {...register('customerAddress')}
                />
              </div>
              <div className="mt-3">
                <label className="text-xs text-dim block mb-1">
                  Tipo de cliente (SENIAT)
                </label>
                <select
                  {...register('customerType')}
                  className="w-full px-3 py-2 text-sm bg-surface border border-line rounded-lg text-content focus:border-brand focus:outline-none"
                >
                  <option value="no_contribuyente">No contribuyente</option>
                  <option value="contribuyente_ordinario">
                    Contribuyente ordinario
                  </option>
                  <option value="contribuyente_formal">
                    Contribuyente formal
                  </option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand" />
              Datos del Evento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Nombre del evento"
              required
              placeholder="Ej: Cumpleaños, Reunión corporativa..."
              error={errors.eventName}
              {...register('eventName', {
                required: 'El nombre del evento es obligatorio',
              })}
            />
            <Input
              label="Fecha del evento"
              type="date"
              {...register('eventDate')}
            />
            <Input
              label="Cantidad de invitados"
              type="number"
              placeholder="Ej: 50"
              min={1}
              {...register('eventGuests', {
                valueAsNumber: true,
                min: { value: 1, message: 'Mínimo 1 invitado' },
              })}
              error={errors.eventGuests}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Product Selector ───────────────────────────────────────────── */}
      <Card className="overflow-visible relative z-30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand" />
            Agregar Productos
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-visible">
          <div ref={searchContainerRef} className="relative">
            <Input
              variant="search"
              placeholder="Buscar producto por nombre..."
              icon={Search}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(e.target.value.trim().length > 0);
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setShowDropdown(true);
              }}
            />

            {/* Dropdown results */}
            {showDropdown && filteredProducts.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-line bg-surface shadow-2xl">
                {filteredProducts.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-elevated transition-colors"
                      onClick={() => addItem(product)}
                    >
                      <span className="font-medium text-content">
                        {product.name}
                      </span>
                      <span className="text-dim font-semibold">
                        {formatearUsd(product.price)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showDropdown &&
              searchQuery.trim().length > 0 &&
              filteredProducts.length === 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-line bg-surface shadow-2xl px-4 py-3 text-dim text-sm">
                  No se encontraron productos
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* ── Items Table ────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand" />
              Productos del Presupuesto ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-elevated/50">
                    <th className="text-left px-4 py-3 font-semibold text-dim">
                      Producto
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-dim w-28">
                      Cantidad
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-dim w-28">
                      Precio Unit.
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-dim w-28">
                      Total
                    </th>
                    <th className="text-center px-4 py-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.productId}
                      className="border-b border-line hover:bg-elevated/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-content">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemQuantity(
                              item.productId,
                              parseInt(e.target.value, 10) || 1,
                            )
                          }
                          className="w-20 text-center rounded-lg border border-line py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-dim">
                        {formatearUsd(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-content">
                        {formatearUsd(item.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="p-1.5 rounded-lg text-danger hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Totals & Notes ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              placeholder="Observaciones, requerimientos especiales, decoración, etc."
              rows={5}
              className="w-full rounded-xl border border-line bg-surface/90 backdrop-blur-sm px-3 py-2 text-sm placeholder:text-brand-light/60 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-200 resize-none"
              {...register('notes')}
            />
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-dim">Subtotal</span>
              <span className="font-semibold text-content">
                {formatearUsd(subtotal)}
              </span>
            </div>

            {/* Service charge toggle */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-dim cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-line text-brand focus:ring-brand"
                  {...register('serviceCharge')}
                />
                Cargo por servicio ({porcentaje(tarifas.serviceRate)})
              </label>
              <span className="font-semibold text-sm text-content">
                {formatearUsd(serviceChargeAmount)}
              </span>
            </div>

            {/* Discount */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-dim whitespace-nowrap">
                  Descuento
                </label>
                <div className="flex rounded-lg border border-line overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setValue('discountType', 'fixed')}
                    className={`px-3 py-1 font-medium transition-colors ${
                      discountTypeValue === 'fixed'
                        ? 'bg-brand text-on-brand'
                        : 'bg-surface text-dim hover:bg-elevated'
                    }`}
                  >
                    $ Fijo
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('discountType', 'percentage')}
                    className={`px-3 py-1 font-medium transition-colors ${
                      discountTypeValue === 'percentage'
                        ? 'bg-brand text-on-brand'
                        : 'bg-surface text-dim hover:bg-elevated'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <input
                  type="number"
                  min={0}
                  max={discountTypeValue === 'percentage' ? 100 : undefined}
                  step={discountTypeValue === 'percentage' ? 1 : 0.01}
                  placeholder={
                    discountTypeValue === 'percentage' ? '0 %' : '$0.00'
                  }
                  className="w-28 text-right rounded-lg border border-line py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  {...register('discountValue', {
                    valueAsNumber: true,
                    min: 0,
                  })}
                />
                <span className="text-sm font-semibold text-danger">
                  -{formatearUsd(discount)}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-line pt-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-content">Total</span>
                <span className="text-lg font-bold text-content">
                  {formatearUsd(total)}
                </span>
              </div>
            </div>

            {/* Valid until */}
            <div className="pt-2">
              <Input
                label="Válido hasta"
                type="date"
                {...register('validUntil')}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/private/budgets')}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          isLoading={isSubmitting}
          startIcon={<FileText className="w-4 h-4" />}
        >
          {isEditMode ? 'Actualizar Presupuesto' : 'Crear Presupuesto'}
        </Button>
      </div>
    </form>
  );
}
