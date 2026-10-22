// app/private/pos/order/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Product } from '@/modelTypes/product';
import { Customer } from '@/modelTypes/customer';
import { OrderFormValues, orderSchema } from '@/shared/schemas/orderSchema';
import {
  OrderStatusEnum,
  OrderTypeEnum,
  PaymentStatusEnum,
  PRIVATE_ROUTES,
} from '@/shared';
import { OrderItem, ProductCustomization } from '@/modelTypes/orderItem';
import { useTable, useUpdateTable, tableKeys } from '@/hooks/useTables';
import {
  useOrder,
  useCreateOrder,
  useUpdateOrder,
  useActiveOrderByTable,
  orderKeys,
} from '@/hooks/useOrders';
import { useProductsForMenu } from '@/hooks/useProducts';
import { useWaiters } from '@/hooks/useUsers';
import { Order } from '@/modelTypes/order';
import { Button } from '@/components/shared/button/Button';
import ProductSelector from '@/features/pos/ProductSelector';
import OrderSummary from '@/features/pos/OrderSummary';
import OrderChangeLog from '@/features/pos/OrderChangeLog';
import EditAuthModal, { LockedItemInfo } from '@/features/pos/EditAuthModal';
import MergeOrderModal from '@/features/pos/MergeOrderModal';
import { ApiError } from '@/services/api/apiClient';
import Loader from '@/components/shared/Loader/Loader';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  CreditCard,
  ChefHat,
  MessageSquareText,
  RotateCcw,
  Printer,
  ChevronLeft,
} from 'lucide-react';
import Modal from '@/components/shared/modal';
import { useToast } from '@/components/hooks/useToast';
import {
  isRemotePrintServiceConnected,
  printComanda,
} from '@/features/pos/services/thermalPrintService';
import {
  applyPrintAttemptToItems,
  recordPrintAttempt,
} from '@/shared/utils/recordPrintAttempt';
import { enqueuePrintFichaSafe } from '@/features/pos/services/fichaPrintService';
import {
  classifyPrintError,
  generateAttemptId,
} from '@/shared/utils/printAudit';
import { generateOrderNumber } from '@/shared/utils/orderNumber';
import {
  addOneToLine,
  lineTotal,
  newLine,
  printQty,
} from '@/shared/utils/packs';
import { PrintAttemptStatus } from '@/modelTypes/orderItem';
import { buscarSocio } from '@/features/pos/services/sociosService';
import { vincularOrdenAlDiaDeAlmacen } from '@/hooks/useAlmacen';
import { useTarifas } from '@/shared/config';
import { useNominaConfig } from '@/features/payroll/hooks/useNominaConfig';
import {
  calcularTotalesOrden,
  tasasGuardadasDe,
} from '@/features/pos/services/totalesOrden';

import ModalDeConversionAPack from '@/features/pos/ModalDeConversionAPack';
import {
  useOpcionesDeConversion,
  useConvertirPack,
  type OpcionConversion,
} from '@/hooks/usePackConversion';
import { formatearUsd } from '@/shared/utils/dinero';

// Componentes extraídos
import { OrderHeader } from './components/OrderHeader';
import { ClientFields } from './components/ClientFields';
import { CancelledItemsSection } from './components/CancelledItemsSection';
// Hooks extraídos
import { useReservaDeMesa } from './hooks/useReservaDeMesa';
import { useWaiterDropdown } from './hooks/useWaiterDropdown';
import { usePrintServiceAvailable } from '@/features/pos/hooks/usePrintServiceAvailable';
import { comandaPrintOutcome } from '@/features/pos/utils/comandaPrintOutcome';
// Utils extraídos
import { toFormOrderItems } from './utils/helpers';
import { SECTOR_LABELS } from './utils/constants';

export default function OrderPage() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const toast = useToast();
  const tableId = searchParams.get('tableId');
  const orderId = searchParams.get('orderId');
  const waiterId = searchParams.get('waiterId');
  const sectorParam = searchParams.get('sector');
  const router = useRouter();
  const queryClient = useQueryClient();

  const sessionRole = session?.user?.role;
  const isWaiter = sessionRole === 'waiter';

  // React Query hooks for tables, orders, products, and employees
  const { data: tableData } = useTable(tableId || '');
  const { data: orderData } = useOrder(orderId || '');
  const { data: activeOrderByTableData } = useActiveOrderByTable(tableId || '');
  const { data: productsData = [] } = useProductsForMenu();
  const { data: usersData = [] } = useWaiters();
  const updateTable = useUpdateTable();
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();

  // Tracking de reserva: si el usuario sale sin crear orden, liberamos la mesa.
  const orderCreatedRef = useRef(false);

  // Deduplicación de orden por mala red: genera una sola vez y mantiene estable en reintentos.
  // Se resetea al terminar (éxito o error) para que la próxima orden tenga ID nuevo.
  const orderRequestIdRef = useRef<string | undefined>(undefined);

  const currentUserId = session?.user?.id;

  // Heartbeat + release para reservar la mesa
  useReservaDeMesa(
    tableId ?? null,
    orderId ?? null,
    currentUserId ?? null,
    orderCreatedRef,
  );

  const [selectedWaiterId, setSelectedWaiterId] = useState<string | null>(
    searchParams.get('waiterId') ??
      (isWaiter ? (session?.user?.id ?? null) : null),
  );
  const [waiterName, setWaiterName] = useState<string | null>(null);
  const [showWaiterDropdown, setShowWaiterDropdown] = useState(false);

  const _waiterDropdownRef = useWaiterDropdown(showWaiterDropdown, () =>
    setShowWaiterDropdown(false),
  );
  const [_selectedCustomer, _setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingOrder, setExistingOrder] = useState<Order | null>(null);
  const [showMerge, setShowMerge] = useState(false);
  const loadedOrderIdRef = useRef<string | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isLookingUpMember, setIsLookingUpMember] = useState(false);

  // `useWaiters()` ya devuelve solo los mesoneros activos.
  const waiters = usersData;

  // Estados para confirmación de eliminación
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    index: number;
    name: string;
  } | null>(null);

  // Candado anti-fraude: modal PIN+motivo cuando el backend responde 428
  // (se intentó quitar items ya comandados a cocina/barra)
  const [showEditAuth, setShowEditAuth] = useState(false);
  const [editAuthLocked, setEditAuthLocked] = useState<LockedItemInfo[]>([]);
  const [editAuthError, setEditAuthError] = useState<string | null>(null);
  const pendingSubmitRef = useRef<OrderFormValues | null>(null);
  // Baja de un item ya comandado que espera autorización (× o − por debajo de
  // sentQty): el mismo modal PIN se abre AL MOMENTO del clic, no al guardar.
  const pendingItemEditRef = useRef<
    | { type: 'remove'; index: number }
    | { type: 'setQty'; index: number; quantity: number }
    | null
  >(null);

  // Estado para búsqueda de productos (elevado al padre)
  const [searchTerm, setSearchTerm] = useState('');

  // Nombre real de la mesa (cargado desde Firestore)
  const [tableName, setTableName] = useState<string | null>(null);

  // Estado del servicio de impresión
  const isPrintServiceAvailable = usePrintServiceAvailable();
  const [isPrintingComanda, setIsPrintingComanda] = useState(false);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState,
    control,
    getValues,
    register,
  } = useForm<OrderFormValues>({
    resolver: yupResolver(orderSchema),
    defaultValues: {
      tableId: tableId || null,
      waiterId: waiterId || null,
      customerAlias: null,
      associateNumber: null,
      sector: sectorParam || null,
      customerId: null,
      status: OrderStatusEnum.PENDING,
      items: [],
      subtotal: 0,
      serviceCharge: 0,
      tax: 0,
      total: 0,
      paymentMethod: null,
      paymentStatus: PaymentStatusEnum.PENDING,
      notes: '',
    },
  });

  // Log de errores de validacion (solo en desarrollo)
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      Object.keys(formState.errors).length > 0
    ) {
      console.error('Errores de validacion del formulario:', formState.errors);
    }
  }, [formState.errors]);

  // Nota: los watch de items/subtotal/tax/total/notes viven dentro de
  // <OrderFooterSection> (ver al final de este archivo) para aislar los
  // re-renders. Cuando el padre se subscribia a los 5 watch, cada tecla
  // disparaba re-render del arbol completo y bloqueaba las soft navs de
  // Next router. Los handlers siguen leyendo con getValues().

  // Cargar nombre de la mesa cuando hay tableId
  useEffect(() => {
    if (tableData?.name) {
      setTableName(tableData.name);
    }
  }, [tableData?.name]);

  // Sincronizar nombre y form cuando cambia el mesonero seleccionado
  useEffect(() => {
    if (selectedWaiterId && waiters.length > 0) {
      const waiter = waiters.find((w) => w.id === selectedWaiterId);
      setWaiterName(waiter?.name ?? null);
    } else if (!selectedWaiterId) {
      setWaiterName(null);
    }

    if (getValues('waiterId') !== selectedWaiterId) {
      setValue('waiterId', selectedWaiterId);
    }
  }, [selectedWaiterId, waiters, setValue, getValues]);

  // El mesonero se asigna a si mismo aunque la sesion llegue DESPUES del
  // primer render (el `useState` inicial la ve vacia). Asi el servicio se calcula
  // con el mismo mesonero que se guarda, en vez de rellenarlo al crear.
  const sessionUserId = session?.user.id ?? null;
  useEffect(() => {
    if (isWaiter && sessionUserId && !selectedWaiterId) {
      setSelectedWaiterId(sessionUserId);
    }
  }, [isWaiter, sessionUserId, selectedWaiterId]);

  // Carga una orden existente si se provee orderId o si la mesa tiene una orden activa
  useEffect(() => {
    const loadExistingOrder = async () => {
      if (!orderId && !tableId) return;

      try {
        let order: Order | null = null;

        if (orderId && orderData) {
          const activeStatuses: OrderStatusEnum[] = [
            OrderStatusEnum.PENDING,
            OrderStatusEnum.IN_PROGRESS,
            OrderStatusEnum.READY,
          ];
          if (activeStatuses.includes(orderData.status)) {
            order = orderData;
          }
        } else if (tableId && activeOrderByTableData) {
          order = activeOrderByTableData;
        }

        if (order && loadedOrderIdRef.current === order.id) {
          return;
        }

        setIsLoadingOrder(true);
        if (order) {
          loadedOrderIdRef.current = order.id;
          setExistingOrder(order);
          if (order.waiterId) setSelectedWaiterId(order.waiterId);
          reset({
            tableId: order.tableId || null,
            waiterId: order.waiterId || searchParams.get('waiterId') || null,
            customerAlias: order.customerAlias || null,
            associateNumber: order.associateNumber || null,
            sector: order.sector || sectorParam || null,
            customerId: order.customerId || null,
            status: order.status,
            items: order.items.map((item) => ({
              ...item,
              name: item.name || item.productName || '',
              unitPrice:
                item.unitPrice ||
                (item.quantity
                  ? (item.total || item.totalPrice || 0) / item.quantity
                  : 0),
              total:
                item.total ||
                item.totalPrice ||
                item.quantity * item.unitPrice ||
                0,
              notes: item.notes ?? null,
            })),
            subtotal: order.subtotal,
            serviceCharge: order.serviceCharge || 0,
            tax: order.tax,
            total: order.total,
            paymentMethod: order.paymentMethod || null,
            paymentStatus: order.paymentStatus || PaymentStatusEnum.PENDING,
            notes: order.notes || '',
          });
        }
      } catch {
      } finally {
        setIsLoadingOrder(false);
      }
    };

    void loadExistingOrder();
  }, [orderId, tableId, orderData?.id, activeOrderByTableData?.id, reset]);

  // Tarifas y nómina de la configuración. Una orden ya guardada se recalcula con SUS tasas.
  const tarifas = useTarifas();
  const nomina = useNominaConfig();

  // --- REFACTOR DE PERFORMANCE: Recálculo determinista de totales sin observar agresivamente el store ---
  const recalculateTotals = useCallback(
    (currentItems: OrderItem[], currentWaiterId: string | null) => {
      const totals = calcularTotalesOrden({
        items: currentItems,
        tieneMesonero: !!currentWaiterId,
        tarifas,
        nomina,
        guardadas: tasasGuardadasDe(existingOrder),
      });

      // Aplicar updates silenciados.
      if (getValues('subtotal') !== totals.subtotal)
        setValue('subtotal', totals.subtotal, { shouldValidate: false });
      if (getValues('serviceCharge') !== totals.serviceCharge)
        setValue('serviceCharge', totals.serviceCharge, {
          shouldValidate: false,
        });
      if (getValues('tax') !== totals.tax)
        setValue('tax', totals.tax, { shouldValidate: false });
      if (getValues('total') !== totals.total)
        setValue('total', totals.total, { shouldValidate: false });
    },
    [getValues, setValue, tarifas, nomina, existingOrder],
  );

  // Cada vez que cambia explicitly el mesero temporal, afectamos el service charge en vivo y recontamos:
  useEffect(() => {
    recalculateTotals(getValues('items') ?? [], selectedWaiterId);
  }, [selectedWaiterId, recalculateTotals, getValues]);

  const handleAddProduct = useCallback(
    (product: Product, customization?: ProductCustomization) => {
      const currentItems = getValues('items');
      const customizationPrice = customization?.customizationPrice || 0;
      const finalPrice = product.price + customizationPrice;

      if (customization) {
        const now = new Date().toISOString();
        const newItem = {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: finalPrice,
          total: finalPrice,
          notes: '',
          customizations: customization,
          station: product.station ?? null,
          addedAt: now,
          addedBy: session?.user.id ?? undefined,
          quantityLog: [{ qty: 1, at: now }],
        };
        const newItems = [...currentItems, newItem];
        setValue('items', newItems);
        recalculateTotals(newItems, selectedWaiterId);
      } else {
        const existingItemIndex = currentItems.findIndex(
          (item) => item.productId === product.id && !item.customizations,
        );

        if (existingItemIndex >= 0) {
          const updatedItems = [...currentItems];
          const prev = updatedItems[existingItemIndex];
          // Los tobos/cajas se guardan expandidos a unidades: sumar 1 dejaba la
          // linea en 13 y cobraba 13 x $0.9167 = $11.92 por dos tobos de $11.
          const grown = addOneToLine(prev, product.id, product.price);
          prev.quantity = grown.quantity;
          prev.unitPrice = grown.unitPrice;
          prev.total = grown.total;
          if (grown.presentationQty)
            prev.presentationQty = grown.presentationQty;
          const log = prev.quantityLog || [];
          log.push({
            qty: prev.quantity,
            at: new Date().toISOString(),
          });
          prev.quantityLog = log;
          setValue('items', updatedItems);
          recalculateTotals(updatedItems, selectedWaiterId);
        } else {
          const now2 = new Date().toISOString();
          const line = newLine(product.id, product.price);
          const newItem = {
            productId: product.id,
            name: product.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.total,
            presentationQty: line.presentationQty,
            notes: '',
            customizations: null,
            station: product.station ?? null,
            addedAt: now2,
            addedBy: session?.user.id ?? undefined,
            quantityLog: [{ qty: line.quantity, at: now2 }],
          };
          const newArray = [...currentItems, newItem];
          setValue('items', newArray);
          recalculateTotals(newArray, selectedWaiterId);
        }
      }
    },
    [getValues, setValue, session, recalculateTotals, selectedWaiterId],
  );

  const handleRemoveItem = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      const currentItems = getValues('items');
      const item = currentItems[index];
      if (!item) return;

      // Item ya comandado (sentQty>0): exige PIN+motivo AL MOMENTO, antes de
      // quitarlo. Correcciones de items aún no enviados a cocina siguen libres.
      if ((item.sentQty ?? 0) > 0) {
        pendingItemEditRef.current = { type: 'remove', index };
        setEditAuthLocked([{ name: item.name, qty: item.quantity }]);
        setEditAuthError(null);
        setShowEditAuth(true);
        return;
      }

      setItemToDelete({ index, name: item.name });
      setShowDeleteConfirm(true);
    },
    [getValues],
  );

  const confirmDeleteItem = useCallback(() => {
    if (itemToDelete) {
      const currentItems = getValues('items');
      const newItems = currentItems.filter((_, i) => i !== itemToDelete.index);
      setValue('items', newItems);
      recalculateTotals(newItems, selectedWaiterId);

      toast.success({
        title: 'Producto eliminado',
        description: `${itemToDelete.name} ha sido eliminado de la orden`,
      });
    }

    setShowDeleteConfirm(false);
    setItemToDelete(null);
  }, [
    itemToDelete,
    getValues,
    setValue,
    toast,
    recalculateTotals,
    selectedWaiterId,
  ]);

  const cancelDeleteItem = useCallback(() => {
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  }, []);

  // Busca un socio por N° accion y autocompleta el alias con el nombre.
  // Acepta el numero con o sin padding (ej: 4 o 00004) y lo normaliza a 5 digitos.
  const handleLookupMember = useCallback(async () => {
    const raw = (getValues('associateNumber') || '').trim();
    if (!raw || !/^\d+$/.test(raw)) return;

    // Normalizar a 5 digitos con padding
    const paddedAction = raw.padStart(5, '0');

    // Actualizar el campo con el formato normalizado
    if (paddedAction !== raw) {
      setValue('associateNumber', paddedAction);
    }

    setIsLookingUpMember(true);
    try {
      const socio = await buscarSocio(paddedAction);

      if (!socio) {
        toast.error({
          title: 'Socio no encontrado',
          description: `No existe el socio #${paddedAction}`,
        });
        return;
      }

      // Autocompletar el alias con el nombre del socio
      setValue('customerAlias', socio.nombre);

      const { creditAvailable, creditMonthsPaid, nombre, cedula } = socio;
      if (creditAvailable > 0) {
        toast.success({
          title: `Socio encontrado — Crédito: $${creditAvailable.toFixed(2)}`,
          description: `${nombre} (CI: ${cedula}) · ${creditMonthsPaid} mes(es) al día`,
        });
      } else {
        toast.success({
          title: 'Socio encontrado',
          description: `${nombre} (CI: ${cedula})`,
        });
      }
    } catch (err) {
      console.error('[lookupMember]', err);
      toast.error({
        title: 'Error',
        description: 'No se pudo buscar el socio',
      });
    } finally {
      setIsLookingUpMember(false);
    }
  }, [watch, setValue, toast]);

  const handleQuantityChange = useCallback(
    (index: number, newQuantity: number) => {
      if (newQuantity < 1) return;
      const currentItems = getValues('items');
      const item = currentItems[index];
      if (!item) return;

      // Reducir por debajo de lo YA comandado exige PIN+motivo al momento.
      // Subir cantidad o bajar unidades aún no enviadas sigue libre.
      const sent = item.sentQty ?? 0;
      if (sent > 0 && newQuantity < sent) {
        pendingItemEditRef.current = {
          type: 'setQty',
          index,
          quantity: newQuantity,
        };
        setEditAuthLocked([
          { name: item.name, qty: item.quantity - newQuantity },
        ]);
        setEditAuthError(null);
        setShowEditAuth(true);
        return;
      }

      const updatedItems = [...currentItems];
      updatedItems[index].quantity = newQuantity;
      // En packs el unitario es periodico (11/12): sin redondear, 2 tobos dan
      // $22.0008 y ese es el numero que termina cobrando el mesonero.
      updatedItems[index].total = lineTotal(
        updatedItems[index].unitPrice,
        newQuantity,
        updatedItems[index].productId,
        updatedItems[index].presentationQty,
      );
      const log = updatedItems[index].quantityLog || [];
      log.push({ qty: newQuantity, at: new Date().toISOString() });
      updatedItems[index].quantityLog = log;
      setValue('items', updatedItems);
      recalculateTotals(updatedItems, selectedWaiterId);
    },
    [getValues, setValue, recalculateTotals, selectedWaiterId],
  );

  // ── Conversion a pack: la calcula y la aplica el SERVIDOR ──
  //
  // Antes esta pantalla convertia el CARRITO: tomaba todas las lineas
  // elegibles por cantidad pedida y las convertia de un toque, con los
  // precios cableados en `@odin6/types` (que decia $11 para un tobo de lata
  // que el catalogo cobra a $14). Decision del dueno (21/09/2026): una sola
  // regla en la web y en el APK, y es sobre lo ENTREGADO. Si el cliente pide
  // un tobo, se pide el tobo del menu, que ya existe como producto.
  const { data: opcionesDeConversion = [] } = useOpcionesDeConversion(
    existingOrder?.id,
  );
  const convertirPack = useConvertirPack();
  const [modalDeConversionAbierto, setModalDeConversionAbierto] =
    useState(false);

  const handleConvertirPack = useCallback(
    async (opcion: OpcionConversion, packsToConvert: number) => {
      if (!existingOrder) return;
      try {
        await convertirPack.mutateAsync({
          orderId: existingOrder.id,
          sourceProductId: opcion.sourceProductId,
          targetPackId: opcion.targetPackId,
          packsToConvert,
        });
        setModalDeConversionAbierto(false);
        toast.success({
          title: 'Conversión aplicada',
          description: `${packsToConvert} × ${opcion.packName}. Ahorro para el cliente: ${formatearUsd(opcion.savingsUsd * packsToConvert)}`,
        });
      } catch (error: unknown) {
        toast.error({
          title: 'No se pudo convertir',
          description:
            error instanceof Error
              ? error.message
              : 'El servidor rechazó la conversión.',
        });
      }
    },
    [existingOrder, convertirPack, toast],
  );

  // Aplica la baja de un item comandado UNA VEZ autorizada con PIN+motivo.
  // Persiste de inmediato con editPin/editReason: el backend valida el PIN,
  // registra la cancelación (cancelledItems) y devuelve la orden. Si el PIN es
  // inválido, deja el modal abierto con el error y NO toca el estado local.
  const applyAuthorizedItemEdit = useCallback(
    async (pin: string, reason: string) => {
      const pending = pendingItemEditRef.current;
      if (!pending) return;

      const currentItems = getValues('items');
      const newItems =
        pending.type === 'remove'
          ? currentItems.filter((_, i) => i !== pending.index)
          : currentItems.map((it, i) =>
              i === pending.index
                ? {
                    ...it,
                    quantity: pending.quantity,
                    total: lineTotal(
                      it.unitPrice,
                      pending.quantity,
                      it.productId,
                      it.presentationQty,
                    ),
                    quantityLog: [
                      ...(it.quantityLog || []),
                      { qty: pending.quantity, at: new Date().toISOString() },
                    ],
                  }
                : it,
            );

      // Sin orden persistida no hay nada que autorizar contra el backend
      // (un item comandado siempre implica orden existente, pero por seguridad).
      if (!existingOrder) {
        setValue('items', newItems);
        recalculateTotals(newItems, selectedWaiterId);
        pendingItemEditRef.current = null;
        setShowEditAuth(false);
        setEditAuthLocked([]);
        return;
      }

      setIsSubmitting(true);
      try {
        await updateOrder.mutateAsync({
          id: existingOrder.id,
          data: {
            items: newItems,
            editPin: pin,
            editReason: reason,
            updatedAt: new Date(),
          } as Partial<Order> & { editPin?: string; editReason?: string },
        });
        setValue('items', newItems);
        recalculateTotals(newItems, selectedWaiterId);
        pendingItemEditRef.current = null;
        setShowEditAuth(false);
        setEditAuthLocked([]);
        setEditAuthError(null);
        toast.success({
          title: 'Cambio autorizado',
          description:
            pending.type === 'remove'
              ? 'Producto eliminado y registrado'
              : 'Cantidad reducida y registrada',
        });
      } catch (error) {
        // 428 con PIN inválido → mantener el modal abierto con el error.
        if (error instanceof ApiError && error.status === 428) {
          let authError = 'PIN inválido — intenta de nuevo';
          try {
            const parsed = JSON.parse(error.message) as {
              code?: string;
              message?: string;
            };
            if (parsed.code && parsed.code !== 'EDIT_PIN_INVALID') {
              authError = parsed.message ?? authError;
            }
          } catch {
            // body no-JSON: mensaje genérico
          }
          setEditAuthError(authError);
        } else {
          setEditAuthError(
            error instanceof Error ? error.message : 'No se pudo autorizar',
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      getValues,
      setValue,
      existingOrder,
      updateOrder,
      recalculateTotals,
      selectedWaiterId,
      toast,
    ],
  );

  const handleItemNotesChange = useCallback(
    (index: number, notes: string) => {
      const currentItems = getValues('items');
      const updatedItems = [...currentItems];
      updatedItems[index].notes = notes;
      setValue('items', updatedItems);
    },
    [watch, setValue],
  );

  const handleDeliveryChange = useCallback(
    async (itemIndex: number, newQty: number) => {
      const currentItems = getValues('items');
      const updatedItems = currentItems.map((item, i) =>
        i === itemIndex ? { ...item, deliveredQty: newQty } : item,
      );
      setValue('items', updatedItems);
      // Aqui no cambia precio, pero por seguridad:
      recalculateTotals(updatedItems, selectedWaiterId);
      if (existingOrder) {
        try {
          await updateOrder.mutateAsync({
            id: existingOrder.id,
            data: {
              items: updatedItems,
              updatedAt: new Date(),
            },
          });
        } catch {
          // No bloquear UI si falla la actualización silenciosa
        }
      }
    },
    [
      getValues,
      setValue,
      existingOrder,
      updateOrder,
      recalculateTotals,
      selectedWaiterId,
    ],
  );

  const _handlePrintComanda = useCallback(async () => {
    const currentItems = getValues('items');
    const newItems = currentItems.filter(
      (item) => item.quantity > (item.sentQty ?? 0),
    );

    if (newItems.length === 0) {
      toast.info({
        title: 'Sin ítems nuevos',
        description: 'Todo ya fue enviado a cocina',
      });
      return;
    }

    setIsPrintingComanda(true);
    const requestAt = new Date();
    let printStatus: PrintAttemptStatus = 'exception';
    let errorMessage: string | null = null;
    let via: 'local' | 'queue' | null = null;
    let serviceResponse: Record<string, unknown> | null = null;

    try {
      const currentNotes = getValues('notes') || null;
      const orderData = existingOrder
        ? { ...existingOrder, notes: currentNotes }
        : {
            id: `temp-${Date.now()}`,
            tableId: tableId,
            items: currentItems,
            status: getValues('status'),
            total: getValues('total'),
            subtotal: getValues('subtotal'),
            serviceCharge: getValues('serviceCharge'),
            tax: getValues('tax'),
            paymentMethod: getValues('paymentMethod'),
            paymentStatus: getValues('paymentStatus'),
            notes: currentNotes,
            waiterId: getValues('waiterId'),
            customerId: getValues('customerId'),
            customerAlias: getValues('customerAlias'),
            associateNumber: getValues('associateNumber'),
            sector: getValues('sector'),
            userId: session?.user.id ?? '',
            orderType: tableId ? 'dine-in' : 'takeaway',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

      try {
        const result = await printComanda(
          orderData as Parameters<typeof printComanda>[0],
          newItems,
          {
            tableId,
            tableName,
            waiterName,
          },
        );
        via = (result as unknown as { via?: 'local' | 'queue' }).via ?? null;
        serviceResponse = result as unknown as Record<string, unknown>;

        if (result.success) {
          printStatus = via === 'queue' ? 'queued' : 'success';
        } else {
          printStatus = 'http_500';
          errorMessage = result.error ?? 'Error desconocido del print service';
        }
      } catch (err) {
        const classified = classifyPrintError(err);
        printStatus = classified.status;
        errorMessage = classified.message;
      }

      // Registrar el intento en audit trail (SIEMPRE, incluso si fallo)
      const { attempt } = await recordPrintAttempt({
        order: {
          id: orderData.id,
          tableId: orderData.tableId ?? null,
          tableName: tableName ?? null,
          sector: orderData.sector ?? null,
          waiterId: orderData.waiterId ?? null,
          waiterName: waiterName ?? null,
        },
        type: 'comanda',
        userId: session?.user.id ?? 'unknown',
        items: newItems.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: printQty(
            i.quantity - (i.sentQty ?? 0),
            i.productId,
            i.presentationQty,
          ),
          station:
            (i.station as 'KITCHEN' | 'BAR' | 'PIZZA' | null) ?? 'KITCHEN',
          notes: i.notes ?? null,
        })),
        requestPayload: { orderId: orderData.id, items: newItems },
        requestAt,
        status: printStatus,
        errorMessage,
        via,
        serviceResponse,
      });

      // Ficha con QR: barra, cocina y pizza solo entregan escaneandola, asi que
      // acompaña a cada comanda. El servidor la parte por estacion.
      enqueuePrintFichaSafe(orderData.id);

      // Aplicar el intento a los items (solo sube printedQty si fue success)
      const updatedItems = applyPrintAttemptToItems(
        currentItems,
        attempt,
        newItems.map((i) => ({
          productId: i.productId,
          qty: printQty(
            i.quantity - (i.sentQty ?? 0),
            i.productId,
            i.presentationQty,
          ),
        })),
      );
      setValue('items', toFormOrderItems(updatedItems));

      if (existingOrder) {
        await updateOrder.mutateAsync({
          id: existingOrder.id,
          data: {
            items: updatedItems,
            updatedAt: new Date(),
          },
        });
      }

      if (printStatus === 'success') {
        toast.success({
          title: '¡Impresión exitosa!',
          description: 'Comanda impresa correctamente en la estación',
        });
      } else if (printStatus === 'queued') {
        toast.warning({
          title: 'Comanda encolada',
          description: 'Servicio local offline — se imprimira cuando vuelva',
        });
      } else {
        toast.error({
          title: 'Error de impresión',
          description:
            errorMessage ?? 'Revisa la impresora. Intento registrado en audit.',
        });
      }
    } finally {
      setIsPrintingComanda(false);
    }
  }, [
    watch,
    setValue,
    existingOrder,
    tableId,
    tableName,
    waiterName,
    session,
    toast,
    updateOrder,
  ]);

  // Reimprimir comanda completa (todos los items, sin importar sentQty)
  const handleReprintComanda = useCallback(async () => {
    const currentItems = getValues('items');
    if (currentItems.length === 0) {
      toast.info({
        title: 'Sin ítems',
        description: 'La orden no tiene productos',
      });
      return;
    }

    setIsPrintingComanda(true);
    const requestAt = new Date();
    let printStatus: PrintAttemptStatus = 'exception';
    let errorMessage: string | null = null;
    let via: 'local' | 'queue' | null = null;
    let serviceResponse: Record<string, unknown> | null = null;

    try {
      const currentNotes = getValues('notes') || null;
      const orderData = existingOrder
        ? { ...existingOrder, notes: currentNotes }
        : {
            id: `temp-${Date.now()}`,
            tableId,
            items: currentItems,
            status: getValues('status'),
            total: getValues('total'),
            subtotal: getValues('subtotal'),
            serviceCharge: getValues('serviceCharge'),
            tax: getValues('tax'),
            paymentMethod: getValues('paymentMethod'),
            paymentStatus: getValues('paymentStatus'),
            notes: currentNotes,
            waiterId: getValues('waiterId'),
            customerId: getValues('customerId'),
            customerAlias: getValues('customerAlias'),
            associateNumber: getValues('associateNumber'),
            sector: getValues('sector'),
            userId: session?.user.id ?? '',
            orderType: tableId ? 'dine-in' : 'takeaway',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

      try {
        const result = await printComanda(
          orderData as Parameters<typeof printComanda>[0],
          currentItems,
          {
            tableId,
            tableName,
            waiterName,
            isCopy: true,
          },
        );
        via = (result as unknown as { via?: 'local' | 'queue' }).via ?? null;
        serviceResponse = result as unknown as Record<string, unknown>;

        if (result.success) {
          printStatus = via === 'queue' ? 'queued' : 'success';
        } else {
          printStatus = 'http_500';
          errorMessage = result.error ?? 'Error desconocido';
        }
      } catch (err) {
        const classified = classifyPrintError(err);
        printStatus = classified.status;
        errorMessage = classified.message;
      }

      // Registrar el intento en audit trail (tipo 'reprint' — no modifica printedQty)
      await recordPrintAttempt({
        order: {
          id: orderData.id,
          tableId: orderData.tableId ?? null,
          tableName: tableName ?? null,
          sector: orderData.sector ?? null,
          waiterId: orderData.waiterId ?? null,
          waiterName: waiterName ?? null,
        },
        type: 'reprint',
        userId: session?.user.id ?? 'unknown',
        items: currentItems.map((i) => ({
          productId: i.productId,
          name: i.name,
          qty: printQty(i.quantity, i.productId, i.presentationQty),
          station:
            (i.station as 'KITCHEN' | 'BAR' | 'PIZZA' | null) ?? 'KITCHEN',
          notes: i.notes ?? null,
        })),
        requestPayload: {
          orderId: orderData.id,
          items: currentItems,
          isCopy: true,
        },
        requestAt,
        status: printStatus,
        errorMessage,
        via,
        serviceResponse,
      });

      // Reimprimir la comanda sin su ficha deja a la estacion con el papel
      // pero sin el QR — y sin QR no puede entregar. La reimpresion tiene que
      // reponer las dos cosas.
      enqueuePrintFichaSafe(orderData.id);

      if (printStatus === 'success') {
        toast.success({
          title: '¡Impresión exitosa!',
          description: 'Comanda reimpresa correctamente en la estación',
        });
      } else if (printStatus === 'queued') {
        toast.warning({
          title: 'Reimpresion encolada',
          description: 'Servicio local offline',
        });
      } else {
        toast.error({
          title: 'Error de impresión',
          description: errorMessage ?? 'Revisa la impresora',
        });
      }
    } finally {
      setIsPrintingComanda(false);
    }
  }, [watch, existingOrder, tableId, tableName, waiterName, session, toast]);

  // Guardar orden + imprimir comanda en background (no bloquea UI)
  const handleProcessOrder = useCallback(async () => {
    const currentItems = getValues('items');
    if (currentItems.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    let orderToProcess: Order;

    // 1) Guardar/crear orden (bloqueante — necesario para tener ID)
    try {
      if (existingOrder) {
        await updateOrder.mutateAsync({
          id: existingOrder.id,
          data: {
            items: currentItems,
            waiterId: getValues('waiterId'),
            customerAlias: getValues('customerAlias'),
            associateNumber: getValues('associateNumber'),
            status: OrderStatusEnum.IN_PROGRESS,
            subtotal: getValues('subtotal'),
            serviceCharge: getValues('serviceCharge'),
            tax: getValues('tax'),
            total: getValues('total'),
            notes: getValues('notes') || null,
            updatedAt: new Date(),
          },
        });
        orderToProcess = existingOrder;
      } else {
        const isZoneOrder = !!getValues('sector');
        let orderNumber: string | null = null;
        try {
          orderNumber = await generateOrderNumber();
        } catch {
          // sin numero legible si falla
        }

        // Generar clientRequestId una sola vez (estable en reintentos)
        if (!orderRequestIdRef.current) {
          orderRequestIdRef.current = generateAttemptId();
        }

        const orderData: Omit<Order, 'id'> & { clientRequestId?: string } = {
          orderNumber,
          tableId: getValues('tableId'),
          // Sin mesonero elegido la orden va SIN mesonero, como en la caja del
          // APK: antes se estampaba a quien comandaba (admin/cajero) y la orden
          // se guardaba con servicio 0; al abrir el cobro aparecia un servicio que
          // nadie habia visto y la propina quedaba a nombre del admin.
          waiterId: getValues('waiterId') || null,
          customerAlias: getValues('customerAlias') || null,
          associateNumber: getValues('associateNumber') || null,
          sector: getValues('sector') || null,
          customerId: _selectedCustomer?.id || getValues('customerId') || null,
          userId: session?.user.id || '',
          status: OrderStatusEnum.IN_PROGRESS,
          orderType: isZoneOrder
            ? OrderTypeEnum.Zone
            : getValues('tableId')
              ? OrderTypeEnum.DineIn
              : OrderTypeEnum.Takeaway,
          items: currentItems,
          subtotal: getValues('subtotal'),
          serviceCharge: getValues('serviceCharge'),
          tax: getValues('tax'),
          total: getValues('total'),
          paymentMethod: null,
          paymentStatus: PaymentStatusEnum.PENDING,
          notes: getValues('notes') || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          clientRequestId: orderRequestIdRef.current,
        };
        orderToProcess = await createOrder.mutateAsync(orderData);
        orderCreatedRef.current = true;
        setExistingOrder(orderToProcess);
        // El servidor manda: si recalculó distinto, sus totales son los que se muestran.
        setValue('subtotal', orderToProcess.subtotal, {
          shouldValidate: false,
        });
        setValue('serviceCharge', orderToProcess.serviceCharge || 0, {
          shouldValidate: false,
        });
        setValue('tax', orderToProcess.tax || 0, { shouldValidate: false });
        setValue('total', orderToProcess.total, { shouldValidate: false });
        // Resetear ref para que la próxima orden tenga ID nuevo
        orderRequestIdRef.current = undefined;

        // Backend ya ocupo la mesa atomicamente al crear la orden.
        // No hace falta otro updateTable aqui.

        // fire-and-forget
        void vincularOrdenAlDiaDeAlmacen(orderToProcess.id).catch(() => {});
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      toast.error({ title: 'Error al guardar orden', description: msg });
      // NO resetear ref en error: permite reintento con el mismo ID
      setIsSubmitting(false);
      return;
    }

    // 2) Orden guardada → liberar UI YA. El usuario puede navegar a pagar.
    setIsSubmitting(false);
    if (isPrintServiceAvailable !== false) {
      toast.success({
        title: 'Orden guardada',
        description: 'Enviando comanda a cocina...',
      });
    } else {
      toast.warning({
        title: 'Orden guardada',
        description: 'Items pendientes de imprimir (impresora desconectada)',
      });
    }

    // 3) Impresión + audit + items update corren en background
    const newItems = currentItems.filter(
      (item) => item.quantity > (item.sentQty ?? 0),
    );
    if (newItems.length === 0) return;

    const orderSnapshot = orderToProcess;
    const notesSnapshot = getValues('notes') || null;
    const tableNameSnapshot = tableName;
    const waiterNameSnapshot = waiterName;
    const userIdSnapshot = session?.user.id ?? 'unknown';

    void (async () => {
      const requestAt = new Date();
      let printStatus: PrintAttemptStatus = 'exception';
      let errorMessage: string | null = null;
      let via: 'local' | 'queue' | null = null;
      let serviceResponse: Record<string, unknown> | null = null;

      let alert = false;

      // Se manda SIEMPRE: printComanda ya cae a la cola del servidor si no
      // hay impresora en este equipo. Ver comandaPrintOutcome.
      const orderWithNotes = { ...orderSnapshot, notes: notesSnapshot };
      try {
        const result = await printComanda(orderWithNotes, newItems, {
          tableId: orderSnapshot.tableId ?? null,
          tableName: tableNameSnapshot,
          waiterName: waiterNameSnapshot,
          cajaSummary: true,
        });
        via = result.via ?? null;
        serviceResponse = result as unknown as Record<string, unknown>;
        const outcome = comandaPrintOutcome(
          result,
          via === 'queue' ? await isRemotePrintServiceConnected() : null,
        );
        printStatus = outcome.status;
        errorMessage = outcome.errorMessage;
        alert = outcome.alert;
      } catch (err) {
        const classified = classifyPrintError(err);
        printStatus = classified.status;
        errorMessage = classified.message;
      }

      try {
        const { attempt } = await recordPrintAttempt({
          order: {
            id: orderSnapshot.id,
            tableId: orderSnapshot.tableId ?? null,
            tableName: tableNameSnapshot ?? null,
            sector: orderSnapshot.sector ?? null,
            waiterId: orderSnapshot.waiterId ?? null,
            waiterName: waiterNameSnapshot ?? null,
          },
          type: 'comanda',
          userId: userIdSnapshot,
          items: newItems.map((i) => ({
            productId: i.productId,
            name: i.name,
            qty: printQty(
              i.quantity - (i.sentQty ?? 0),
              i.productId,
              i.presentationQty,
            ),
            station:
              (i.station as 'KITCHEN' | 'BAR' | 'PIZZA' | null) ?? 'KITCHEN',
            notes: i.notes ?? null,
          })),
          requestPayload: {
            orderId: orderSnapshot.id,
            items: newItems,
            cajaSummary: true,
          },
          requestAt,
          status: printStatus,
          errorMessage,
          via,
          serviceResponse,
          alert,
        });

        // Ficha con QR (ver comentario en el otro envio de comanda).
        enqueuePrintFichaSafe(orderSnapshot.id);

        const latestItems = getValues('items');
        const updatedItems = applyPrintAttemptToItems(
          latestItems,
          attempt,
          newItems.map((i) => ({
            productId: i.productId,
            qty: printQty(
              i.quantity - (i.sentQty ?? 0),
              i.productId,
              i.presentationQty,
            ),
          })),
        );
        setValue('items', toFormOrderItems(updatedItems));

        // Solo actualizar la orden si hubo cambio en sentQty (success o queued)
        if (printStatus === 'success' || printStatus === 'queued') {
          await updateOrder.mutateAsync({
            id: orderSnapshot.id,
            data: { items: updatedItems, updatedAt: new Date() },
          });
        }
      } catch {
        // audit falló, no bloqueamos nada
      }

      if (printStatus === 'success' || (printStatus === 'queued' && !alert)) {
        // Encolada con el print-service conectado es lo normal cuando se
        // pide desde un equipo sin impresora: sale en segundos.
        toast.success({
          title: 'Comanda enviada',
          description: 'Enviada a las estaciones',
        });
      } else if (printStatus === 'queued') {
        toast.warning({
          title: 'Comanda en cola',
          description:
            'La impresión está desconectada: sale sola cuando vuelva',
        });
      } else {
        toast.error({
          title: 'Impresion fallida',
          description:
            errorMessage ??
            'Items quedan pendientes. Reintenta con "Procesar Orden".',
        });
      }
    })();
  }, [
    watch,
    setValue,
    existingOrder,
    isSubmitting,
    isPrintServiceAvailable,
    _selectedCustomer,
    session,
    tableName,
    waiterName,
    toast,
    updateTable,
    updateOrder,
    createOrder,
  ]);

  const onSubmit = useCallback(
    async (
      data: OrderFormValues,
      editAuth?: { pin: string; reason: string },
    ) => {
      if (isSubmitting) return;

      setIsSubmitting(true);

      let targetOrderId: string;
      let orderForPrint: Order;

      // Items con quantity > sentQty se imprimen mas abajo. Deben quedar
      // marcados como enviados EN ESTE MISMO guardado sincrono: este flujo
      // redirige duro a /payment y cualquier update posterior muere en el
      // camino. Imprimir sin persistir sentQty dejaba "fantasmas" que se
      // reimprimian en cada toque posterior (bug comandas duplicadas 19/07).
      const itemsToPrint = (data.items || []).filter(
        (item) => item.quantity > (item.sentQty ?? 0),
      );
      const willPrint = itemsToPrint.length > 0;
      const itemsForSave = willPrint
        ? (data.items || []).map((item) =>
            item.quantity > (item.sentQty ?? 0)
              ? { ...item, sentQty: item.quantity }
              : item,
          )
        : data.items || [];

      try {
        if (existingOrder) {
          const updateData: Partial<Order> & {
            editPin?: string;
            editReason?: string;
          } = {
            ...data,
            items: itemsForSave,
            status: OrderStatusEnum.IN_PROGRESS,
            customerId: _selectedCustomer?.id || data.customerId,
            updatedAt: new Date(),
            notes: data.notes || null,
            // Autorización PIN+motivo cuando se quitan items ya comandados
            ...(editAuth
              ? { editPin: editAuth.pin, editReason: editAuth.reason }
              : {}),
          };

          await updateOrder.mutateAsync({
            id: existingOrder.id,
            data: updateData,
          });
          targetOrderId = existingOrder.id;
          orderForPrint = {
            ...existingOrder,
            ...updateData,
            id: existingOrder.id,
          } as Order;
        } else {
          const isZoneOrder = !!data.sector;
          let orderNumber: string | null = null;
          try {
            orderNumber = await generateOrderNumber();
          } catch {
            // sin numero legible si falla
          }

          // Generar clientRequestId una sola vez (estable en reintentos)
          if (!orderRequestIdRef.current) {
            orderRequestIdRef.current = generateAttemptId();
          }

          const orderData: Omit<Order, 'id'> & { clientRequestId?: string } = {
            ...data,
            items: itemsForSave,
            orderNumber,
            status: OrderStatusEnum.IN_PROGRESS,
            customerId: _selectedCustomer?.id || null,
            userId: session?.user.id || '',
            orderType: isZoneOrder
              ? OrderTypeEnum.Zone
              : data.tableId
                ? OrderTypeEnum.DineIn
                : OrderTypeEnum.Takeaway,
            createdAt: new Date(),
            updatedAt: new Date(),
            notes: data.notes || null,
            clientRequestId: orderRequestIdRef.current,
          };

          const createdOrder = await createOrder.mutateAsync(orderData);
          orderCreatedRef.current = true;
          targetOrderId = createdOrder.id;
          orderForPrint = createdOrder;
          // Resetear ref para que la próxima orden tenga ID nuevo
          orderRequestIdRef.current = undefined;

          // Backend ya ocupo la mesa atomicamente al crear la orden.

          void vincularOrdenAlDiaDeAlmacen(createdOrder.id).catch(() => {});
        }
      } catch (error) {
        // 428: el backend exige PIN admin/manager + motivo porque el guardado
        // elimina/reduce items ya comandados → abrir modal y reintentar.
        if (error instanceof ApiError && error.status === 428) {
          let locked: LockedItemInfo[] = [];
          let authError: string | null = null;
          try {
            const parsed = JSON.parse(error.message) as {
              code?: string;
              lockedItems?: LockedItemInfo[];
            };
            locked = parsed.lockedItems ?? [];
            if (parsed.code === 'EDIT_PIN_INVALID') {
              authError = 'PIN inválido — intenta de nuevo';
            }
          } catch {
            // body no-JSON: modal genérico
          }
          if (locked.length > 0) setEditAuthLocked(locked);
          setEditAuthError(authError);
          pendingSubmitRef.current = data;
          setShowEditAuth(true);
          setIsSubmitting(false);
          return;
        }
        const errorMessage =
          error instanceof Error ? error.message : 'Error desconocido';
        toast.error({
          title: 'Error al guardar',
          description: `No se pudo guardar la orden: ${errorMessage}`,
          duration: 5000,
        });
        setIsSubmitting(false);
        return;
      }

      // Orden guardada: navegar YA, sin esperar impresion.
      // newItems conserva el sentQty ORIGINAL para que el delta impreso
      // (quantity - sentQty) sea el correcto — en DB ya quedaron marcados.
      const newItems = itemsToPrint;
      const hasNewItems = newItems.length > 0;

      if (hasNewItems && isPrintServiceAvailable === false) {
        toast.warning({
          title: existingOrder ? 'Orden actualizada' : 'Orden creada',
          description: 'Items pendientes de imprimir (impresora desconectada)',
        });
      } else {
        toast.success({
          title: existingOrder ? 'Orden actualizada' : 'Orden creada',
          description: hasNewItems
            ? 'Enviando comanda a cocina...'
            : 'Los cambios se guardaron correctamente',
        });
      }

      // Impresion + audit en background (fire-and-forget antes del redirect
      // para que los fetches queden en vuelo y el browser los complete).
      if (hasNewItems) {
        const tableNameSnapshot = tableName;
        const waiterNameSnapshot = waiterName;
        const userIdSnapshot = session?.user.id ?? 'unknown';

        void (async () => {
          const requestAt = new Date();
          let printStatus: PrintAttemptStatus = 'exception';
          let errorMessage: string | null = null;
          let via: 'local' | 'queue' | null = null;
          let serviceResponse: Record<string, unknown> | null = null;

          let alert = false;

          // Se manda SIEMPRE (ver la otra ruta y comandaPrintOutcome).
          try {
            const result = await printComanda(
              orderForPrint as Parameters<typeof printComanda>[0],
              newItems,
              {
                tableId: orderForPrint.tableId ?? null,
                tableName: tableNameSnapshot,
                waiterName: waiterNameSnapshot,
                cajaSummary: false,
              },
            );
            via = result.via ?? null;
            serviceResponse = result as unknown as Record<string, unknown>;
            const outcome = comandaPrintOutcome(
              result,
              via === 'queue' ? await isRemotePrintServiceConnected() : null,
            );
            printStatus = outcome.status;
            errorMessage = outcome.errorMessage;
            alert = outcome.alert;
          } catch (err) {
            const classified = classifyPrintError(err);
            printStatus = classified.status;
            errorMessage = classified.message;
          }

          try {
            await recordPrintAttempt({
              order: {
                id: targetOrderId,
                tableId: orderForPrint.tableId ?? null,
                tableName: tableNameSnapshot ?? null,
                sector: orderForPrint.sector ?? null,
                waiterId: orderForPrint.waiterId ?? null,
                waiterName: waiterNameSnapshot ?? null,
              },
              type: 'comanda',
              userId: userIdSnapshot,
              items: newItems.map((i) => ({
                productId: i.productId,
                name: i.name,
                qty: printQty(
                  i.quantity - (i.sentQty ?? 0),
                  i.productId,
                  i.presentationQty,
                ),
                station:
                  (i.station as 'KITCHEN' | 'BAR' | 'PIZZA' | null) ??
                  'KITCHEN',
                notes: i.notes ?? null,
              })),
              requestPayload: { orderId: targetOrderId, items: newItems },
              requestAt,
              status: printStatus,
              errorMessage,
              via,
              serviceResponse,
              alert,
            });
          } catch {
            // audit falló silente
          }
          // Ficha con QR (ver comentario en el otro envio de comanda). Fuera
          // del try del audit: que falle el registro no debe dejar sin QR a
          // cocina, pizza y barra.
          enqueuePrintFichaSafe(targetOrderId);
        })();
      }

      // Navegacion del router, no `window.location.href`.
      // Antes era un "hard redirect garantizado" porque el soft-routing se
      // trababa: la causa real era un bucle de renders en ProductSelector,
      // arreglado en `043c571`. Recargar la app entera aca costaba volver a
      // descargar el bundle y rehidratar los 426 productos en el momento mas
      // sensible del flujo — justo cuando el mesonero va a cobrar.
      setIsSubmitting(false);
      router.push(PRIVATE_ROUTES.POS_PAYMENT(targetOrderId));
    },
    [
      isSubmitting,
      existingOrder,
      router,
      _selectedCustomer,
      session,
      toast,
      createOrder,
      updateOrder,
      updateTable,
      isPrintServiceAvailable,
      tableName,
      waiterName,
    ],
  );

  if (isLoadingOrder) {
    return (
      <Loader
        fullScreen
        text="Cargando orden existente..."
        size="lg"
        color="primary"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <OrderHeader
        isWaiter={isWaiter}
        sectorParam={sectorParam}
        tableId={tableId}
        tableName={tableName}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        waiters={waiters}
        selectedWaiterId={selectedWaiterId}
        waiterName={waiterName}
        waiterDropdownOpen={showWaiterDropdown}
        onWaiterDropdownChange={setShowWaiterDropdown}
        onSelectWaiter={setSelectedWaiterId}
        onRemoveWaiter={() => setSelectedWaiterId(null)}
        existingOrder={existingOrder}
        onMergeClick={() => setShowMerge(true)}
      />

      <form
        onSubmit={handleSubmit((data) => onSubmit(data))}
        onKeyDown={(e) => {
          // Prevenir que cualquier tecla envíe el formulario accidentalmente
          // Solo permitir el envío mediante el botón explícito
          if (e.key === 'Enter') {
            const target = e.target as HTMLElement;
            if (
              target.tagName !== 'BUTTON' ||
              target.getAttribute('type') !== 'submit'
            ) {
              e.preventDefault();
            }
          }
        }}
        className="w-full xl:h-[calc(100vh-60px)] flex flex-col"
      >
        <div className="flex-1 flex flex-col xl:flex-row gap-4 p-3 sm:p-4 xl:overflow-hidden">
          <div className="xl:flex-1 xl:min-h-0 xl:overflow-hidden">
            <ProductSelector
              products={productsData}
              onAddProductAction={handleAddProduct}
              searchTerm={searchTerm}
            />
          </div>
          <div className="w-full xl:w-[380px] flex flex-col xl:overflow-hidden">
            {/* Panel derecho unificado */}
            <div className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50 rounded-xl flex flex-col xl:overflow-hidden xl:flex-1">
              {/* Campos de identificación del cliente */}
              <ClientFields
                sectorParam={sectorParam}
                isLookingUpMember={isLookingUpMember}
                onLookupMember={handleLookupMember}
                register={register}
              />

              {/* Order Summary — aislado del padre con useWatch */}
              <div className="flex-1 overflow-auto">
                <OrderSummaryBound
                  control={control}
                  products={productsData}
                  tableId={tableId}
                  onRemoveItemAction={handleRemoveItem}
                  onQuantityChangeAction={handleQuantityChange}
                  onItemNotesChangeAction={handleItemNotesChange}
                  onDeliveryChangeAction={handleDeliveryChange}
                  onConvertToPacksAction={() =>
                    setModalDeConversionAbierto(true)
                  }
                  hayConversionesDisponibles={opcionesDeConversion.length > 0}
                />
              </div>

              {/* Items cancelados */}
              <CancelledItemsSection existingOrder={existingOrder} />

              {/* Historial de auditoría (eliminaciones, entregas, cortesías) */}
              {existingOrder && <OrderChangeLog orderId={existingOrder.id} />}

              {/* Comentario general de la orden — colapsado por defecto; si la
                  orden ya trae comentario, el resumen lo muestra como preview */}
              <details className="border-t border-line group">
                <summary className="px-3 py-2 flex items-center justify-between gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <MessageSquareText className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-[11px] font-semibold text-dim shrink-0">
                      Comentario
                    </span>
                    {existingOrder?.notes && (
                      <span className="text-[11px] text-content/80 truncate italic">
                        {existingOrder.notes}
                      </span>
                    )}
                  </span>
                  <ChevronLeft className="w-3.5 h-3.5 text-dim -rotate-90 group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <div className="px-3 pb-2">
                  <textarea
                    placeholder="Ej: Sin cubiertos, mesa cerca de la ventana..."
                    {...register('notes')}
                    rows={2}
                    className="w-full text-xs border border-line rounded-lg px-2.5 py-1.5 focus:border-accent focus:ring-1 focus:ring-accent/20 resize-none bg-accent/10 placeholder:text-dim"
                  />
                </div>
              </details>

              {/* Botones de accion (footer) — aislado con useWatch */}
              <OrderActionsFooter
                control={control}
                formErrors={formState.errors}
                formSubmitted={formState.isSubmitted}
                existingOrder={existingOrder}
                isSubmitting={isSubmitting}
                isLoadingOrder={isLoadingOrder}
                isPrintingComanda={isPrintingComanda}
                isPrintServiceAvailable={isPrintServiceAvailable === true}
                onProcessOrder={() => void handleProcessOrder()}
                onReprintComanda={() => void handleReprintComanda()}
              />
            </div>
          </div>
        </div>
      </form>

      {/* Fusionar otra orden dentro de esta (PIN de gerencia) */}
      {existingOrder?.id && (
        <MergeOrderModal
          isOpen={showMerge}
          destinoId={existingOrder.id}
          destinoEtiqueta={
            existingOrder.tableName ||
            (sectorParam ? SECTOR_LABELS[sectorParam] || sectorParam : '') ||
            'esta orden'
          }
          destinoTotal={existingOrder.total ?? 0}
          onClose={() => setShowMerge(false)}
          onMerged={() => {
            // La orden cambio del lado del servidor. En vez de recargar la app
            // entera —que tira el cache, rehidrata todo y descarta el estado de
            // la pantalla— se invalida SOLO lo que dejo de ser valido y React
            // Query lo vuelve a pedir. Mismo resultado, sin recarga.
            void queryClient.invalidateQueries({ queryKey: orderKeys.all });
            void queryClient.invalidateQueries({ queryKey: tableKeys.all });
            setShowMerge(false);
          }}
        />
      )}

      {/* Modal de autorización PIN+motivo (items ya comandados) */}
      <EditAuthModal
        isOpen={showEditAuth}
        lockedItems={editAuthLocked}
        isSubmitting={isSubmitting}
        errorMessage={editAuthError}
        onConfirmAction={(pin, reason) => {
          // Baja al momento (× / − de un item comandado): autoriza y persiste
          // sin cerrar el modal aquí — applyAuthorizedItemEdit lo cierra al
          // confirmar o lo deja abierto con el error si el PIN es inválido.
          if (pendingItemEditRef.current) {
            void applyAuthorizedItemEdit(pin, reason);
            return;
          }
          // Guardado normal que tocó items comandados (428 al enviar).
          setShowEditAuth(false);
          const pending = pendingSubmitRef.current;
          if (pending) void onSubmit(pending, { pin, reason });
        }}
        onCancelAction={() => {
          setShowEditAuth(false);
          setEditAuthLocked([]);
          setEditAuthError(null);
          pendingSubmitRef.current = null;
          pendingItemEditRef.current = null;
        }}
      />

      {/* Modal de confirmación de eliminación */}
      <Modal isOpen={showDeleteConfirm} onClose={cancelDeleteItem}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-danger/15 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content">
                Confirmar eliminación
              </h3>
              <p className="text-sm text-dim">
                Esta acción no se puede deshacer
              </p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-dim">
              ¿Estás seguro de que deseas eliminar{' '}
              <span className="font-semibold text-danger">
                {itemToDelete?.name}
              </span>{' '}
              de la orden?
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={cancelDeleteItem}
              className="px-4 py-2 border-line text-dim hover:bg-elevated"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmDeleteItem}
              className="px-4 py-2 bg-danger hover:bg-danger text-on-brand"
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      <ModalDeConversionAPack
        isOpen={modalDeConversionAbierto}
        onClose={() => setModalDeConversionAbierto(false)}
        opciones={opcionesDeConversion}
        onConfirmar={handleConvertirPack}
        guardando={convertirPack.isPending}
      />
    </div>
  );
}

// ─── Subcomponentes que aislan las subscripciones del form ───────────────
// El padre OrderPage NO llama watch() ni useWatch() a nivel de render para
// evitar re-renders del arbol completo en cada tecla. Los sub-componentes
// de abajo son los unicos que se re-renderizan cuando cambian items/totals.

type OrderSummaryBoundProps = {
  control: Control<OrderFormValues>;
  products: Product[];
  tableId: string | null;
  onRemoveItemAction: (e: React.MouseEvent, index: number) => void;
  onQuantityChangeAction: (index: number, quantity: number) => void;
  onItemNotesChangeAction: (index: number, notes: string) => void;
  onDeliveryChangeAction?: (index: number, qty: number) => void;
  onConvertToPacksAction?: () => void;
  hayConversionesDisponibles?: boolean;
};

function OrderSummaryBound({
  control,
  products,
  tableId,
  onRemoveItemAction,
  onQuantityChangeAction,
  onItemNotesChangeAction,
  onDeliveryChangeAction,
  onConvertToPacksAction,
  hayConversionesDisponibles,
}: OrderSummaryBoundProps) {
  const items = useWatch({ control, name: 'items' }) ?? [];
  const subtotal = useWatch({ control, name: 'subtotal' }) ?? 0;
  const serviceCharge = useWatch({ control, name: 'serviceCharge' }) ?? 0;
  const tax = useWatch({ control, name: 'tax' }) ?? 0;
  const total = useWatch({ control, name: 'total' }) ?? 0;
  return (
    <OrderSummary
      items={items}
      products={products}
      subtotal={subtotal}
      serviceCharge={serviceCharge}
      tax={tax}
      total={total}
      tableId={tableId}
      onRemoveItemAction={onRemoveItemAction}
      onQuantityChangeAction={onQuantityChangeAction}
      onItemNotesChangeAction={onItemNotesChangeAction}
      onDeliveryChangeAction={onDeliveryChangeAction}
      onConvertToPacksAction={onConvertToPacksAction}
      hayConversionesDisponibles={hayConversionesDisponibles}
    />
  );
}

type OrderActionsFooterProps = {
  control: Control<OrderFormValues>;
  formErrors: Record<string, { message?: string } | undefined>;
  formSubmitted: boolean;
  existingOrder: Order | null;
  isSubmitting: boolean;
  isLoadingOrder: boolean;
  isPrintingComanda: boolean;
  isPrintServiceAvailable: boolean;
  onProcessOrder: () => void;
  onReprintComanda: () => void;
};

function OrderActionsFooter({
  control,
  formErrors,
  formSubmitted,
  existingOrder,
  isSubmitting,
  isLoadingOrder,
  isPrintingComanda,
  isPrintServiceAvailable,
  onProcessOrder,
  onReprintComanda,
}: OrderActionsFooterProps) {
  const searchParams = useSearchParams();
  const sectorParam = searchParams.get('sector');
  const { data: session } = useSession();

  const isWaiter = session?.user?.role === 'waiter';
  const itemsRaw = useWatch({ control, name: 'items' });
  const total = useWatch({ control, name: 'total' }) ?? 0;
  const items = useMemo(() => itemsRaw ?? [], [itemsRaw]);
  const itemsLen = items.length;
  const newItemsCount = useMemo(
    () => items.filter((i) => i.quantity > (i.sentQty ?? 0)).length,
    [items],
  );

  return (
    <div className="border-t border-line p-3">
      <div className="text-center mb-2">
        <div className="text-xs text-dim">
          {itemsLen === 0 ? (
            'Agrega productos para continuar'
          ) : (
            <>
              {itemsLen} prod ·{' '}
              <span className="font-semibold text-content">
                ${total.toFixed(2)}
              </span>
              {existingOrder && (
                <span className="text-accent font-medium">
                  {' '}
                  · editando orden
                </span>
              )}
            </>
          )}
        </div>
        {formSubmitted && Object.keys(formErrors).length > 0 && (
          <div className="mt-1.5 p-1.5 bg-danger/10 border border-danger/20 rounded text-[11px] text-danger">
            <div className="font-semibold mb-0.5">Errores de validacion:</div>
            {Object.entries(formErrors).map(([field, error]) => (
              <div key={field} className="text-left">
                {field}: {error?.message || 'Error desconocido'}
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        disabled={itemsLen === 0 || isSubmitting || isLoadingOrder}
        onClick={onProcessOrder}
        className="w-full h-10 mb-2 bg-gradient-to-r from-ok to-ok/80 hover:from-ok/90 hover:to-ok shadow-md text-on-brand disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs font-semibold relative transition-all duration-200"
      >
        {isSubmitting ? (
          <>
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
            <span>Procesando...</span>
          </>
        ) : (
          <>
            <ChefHat className="w-3.5 h-3.5" />
            <span>Procesar Orden</span>
            {isPrintServiceAvailable && newItemsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-danger text-on-brand text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {newItemsCount}
              </span>
            )}
            {isPrintServiceAvailable && (
              <Printer className="w-3 h-3 opacity-70" />
            )}
          </>
        )}
      </Button>

      {existingOrder && isPrintServiceAvailable && (
        <Button
          type="button"
          disabled={itemsLen === 0 || isPrintingComanda}
          onClick={onReprintComanda}
          className="w-full h-9 mb-2 bg-elevated hover:bg-elevated text-dim border border-line disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs font-medium"
        >
          {isPrintingComanda ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-dim"></div>
              <span>Reimprimiendo...</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reimprimir Comanda</span>
              <Printer className="w-3 h-3 opacity-60" />
            </>
          )}
        </Button>
      )}

      <div className={`grid ${isWaiter ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
        {/* <a> nativo: garantiza navegacion incluso si el router queda trabado */}
        <a
          href={
            isWaiter
              ? sectorParam
                ? '/private/waiter/zonas'
                : '/private/waiter'
              : '/private/pos'
          }
          className="h-10 px-3 border border-line text-dim hover:bg-elevated flex items-center justify-center gap-1.5 text-xs font-medium rounded-xl no-underline"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Volver</span>
        </a>

        {/* "Ir a Pagar" solo para cajero/admin. El mesonero envia la orden
            con "Procesar Orden" y el cobro lo hace caja. */}
        {!isWaiter && (
          <Button
            type="submit"
            disabled={itemsLen === 0 || isLoadingOrder || isSubmitting}
            className="h-10 px-4 bg-gradient-to-r from-brand to-brand-light hover:from-brand-light hover:to-brand shadow-md text-on-brand disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Ir a Pagar</span>
          </Button>
        )}
      </div>
    </div>
  );
}
