// app/pos/payment/[orderId]/page.tsx
'use client';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Order } from '@/modelTypes/order';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import {
  CurrencyEnum,
  InvoiceStatusEnum,
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
  PaymentTypeEnum,
  TableStatusEnum,
} from '@/shared';
import {
  useCreateAccountsReceivable,
  useUpdateAccountsReceivable,
} from '@/hooks/useAccountsReceivable';
import { useCreateInvoice, useUpdateInvoice } from '@/hooks/useInvoices';
import { useCreatePayment } from '@/hooks/usePayments';
import { usePaymentsByOrder } from '@/hooks/usePayments';
import { useInvoiceByOrder } from '@/hooks/useInvoices';
import { useProductsByIds } from '@/hooks/useProducts';
import { useCreateTip } from '@/hooks/useTips';
import { useWaiters } from '@/hooks/useUsers';
import { useCustomer, useCustomerByMember } from '@/hooks/useCustomers';
import { useOrder, useUpdateOrder } from '@/hooks/useOrders';
import { useTable, useUpdateTable } from '@/hooks/useTables';
import {
  getPagoMovilByReference,
  isPaymentReferenceUsed,
  isReferenceAlreadyVerified,
  getCustomerReceivables,
  createPagoMovilRecord,
} from '@/hooks/usePagoMovil';
import { api } from '@/services/api/apiClient';
import { printPrecuenta } from '@/features/pos/services/thermalPrintService';
import { Payment } from '@/modelTypes/payment';
import { Customer } from '@/modelTypes/customer';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { PagoMovil } from '@/modelTypes/pagoMovil';
import { Invoice } from '@/modelTypes/invoice';
import { bsToUsd } from '@/shared/utils/currencyHelpers';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';
import { Card } from '@/components/shared/card/card';
import { Button } from '@/components/shared/button/Button';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  XCircle,
  CheckCircle,
  FileText,
  Gift,
  Beer,
} from 'lucide-react';
import { OrderItem } from '@/modelTypes/orderItem';
import Table from '@/components/shared/Table';
import CustomerSearch from '@/features/pos/CustomerSearch';
import PagoMovilQrPanel from '@/features/pos/PagoMovilQrPanel';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import ModalDeConversionAPack from '@/features/pos/ModalDeConversionAPack';
import { formatearUsd } from '@/shared/utils/dinero';
import {
  useOpcionesDeConversion,
  useConvertirPack,
  type OpcionConversion,
} from '@/hooks/usePackConversion';
import { useToast } from '@/components/hooks/useToast';
import { useUserStore } from '@/shared/store/useUserStore';
import {
  anotarConsumoDeCredito,
  buscarSocio,
} from '@/features/pos/services/sociosService';
import { generarNumeroFactura, type LineaDeOrden } from '@odin6/types';
import { useTarifas } from '@/shared/config';
import { useNominaConfig } from '@/features/payroll/hooks/useNominaConfig';
import {
  calcularTotalesOrden,
  tasasGuardadasDe,
} from '@/features/pos/services/totalesOrden';
import { useDatosDeImpresion } from '@/features/pos/hooks/useDatosDeImpresion';
import { useContextoPdf } from '@/shared/hooks/useContextoPdf';
import {
  calculateTotalPaid as calcularTotalPagado,
  calculateTotalPaidInBs as calcularTotalPagadoEnBs,
  isPaymentComplete as esCobroPagado,
  calculateSelectedReceivablesTotal as calcularTotalCuentasSeleccionadas,
  getPaymentExcess as obtenerExcesoPago,
  calculateChangeBs as calcularVueltoBs,
  hayVuelto,
  faltaPorPagarBs,
  montoRestantePorPagar,
  getTotalCardAmount as obtenerTotalTarjetas,
} from '@/features/pos/cobro';
import {
  ModalConfirmarEliminacion,
  ModalPagoMovil,
  ModalCuentasPorCobrar,
  ModalDescuento,
  ModalCortesia,
  crearColumnasDeItems,
  MetodosDePago,
  CreditoDeSocio,
  ResumenYVuelto,
  CobroDelMesonero,
  ControlDePropina,
  TarjetaDeTotales,
  type CardPaymentEntry,
  type MemberCreditInfo,
} from './components';
import { generateAttemptId } from '@/shared/utils/printAudit';
import { useCobroStore } from './hooks/useCobroStore';
import { useEdicionDeItems } from './hooks/useEdicionDeItems';
import { useTasaBcv } from './hooks/useTasaBcv';
import { debenContarsePagosPrevios } from '@/features/pos/pagosYaRegistrados';

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default function PaymentPage({ params }: PageProps) {
  const { orderId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { user } = useUserStore();
  const { data: order, refetch: refetchOrder } = useOrder(orderId);
  const { data: table } = useTable(order?.tableId || '');
  const { data: paymentsFromOrder = [] } = usePaymentsByOrder(orderId);
  const { data: facturaDeLaOrden = null } = useInvoiceByOrder(orderId);
  const updateOrder = useUpdateOrder();
  const updateTable = useUpdateTable();

  // Solo los productos de la orden, no el catálogo: aquí se usan únicamente
  // para saber qué ítems son de alcohol (el crédito de socio no los cubre).
  // Traer los ~600 pesaba 485 KB por cobro (medido en PRE, 26/09/2026).
  const orderProductIds = useMemo(
    () =>
      order?.items ? [...new Set(order.items.map((i) => i.productId))] : [],
    [order?.items],
  );
  // Sin valor por defecto a propósito: un `= []` es un array nuevo en cada
  // render y, como dependencia del efecto del crédito, lo relanzaría sin fin.
  const { data: productsData } = useProductsByIds(orderProductIds);
  const { data: usersData = [] } = useWaiters();
  const { data: customerFromId } = useCustomer(order?.customerId || '');
  const { data: customerFromMember } = useCustomerByMember(
    order?.associateNumber || '',
  );
  const createAccountsReceivable = useCreateAccountsReceivable();
  const updateAccountsReceivable = useUpdateAccountsReceivable();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const createPayment = useCreatePayment();
  const createTip = useCreateTip();
  const [loading, setLoading] = useState(true);

  // Verificar permisos de acceso - Solo ADMIN, MANAGER, CASHIER pueden procesar pagos
  useEffect(() => {
    if (user?.role === 'waiter' || user?.role === 'kitchen') {
      toast.error({
        title: 'Acceso Denegado',
        description: 'No tienes permisos para acceder a la pantalla de pagos',
      });
      router.push(PRIVATE_ROUTES.POS);
    }
  }, [user, router, toast]);

  // Sincronizar cliente cargado desde el hook (por customerId o associateNumber)
  useEffect(() => {
    if (customerFromId) {
      setSelectedCustomer(customerFromId);
    } else if (customerFromMember) {
      setSelectedCustomer(customerFromMember);
      setShowCustomerSearch(true);
    }
  }, [customerFromId, customerFromMember]);

  // Tasa BCV: carga, caché y avisos viven en useTasaBcv (mismo endpoint y misma
  // lógica que antes). bcvRate = 0 significa sin tasa (montos en Bs en 0).
  const { bcvRate, loadingRate, isUsingDefaultRate, handleRefreshBcvRate } =
    useTasaBcv({ order, toast });

  const [isProcessing, setIsProcessing] = useState(false);
  // Cortesía total (orden completa gratis con PIN admin + motivo)
  const [showCourtesyModal, setShowCourtesyModal] = useState(false);
  const [courtesyReason, setCourtesyReason] = useState('');
  const [courtesyPin, setCourtesyPin] = useState('');
  const [isApplyingCourtesy, setIsApplyingCourtesy] = useState(false);
  // De quien fue el error que motiva la cortesia. No cambia el dinero (el
  // mesonero conserva su comision); se registra para poder medir despues de
  // donde salen las cortesias.
  const [courtesyResponsible, setCourtesyResponsible] = useState<
    'COCINA' | 'BARRA' | 'MESONERO' | 'CASA'
  >('CASA');
  // Descuento por producto (PIN admin + motivo). A diferencia de la cortesia,
  // SI baja la base del servicio.
  const [discountTarget, setDiscountTarget] = useState<OrderItem | null>(null);
  const [discountType, setDiscountType] = useState<'PCT' | 'AMOUNT'>('PCT');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [discountPin, setDiscountPin] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  // Media-feature "editar tasa": el botón existe pero el valor no se lee (decisión
  // de producto). Se conserva cableado; bcvRate viene de useTasaBcv.
  const [, setIsEditingRate] = useState(false);
  const [, setTempRateValue] = useState<string>('');

  // Estados para propinas (en useCobroStore; ver nota de por qué tipAmount no
  // se deriva). Se leen/escriben con la misma semántica que useState.
  const tipAmount = useCobroStore((s) => s.tipAmount);
  const setTipAmount = useCobroStore((s) => s.setTipAmount);
  const selectedTip = useCobroStore((s) => s.selectedTip);
  const setSelectedTip = useCobroStore((s) => s.setSelectedTip);
  const customTipBs = useCobroStore((s) => s.customTipBs);
  const setCustomTipBs = useCobroStore((s) => s.setCustomTipBs);
  const showCustomTip = useCobroStore((s) => s.showCustomTip);
  const setShowCustomTip = useCobroStore((s) => s.setShowCustomTip);

  // Lo ya cobrado de esta orden. Derivado de React Query
  // (usePaymentsByOrder / useInvoiceByOrder); antes se copiaba a estado con un
  // useEffect de sincronización.
  //
  // El criterio vive en `debenContarsePagosPrevios` y está probado ahí: hasta
  // el 21/09/2026 este filtro exigía `PARTIAL`, y una orden en `CREDIT/pending`
  // con sus $73,48 ya cobrados no se podía cerrar ni mostraba lo pagado.
  const contarPagosPrevios = debenContarsePagosPrevios(order?.paymentStatus);
  const previousPayments = useMemo<Payment[]>(
    () => (contarPagosPrevios ? paymentsFromOrder : []),
    [contarPagosPrevios, paymentsFromOrder],
  );
  const previousPaymentsTotal = useMemo(
    () => previousPayments.reduce((sum, p) => sum + p.amount, 0),
    [previousPayments],
  );
  const existingInvoice = useMemo<Invoice | null>(() => {
    // Mismo criterio: la 180926-0004 YA tenía factura emitida. Con el filtro
    // viejo la pantalla no la veía y un cobro habría intentado crear una
    // segunda, contra el índice único `invoices {orderId}`.
    if (!contarPagosPrevios) return null;
    // Ya viene normalizada: `useInvoiceByOrder` filtra en el SERVIDOR por
    // orderId y devuelve una factura o null. Antes el parámetro no existía en
    // la API, llegaba el histórico completo y esto se quedaba con el primero.
    return facturaDeLaOrden;
  }, [contarPagosPrevios, facturaDeLaOrden]);
  const [showPreviousPayments, setShowPreviousPayments] = useState(false);

  // Estado para UI colapsable (Fase 4)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Estados para métodos de pago y montos (money-core, en useCobroStore).
  const selectedPaymentMethods = useCobroStore((s) => s.selectedPaymentMethods);
  const setSelectedPaymentMethods = useCobroStore(
    (s) => s.setSelectedPaymentMethods,
  );
  const paymentAmounts = useCobroStore((s) => s.paymentAmounts);
  const setPaymentAmounts = useCobroStore((s) => s.setPaymentAmounts);

  // Estado para referencias de pago (tarjeta, transferencia)
  const paymentReferences = useCobroStore((s) => s.paymentReferences);
  const setPaymentReferences = useCobroStore((s) => s.setPaymentReferences);

  // Estados para cliente y cuentas por cobrar
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [customerReceivables, setCustomerReceivables] = useState<
    AccountReceivable[]
  >([]);
  const [selectedReceivables, setSelectedReceivables] = useState<Set<string>>(
    new Set(),
  );
  const [showReceivablesDetail, setShowReceivablesDetail] = useState(false);

  // Estados para modal de Pago Móvil (money-core, en useCobroStore).
  const showPagoMovilModal = useCobroStore((s) => s.showPagoMovilModal);
  const setShowPagoMovilModal = useCobroStore((s) => s.setShowPagoMovilModal);
  const pagoMovilMode = useCobroStore((s) => s.pagoMovilMode);
  const setPagoMovilMode = useCobroStore((s) => s.setPagoMovilMode);
  const pagoMovilData = useCobroStore((s) => s.pagoMovilData);
  const setPagoMovilData = useCobroStore((s) => s.setPagoMovilData);

  // Estados para pagos móviles verificados
  const [verifiedPagoMoviles, setVerifiedPagoMoviles] = useState<PagoMovil[]>(
    [],
  );

  // Estado de crédito socio
  const [memberCredit, setMemberCredit] = useState<MemberCreditInfo | null>(
    null,
  );
  const [appliedMemberCredit, setAppliedMemberCredit] = useState(0);
  const [eligibleCreditAmount, setEligibleCreditAmount] = useState(0);
  const [isLoadingCredit, setIsLoadingCredit] = useState(false);

  const [isPrintingPrecuenta, setIsPrintingPrecuenta] = useState(false);

  // División de cuenta: estado efímero en useCobroStore (Zustand). Se ancla a la
  // orden con `ensureOrder`, que resetea todo si cambia el orderId (candado
  // anti-sangrado: el estado de una orden no viaja a la siguiente).
  const ensureOrderInStore = useCobroStore((s) => s.ensureOrder);
  useEffect(() => {
    if (order?.id) ensureOrderInStore(order.id);
  }, [order?.id, ensureOrderInStore]);

  const splitMode = useCobroStore((s) => s.splitMode);
  const splitSelection = useCobroStore((s) => s.splitSelection);
  const setSplitSelection = useCobroStore((s) => s.setSplitSelection);
  const toggleSplitMode = useCobroStore((s) => s.toggleSplitMode);
  const handleSplitToggleItem = useCobroStore((s) => s.handleSplitToggleItem);
  const handleSplitQtyChange = useCobroStore((s) => s.handleSplitQtyChange);

  // Tarifas y nómina de la configuración: las órdenes guardadas se calculan con sus propias tasas.
  const tarifas = useTarifas();
  const nomina = useNominaConfig();
  const datos = useDatosDeImpresion();
  const contextoPdf = useContextoPdf();

  // splitTotals es DERIVADO (no vive en el store): totales de la selección parcial
  // calculados con la misma función que la API para respetar cortesías y descuentos proporcionales.
  const splitTotals = useMemo(() => {
    if (!splitMode || !order) return null;
    const splitItems: LineaDeOrden[] = [];
    splitSelection.forEach((qty, index) => {
      const item = order.items[index];
      if (!item || qty <= 0 || item.cancelledAt) return;
      const ratio = item.quantity > 0 ? qty / item.quantity : 1;
      const itemTotal =
        (item.total || item.unitPrice * item.quantity || 0) * ratio;
      const itemDiscount = (item.discountAmount || 0) * ratio;
      splitItems.push({
        total: itemTotal,
        noCharge: item.noCharge,
        discountAmount: itemDiscount,
      });
    });
    return calcularTotalesOrden({
      items: splitItems,
      tieneMesonero: !!order.waiterId,
      tarifas,
      nomina,
      guardadas: tasasGuardadasDe(order),
    });
  }, [splitMode, order, splitSelection, tarifas, nomina]);

  const splitSubtotal = splitTotals?.subtotal ?? null;

  // Tarjetas: estado efímero en useCobroStore. El total es DERIVADO (useMemo).
  const cardPayments = useCobroStore((s) => s.cardPayments);
  const setCardPayments = useCobroStore((s) => s.setCardPayments);
  const addCardPayment = useCobroStore((s) => s.addCardPayment);
  const removeCardPayment = useCobroStore((s) => s.removeCardPayment);
  const updateCardPayment = useCobroStore((s) => s.updateCardPayment);
  const totalCardAmount = useMemo(
    () => obtenerTotalTarjetas(cardPayments),
    [cardPayments],
  );

  const {
    showDeleteConfirm,
    itemToDelete,
    handleUpdateQuantity,
    handleRemoveItem,
    confirmDeleteItem,
    cancelDeleteItem,
  } = useEdicionDeItems({ order, updateOrder, toast });

  // ── Conversion a pack: la calcula y la aplica el SERVIDOR ──
  //
  // Antes esta pantalla convertia sola, con `convertOrderItemsToPacks` de
  // `@odin6/types`: tomaba TODAS las lineas elegibles y las convertia de un
  // toque, con los precios cableados en esa tabla. Dos problemas de dinero:
  // el tobo de lata figuraba en $11 cuando la ficha del producto dice $14 (y
  // el servidor cobra el del catalogo), y convertia por cantidad PEDIDA, no
  // por entregada.
  //
  // Ahora: el servidor ofrece sobre lo entregado, y la persona elige.
  const { data: opcionesDeConversion = [] } = useOpcionesDeConversion(
    order?.id,
  );
  const convertirPack = useConvertirPack();
  const [modalDeConversionAbierto, setModalDeConversionAbierto] =
    useState(false);

  const hasEligiblePacks = opcionesDeConversion.length > 0;

  const handleConvertToPacks = useCallback(
    async (opcion: OpcionConversion, packsToConvert: number) => {
      if (!order) return;
      try {
        await convertirPack.mutateAsync({
          orderId: order.id,
          sourceProductId: opcion.sourceProductId,
          targetPackId: opcion.targetPackId,
          packsToConvert,
        });
        setModalDeConversionAbierto(false);
        toast.success({
          title: 'Conversión aplicada',
          description:
            packsToConvert === 1
              ? `1 ${opcion.packName}. Ahorro para el cliente: ${formatearUsd(opcion.savingsUsd)}`
              : `${packsToConvert} × ${opcion.packName}. Ahorro para el cliente: ${formatearUsd(opcion.savingsUsd * packsToConvert)}`,
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
    [order, convertirPack, toast],
  );

  // Definir columnas para la tabla de items
  const columns = crearColumnasDeItems({
    splitMode,
    previousPaymentsTotal,
    order,
    splitSelection,
    setSplitSelection,
    onSplitToggle: handleSplitToggleItem,
    onSplitQtyChange: handleSplitQtyChange,
    onUpdateQuantity: handleUpdateQuantity,
    onDiscountClick: (item) => {
      setDiscountTarget(item);
      setDiscountReason('');
      setDiscountPin('');
      setDiscountValue('');
    },
    onRemoveItem: handleRemoveItem,
  });

  // Guardamos la firma del prefill aplicado, no solo un boolean. Si el ref
  // fuera boolean y el primer render de React Query devolviera un snapshot
  // cacheado sin `pendingPayments`, el flag quedaria en true y el refetch
  // posterior con los datos reales nunca pre-llenaria el form.
  const prefilledSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const loadOrder = async () => {
      try {
        if (!order) {
          setLoading(true);
          return;
        }

        // Proteccion: no permitir editar ordenes ya pagadas
        if (order.paymentStatus === PaymentStatusEnum.PAID) {
          router.push(`/private/pos/receipt/${orderId}`);
          return;
        }

        // Pre-llenar datos del mesonero si la orden viene con PENDING_VERIFICATION.
        // La firma incluye los datos de pago para que si el server manda una
        // version sin pendingPayments y luego una con, el prefill se reintente.
        const prefillSignature = `${order.id}|${order.paymentStatus}|${order.pendingPayments?.length ?? 0}|${order.paymentMethod ?? ''}`;
        if (
          prefilledSignatureRef.current !== prefillSignature &&
          order.paymentStatus === PaymentStatusEnum.PENDING_VERIFICATION
        ) {
          prefilledSignatureRef.current = prefillSignature;
          // Caso 1: La orden tiene pendingPayments (array de pagos del mesonero)
          if (order.pendingPayments && order.pendingPayments.length > 0) {
            const methods = order.pendingPayments.map((pp) => pp.method);
            const uniqueMethods = [...new Set(methods)];
            setSelectedPaymentMethods(uniqueMethods);

            const newAmounts: Record<PaymentMethodEnum, string> = {
              ...paymentAmounts,
            };
            const newRefs: Record<PaymentMethodEnum, string> = {
              ...paymentReferences,
            };
            const orderBcvRate = order.bcvRate || 1;

            // Metodos donde paymentAmounts espera Bs
            const bsMethods = new Set([
              PaymentMethodEnum.CASH_BS,
              PaymentMethodEnum.CARD,
            ]);

            // Pre-llenar cardPayments para tarjetas
            const pendingCardPayments: CardPaymentEntry[] = [];

            for (const pp of order.pendingPayments) {
              // Determinar el valor correcto segun lo que espera el campo
              const valueForField = bsMethods.has(pp.method)
                ? pp.amountBs // CASH_BS y CARD: valor en Bs
                : bsToUsd(pp.amountBs, orderBcvRate); // CASH_USD, TRANSFER, PAGO_MOVIL: valor en USD

              const existing = parseFloat(newAmounts[pp.method] || '0');
              newAmounts[pp.method] = (existing + valueForField).toFixed(2);

              if (pp.reference) {
                newRefs[pp.method] = pp.reference;
              }

              // Pre-llenar cardPayments (la UI de tarjeta usa este state, no paymentAmounts)
              if (pp.method === PaymentMethodEnum.CARD) {
                pendingCardPayments.push({
                  amount: pp.amountBs.toFixed(2),
                  reference: pp.reference ?? '',
                });
              }

              // Pre-llenar datos de pago movil del primer entry que sea PAGO_MOVIL
              if (
                pp.method === PaymentMethodEnum.PAGO_MOVIL &&
                pp.pagoMovilPhone
              ) {
                setPagoMovilData((prev) => ({
                  ...prev,
                  amount: pp.amountBs.toFixed(2),
                  reference: pp.reference ?? prev.reference,
                  phone: pp.pagoMovilPhone ?? prev.phone,
                  cedula: pp.pagoMovilCedula ?? prev.cedula,
                  banco: pp.pagoMovilBanco ?? prev.banco,
                }));
              }
            }

            if (pendingCardPayments.length > 0) {
              setCardPayments(pendingCardPayments);
            }

            setPaymentAmounts(newAmounts);
            setPaymentReferences(newRefs);
          }
          // Caso 2: Pago simple con paymentMethod directo (legacy / pago unico)
          else if (order.paymentMethod) {
            setSelectedPaymentMethods([order.paymentMethod]);
            if (order.paymentReference) {
              setPaymentReferences((prev) => ({
                ...prev,
                [order.paymentMethod!]: order.paymentReference!,
              }));
            }
            if (order.paymentAmountBs) {
              setPaymentAmounts((prev) => ({
                ...prev,
                [order.paymentMethod!]: order.paymentAmountBs!.toFixed(2),
              }));
              // Pre-llenar cardPayments para tarjeta legacy
              if (order.paymentMethod === PaymentMethodEnum.CARD) {
                setCardPayments([
                  {
                    amount: order.paymentAmountBs!.toFixed(2),
                    reference: order.paymentReference ?? '',
                  },
                ]);
              }
            }
            if (order.paymentMethod === PaymentMethodEnum.PAGO_MOVIL) {
              setPagoMovilData((prev) => ({
                ...prev,
                amount: order.paymentAmountBs?.toFixed(2) ?? prev.amount,
                reference: order.paymentReference ?? prev.reference,
                phone: order.pagoMovilPhone ?? prev.phone,
                cedula: order.pagoMovilCedula ?? prev.cedula,
                banco: order.pagoMovilBanco ?? prev.banco,
              }));
            }
          }

          // Pre-llenar propina si la orden ya tiene una (viene del mobile o de
          // un envio previo). El mobile la guarda en USD (order.tipAmount).
          // Como en mobile se ingresa en Bs, mostramos el equivalente en Bs en
          // el input custom para que el cajero lo vea como lo escribio el
          // mesonero, en vez de un preset USD que no coincida.
          const orderRate = order.bcvRate || 1;
          if ((order.tipAmount ?? 0) > 0) {
            const tipUsd = order.tipAmount ?? 0;
            const presetMatch = [1, 2, 3, 5].find(
              (p) => Math.abs(p - tipUsd) < 0.005,
            );
            if (presetMatch !== undefined) {
              setSelectedTip(presetMatch);
              setTipAmount(presetMatch);
              setCustomTipBs('');
              setShowCustomTip(false);
            } else {
              const tipBs =
                orderRate > 0 ? +(tipUsd * orderRate).toFixed(2) : 0;
              setCustomTipBs(tipBs > 0 ? tipBs.toFixed(2) : '');
              setSelectedTip(null);
              setShowCustomTip(true);
              setTipAmount(tipUsd);
            }
          }
        }
      } catch {
        // console.error('Error loading order:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderId,
    order?.id,
    order?.paymentStatus,
    order?.pendingPayments?.length,
    order?.paymentMethod,
    router,
  ]);

  // Pre-llenar la propina cuando la orden ya tiene tipAmount, sin importar el
  // paymentStatus. El pre-fill general (linea ~717) solo corre si la orden esta
  // en PENDING_VERIFICATION; si la orden quedo PARTIAL despues de un cobro
  // incompleto, el cajero no veia la propina al volver a abrir el formulario.
  // Usamos un ref para que solo se ejecute una vez por orden y no sobreescriba
  // si el cajero ya editó el campo manualmente.
  const tipPrefilledForOrderRef = useRef<string | null>(null);
  useEffect(() => {
    if (!order) return;
    const tipUsd = order.tipAmount ?? 0;
    if (tipUsd <= 0) return;
    if (tipPrefilledForOrderRef.current === order.id) return;
    if (tipAmount > 0) return; // ya cargado por el flujo principal o por el cajero
    tipPrefilledForOrderRef.current = order.id;
    const orderRate = order.bcvRate || 1;
    const presetMatch = [1, 2, 3, 5].find((p) => Math.abs(p - tipUsd) < 0.005);
    if (presetMatch !== undefined) {
      setSelectedTip(presetMatch);
      setTipAmount(presetMatch);
      setCustomTipBs('');
      setShowCustomTip(false);
    } else {
      const tipBs = orderRate > 0 ? +(tipUsd * orderRate).toFixed(2) : 0;
      setCustomTipBs(tipBs > 0 ? tipBs.toFixed(2) : '');
      setSelectedTip(null);
      setShowCustomTip(true);
      setTipAmount(tipUsd);
    }
  }, [order, tipAmount]);

  // Cargar info de crédito socio cuando la orden tiene associateNumber
  useEffect(() => {
    if (!order?.associateNumber) return;
    // Sin los productos no se sabe qué es alcohol: se esperaba y se calculaba
    // el elegible con la lista vacía, contando el alcohol como fiable.
    if (!productsData) return;
    const associateNumber: string = order.associateNumber;

    const loadMemberCredit = async () => {
      setIsLoadingCredit(true);
      try {
        const socio = await buscarSocio(associateNumber);
        if (!socio) return;

        const {
          creditLimit,
          creditUsed,
          creditAvailable,
          creditMonthsPaid,
          nombre,
        } = socio;
        if (creditLimit === 0) return; // Sin crédito asignado

        setMemberCredit({
          associateNumber,
          nombre,
          creditLimit,
          creditUsed,
          creditAvailable,
          creditMonthsPaid,
        });

        // Monto elegible = todos los ítems de la orden. PENDIENTE: la exclusión de
        // alcohol de la versión original dependía de IDs de categoría escritos a mano; el
        // modelo aún no tiene una marca de categoría/producto para eso.
        const eligible = order.items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0,
        );

        setEligibleCreditAmount(Math.min(eligible, creditAvailable));
      } catch (err) {
        console.warn('[memberCredit] Error cargando crédito:', err);
      } finally {
        setIsLoadingCredit(false);
      }
    };

    void loadMemberCredit();
  }, [order?.associateNumber, order?.items, productsData]);

  const handleEditRateStart = () => {
    setTempRateValue(bcvRate.toString());
    setIsEditingRate(true);
  };

  // Cargar tasa BCV y pagos móviles verificados al montar el componente
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (mounted) {
        await loadVerifiedPagoMoviles();
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  // Cargar pagos móviles verificados para esta orden
  const loadVerifiedPagoMoviles = async () => {
    try {
      const orderPagoMoviles = await api.get<PagoMovil[]>('/api/pago-movil', {
        orderId,
        status: 'verified',
      });
      setVerifiedPagoMoviles(orderPagoMoviles);

      // Si hay pagos móviles verificados, actualizar el monto total
      if (orderPagoMoviles.length > 0) {
        const totalPagoMovil = orderPagoMoviles.reduce(
          (sum, pm) => sum + pm.expectedAmount,
          0,
        );
        setPaymentAmounts((prev) => ({
          ...prev,
          [PaymentMethodEnum.PAGO_MOVIL]: totalPagoMovil.toString(),
        }));
        setSelectedPaymentMethods((prev) => {
          if (!prev.includes(PaymentMethodEnum.PAGO_MOVIL)) {
            return [...prev, PaymentMethodEnum.PAGO_MOVIL];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error loading verified pago moviles:', error);
    }
  };

  // Cargar cuentas por cobrar cuando se selecciona un cliente
  useEffect(() => {
    const loadCustomerReceivables = async () => {
      if (!selectedCustomer?.id) {
        setCustomerReceivables([]);
        return;
      }

      try {
        const receivables = await getCustomerReceivables(selectedCustomer.id);
        setCustomerReceivables(receivables);
      } catch {
        setCustomerReceivables([]);
      }
    };

    loadCustomerReceivables();
  }, [selectedCustomer]);

  // Funciones helper para manejar cuentas por cobrar
  const toggleReceivableSelection = (receivableId: string) => {
    setSelectedReceivables((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(receivableId)) {
        newSet.delete(receivableId);
      } else {
        newSet.add(receivableId);
      }
      return newSet;
    });
  };

  const calculateSelectedReceivablesTotal = (): number => {
    return calcularTotalCuentasSeleccionadas(
      selectedReceivables,
      customerReceivables,
    );
  };

  // Calcular el total en bolívares
  // Si estamos dividiendo cuenta Y NO hay pagos previos, usar el subtotal parcial
  // Si hay pagos previos, el split solo es visual — el restante siempre es total - pagado
  const effectiveTotal = (() => {
    if (
      splitMode &&
      splitTotals !== null &&
      order &&
      previousPaymentsTotal === 0
    ) {
      return splitTotals.total;
    }
    return order ? order.total : 0;
  })();

  const totalOrderAndTip = effectiveTotal + tipAmount;
  const selectedReceivablesTotal = calculateSelectedReceivablesTotal();
  const totalWithTip = totalOrderAndTip + selectedReceivablesTotal;
  const remainingToPay = Math.max(
    0,
    totalWithTip - previousPaymentsTotal - appliedMemberCredit,
  );
  const remainingInBs = remainingToPay * bcvRate;

  // Función helper para crear factura automáticamente
  // Retorna la factura creada (con id) o null si falla
  const createInvoiceForOrder = async (
    order: Order,
    paymentStatus: PaymentStatusEnum,
  ): Promise<Invoice | null> => {
    try {
      // Determinar el tipo de pago principal
      let paymentType: PaymentTypeEnum = PaymentTypeEnum.CASH;
      if (selectedPaymentMethods.includes(PaymentMethodEnum.CARD)) {
        paymentType = PaymentTypeEnum.CARD;
      } else if (selectedPaymentMethods.includes(PaymentMethodEnum.TRANSFER)) {
        paymentType = PaymentTypeEnum.TRANSFER;
      } else if (
        selectedPaymentMethods.includes(PaymentMethodEnum.PAGO_MOVIL)
      ) {
        paymentType = PaymentTypeEnum.PAYMOBIL;
      }

      // Determinar el estado de la factura
      let invoiceStatus: InvoiceStatusEnum;
      let paidAt: Date | undefined;
      switch (paymentStatus) {
        case PaymentStatusEnum.PAID:
          invoiceStatus = InvoiceStatusEnum.PAID;
          paidAt = new Date();
          break;
        case PaymentStatusEnum.PARTIAL:
          invoiceStatus = InvoiceStatusEnum.PARTIALLY_PAID;
          break;
        case PaymentStatusEnum.PENDING:
          invoiceStatus = InvoiceStatusEnum.PENDING;
          break;
        default:
          invoiceStatus = InvoiceStatusEnum.PENDING;
      }

      // Generar número de factura único
      const invoiceNumber = generarNumeroFactura(order.id, Date.now());

      // Calcular totales
      const subtotal = order.subtotal || 0;
      const serviceChargeAmount = order.serviceCharge || 0;
      const tax = order.tax || 0;
      const total = totalWithTip;

      // Crear items de la factura basados en los items de la orden
      const invoiceItems =
        order.items?.map((item) => ({
          productId: item.productId,
          name: item.name,
          description: item.notes || item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          notes: item.notes || undefined,
        })) || [];

      // Datos del cobro original (mesonero via APK) — se persisten en la factura
      // para tener trazabilidad del Pago Movil/comprobante/referencia.
      const pagoMovilPending = order.pendingPayments?.find(
        (pp) => pp.method === PaymentMethodEnum.PAGO_MOVIL,
      );
      const allProofUrls = [
        ...(order.paymentProofUrls ?? []),
        ...(order.pendingPayments?.flatMap((pp) => pp.proofUrls ?? []) ?? []),
      ].filter(Boolean);

      const invoiceData: Omit<Invoice, 'id'> = {
        invoiceNumber,
        orderId: order.id,
        customerId: selectedCustomer?.id || order.customerId || '',
        customerName:
          selectedCustomer?.name ||
          order.customerName ||
          'Cliente no especificado',
        customerRif: selectedCustomer?.rif || undefined,
        subtotal,
        serviceCharge: serviceChargeAmount,
        tax,
        total,
        tip: tipAmount > 0 ? tipAmount : undefined,
        totalAmount: totalWithTip, // Campo legacy, mantener por compatibilidad

        // Configuración
        paymentType,
        currency: CurrencyEnum.USD,
        status: invoiceStatus,

        // Fechas
        createdAt: new Date(),
        updatedAt: new Date(),
        dueDate:
          paymentStatus === PaymentStatusEnum.PENDING
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días para pagos pendientes
            : undefined,
        paidAt,

        // Información adicional
        notes:
          [
            tipAmount > 0 ? `Propina: $${tipAmount.toFixed(2)}` : null,
            appliedMemberCredit > 0
              ? `Crédito socio #${memberCredit?.associateNumber ?? ''}: -$${appliedMemberCredit.toFixed(2)}`
              : null,
          ]
            .filter(Boolean)
            .join(' | ') || undefined,
        items: invoiceItems,

        // Datos de cobro preservados
        ...(order.paymentReference && {
          paymentReference: order.paymentReference,
        }),
        ...(order.bcvRate && { bcvRate: order.bcvRate }),
        ...(order.paymentAmountBs && {
          paymentAmountBs: order.paymentAmountBs,
        }),
        ...(allProofUrls.length > 0 && { paymentProofUrls: allProofUrls }),
        ...((order.pagoMovilPhone || pagoMovilPending?.pagoMovilPhone) && {
          pagoMovilPhone:
            order.pagoMovilPhone ??
            pagoMovilPending?.pagoMovilPhone ??
            undefined,
        }),
        ...((order.pagoMovilCedula || pagoMovilPending?.pagoMovilCedula) && {
          pagoMovilCedula:
            order.pagoMovilCedula ??
            pagoMovilPending?.pagoMovilCedula ??
            undefined,
        }),
        ...((order.pagoMovilBanco || pagoMovilPending?.pagoMovilBanco) && {
          pagoMovilBanco:
            order.pagoMovilBanco ??
            pagoMovilPending?.pagoMovilBanco ??
            undefined,
        }),
      };

      const created = await createInvoice.mutateAsync(invoiceData);
      return created as Invoice;
    } catch (error) {
      // No lanzamos el error para no interrumpir el flujo de pago
      console.error('[createInvoiceForOrder] Error al crear factura:', error);
      return null;
    }
  };

  // Envia la factura/precuenta por WhatsApp al cliente si tiene telefono valido.
  // No bloquea el flujo si falla — solo muestra toast de aviso.
  const notifyCustomerWhatsApp = async (
    invoice: Invoice | null,
  ): Promise<void> => {
    if (!invoice) return;
    if (!selectedCustomer?.phone) return; // Sin telefono, skip silencioso
    try {
      const { sendInvoiceWhatsApp } = await import(
        '@/services/whatsapp/sendInvoiceWhatsApp'
      );
      const result = await sendInvoiceWhatsApp(
        invoice,
        selectedCustomer,
        contextoPdf,
      );
      if (result.success) {
        toast.success({
          title: 'WhatsApp enviado',
          description: `Factura enviada a ${selectedCustomer.name}`,
        });
      } else {
        console.warn('[WhatsApp] No se pudo enviar:', result.error);
      }
    } catch (err) {
      console.error('[WhatsApp] Error inesperado:', err);
    }
  };

  // Calcular el total pagado en USD equivalente
  // Usa aritmética en Bs para evitar errores de punto flotante al dividir
  const calculateTotalPaid = (): number => {
    return calcularTotalPagado(paymentAmounts, bcvRate, totalCardAmount);
  };

  // Calcula el total pagado en Bs directamente (sin convertir a USD)
  // Evita la pérdida de precisión al dividir Bs / tasa BCV
  const calculateTotalPaidInBs = (): number => {
    return calcularTotalPagadoEnBs(paymentAmounts, bcvRate, totalCardAmount);
  };

  // Verifica si el pago cubre el total restante (descontando pagos previos),
  // comparando en Bs para evitar el error de redondeo al convertir Bs→USD→Bs
  const isPaymentComplete = (): boolean => {
    return esCobroPagado(
      paymentAmounts,
      bcvRate,
      remainingToPay,
      totalCardAmount,
    );
  };

  // Manejar selección de métodos de pago
  const handlePaymentMethodToggle = (method: PaymentMethodEnum) => {
    setSelectedPaymentMethods((prev) => {
      if (prev.includes(method)) {
        // Remover método y limpiar su monto y referencia
        setPaymentAmounts((prevAmounts) => ({
          ...prevAmounts,
          [method]: '',
        }));
        setPaymentReferences((prevRefs) => ({
          ...prevRefs,
          [method]: '',
        }));
        // Resetear tarjetas si se deselecciona CARD
        if (method === PaymentMethodEnum.CARD) {
          setCardPayments([{ amount: '', reference: '' }]);
        }
        return prev.filter((m) => m !== method);
      } else {
        // Agregar método
        if (
          method === PaymentMethodEnum.PAGO_MOVIL ||
          method === PaymentMethodEnum.PAGO_MOVIL_MANUAL
        ) {
          // Monto restante en Bs, base `remainingToPay` (resta pagos previos y
          // crédito de socio). Antes usaba `totalWithTip` y autocompletaba de más.
          const remainingBsRaw = montoRestantePorPagar({
            remainingToPay,
            totalSesionUsd: calculateTotalPaid(),
            totalSesionBs: calculateTotalPaidInBs(),
            bcvRate,
            enBolivares: true,
          });
          const remainingBS =
            remainingBsRaw > 2 ? remainingBsRaw.toFixed(2) : '0.00';

          // Establecer monto por defecto en bolívares
          setPagoMovilData((prev) => ({
            ...prev,
            amount: remainingBS,
          }));

          // Pre-seleccionar el modo segun el metodo
          setPagoMovilMode(
            method === PaymentMethodEnum.PAGO_MOVIL_MANUAL ? 'manual' : 'auto',
          );
          setShowPagoMovilModal(true);
          // No agregamos al state aun; se agregara cuando el modal confirme
          return prev;
        }

        // Pre-llenar monto por defecto con lo que falta por pagar
        // CASH_BS, CARD: Bs — CASH_USD, TRANSFER: USD
        const bsMethods: PaymentMethodEnum[] = [
          PaymentMethodEnum.CASH_BS,
          PaymentMethodEnum.CARD,
        ];
        const isBsMethod = bsMethods.includes(method);
        // Base `remainingToPay` (resta pagos previos y crédito de socio), no
        // `totalWithTip`: si no, con pagos previos autocompletaba de más.
        const remainingBsRaw = montoRestantePorPagar({
          remainingToPay,
          totalSesionUsd: calculateTotalPaid(),
          totalSesionBs: calculateTotalPaidInBs(),
          bcvRate,
          enBolivares: true,
        });
        const remainingUsdRaw = montoRestantePorPagar({
          remainingToPay,
          totalSesionUsd: calculateTotalPaid(),
          totalSesionBs: calculateTotalPaidInBs(),
          bcvRate,
          enBolivares: false,
        });
        const defaultAmount = isBsMethod
          ? remainingBsRaw > 0.01
            ? remainingBsRaw.toFixed(2)
            : ''
          : remainingUsdRaw > 0.01
            ? remainingUsdRaw.toFixed(2)
            : '';

        if (method === PaymentMethodEnum.CARD) {
          // CARD usa cardPayments (multiples tarjetas posibles)
          setCardPayments([{ amount: defaultAmount, reference: '' }]);
        } else if (defaultAmount) {
          setPaymentAmounts((prevAmounts) => ({
            ...prevAmounts,
            [method]: defaultAmount,
          }));
        }

        return [...prev, method];
      }
    });
  };

  // Manejar cambio de monto para un método específico
  const handleAmountChange = (method: PaymentMethodEnum, value: string) => {
    setPaymentAmounts((prev) => ({
      ...prev,
      [method]: value,
    }));
  };

  // Manejar modal de Pago Móvil con verificación asíncrona
  const handlePagoMovilSubmit = async () => {
    const { amount, reference, phone, cedula, banco, fechaPago } =
      pagoMovilData;

    // Validaciones
    if (!amount || parseFloat(amount) <= 0) {
      toast.error({
        title: 'Error de validación',
        description: 'Debe ingresar un monto válido',
      });
      return;
    }
    if (!reference || reference.trim().length === 0) {
      toast.error({
        title: 'Error de validación',
        description: 'Debe ingresar la referencia del pago',
      });
      return;
    }
    if (!phone || phone.length < 10) {
      toast.error({
        title: 'Error de validación',
        description: 'Debe ingresar un número de teléfono válido',
      });
      return;
    }
    if (!cedula || cedula.trim().length < 4) {
      toast.error({
        title: 'Error de validación',
        description: 'Debe ingresar la cédula del pagador (ej: V12345678)',
      });
      return;
    }
    if (!banco) {
      toast.error({
        title: 'Error de validación',
        description: 'Debe seleccionar el banco origen',
      });
      return;
    }
    if (!fechaPago || !/^\d{4}-\d{2}-\d{2}$/.test(fechaPago)) {
      toast.error({
        title: 'Error de validación',
        description: 'Debe ingresar la fecha del pago',
      });
      return;
    }

    if (!order) return;

    const amountBS = parseFloat(amount).toFixed(2);
    const amountInUSD =
      bcvRate > 0 ? bsToUsd(parseFloat(amountBS), bcvRate).toFixed(2) : '0';

    toast.info({
      title: '🔄 Procesando solicitud',
      description: `Iniciando verificación de Ref: ${reference}`,
      duration: 15000,
    });

    try {
      // Verificar duplicados (CRÍTICO para evitar pérdidas en caja)
      const { isVerified, existingPayment } =
        await isReferenceAlreadyVerified(reference);

      if (isVerified && existingPayment) {
        toast.error({
          title: '🚫 Referencia Ya Verificada',
          description: `La referencia ${reference} ya fue verificada el ${new Date(existingPayment.verificationDate!).toLocaleDateString('es-VE')} por Bs.${existingPayment.expectedAmountBS?.toFixed(2) || 'N/A'}. No se puede usar nuevamente.`,
          duration: 10000,
        });
        toast.warning({
          title: '📋 Detalles del Pago Existente',
          description: `Orden: ${existingPayment.orderId.slice(-8)} | Tel: ${existingPayment.phoneNumber} | USD: $${existingPayment.expectedAmountUSD?.toFixed(2)}`,
          duration: 8000,
        });
        return;
      }

      // Cross-check con coleccion payments (cubre pagos manuales y de tarjeta con misma ref)
      const crossConflict = await isPaymentReferenceUsed(reference, order.id);
      if (crossConflict) {
        toast.error({
          title: '🚫 Referencia Duplicada',
          description: `La referencia ${reference} ya fue usada en otro pago (orden ${crossConflict.orderId?.slice(-8) || 'N/A'}, $${crossConflict.amount.toFixed(2)}).`,
          duration: 10000,
        });
        return;
      }

      const existingAnyStatus = await getPagoMovilByReference(reference);
      if (existingAnyStatus && existingAnyStatus.status === 'pending') {
        toast.warning({
          title: 'Verificación en Proceso',
          description:
            'Esta referencia ya está siendo verificada. Por favor espere...',
          duration: 6000,
        });
        return;
      }

      // Cerrar modal y limpiar estado
      setShowPagoMovilModal(false);
      setPagoMovilData({
        amount: '',
        reference: '',
        phone: '',
        cedula: '',
        banco: '',
        fechaPago: new Date().toISOString().split('T')[0],
      });

      // Verificar en segundo plano
      verifyPagoMovilInBackground(
        amountInUSD,
        reference,
        phone,
        amountBS,
        cedula,
        banco,
        fechaPago,
      );
    } catch (err) {
      console.error(
        '[PAY] handleVerifyPagoMovil failed for ref',
        reference,
        err,
      );
      toast.error({
        title: 'Error al verificar',
        description: `No se pudo iniciar la verificación. ${err instanceof Error ? err.message : 'Intente nuevamente.'}`,
        duration: 5000,
      });
    }
  };

  // Función para verificar Pago Móvil en segundo plano via API BDV
  const verifyPagoMovilInBackground = async (
    amountUSD: string,
    reference: string,
    phone: string,
    amountBS: string,
    cedula: string,
    banco: string,
    fechaPago: string,
  ) => {
    try {
      toast.info({
        title: '🌐 Consultando API BDV',
        description: `Verificando pago Ref: ${reference} con Banco de Venezuela...`,
        duration: 8000,
      });

      let verificationResult;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const verificationResponse = await fetch('/api/verify-pago-movil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cedulaPagador: cedula.trim().toUpperCase(),
            telefonoPagador: phone,
            referencia: reference,
            fechaPago: fechaPago,
            importe: amountBS,
            bancoOrigen: banco,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        verificationResult = await verificationResponse.json();
      } catch (error) {
        verificationResult = {
          success: false,
          found: false,
          amountMatches: false,
          errorMessage:
            error instanceof Error ? error.message : 'Error de conexión',
        };

        if (error instanceof Error && error.name === 'AbortError') {
          toast.warning({
            title: '⏰ Tiempo de espera agotado',
            description:
              'La API BDV tardó más de 30s. El registro se guardó para revisión manual.',
            duration: 8000,
          });
        } else {
          toast.warning({
            title: '🔧 Error de conectividad',
            description:
              'No se pudo conectar a la API BDV. Se guardará para verificación manual.',
            duration: 8000,
          });
        }
      }

      toast.info({
        title: '💾 Guardando resultado',
        description: 'Registrando la verificación en el sistema...',
        duration: 2000,
      });

      if (!order) {
        toast.error({
          title: 'Error',
          description: 'No se encontró la orden.',
        });
        return;
      }

      // Crear registro de PagoMovil con ambos montos
      const pagoMovilData: Omit<PagoMovil, 'id'> = {
        orderId: order.id,
        referenceNumber: reference,
        cedulaPagador: cedula.trim().toUpperCase(),
        bancoOrigen: banco,
        fechaPago,
        expectedAmount: parseFloat(amountUSD), // Legacy field en USD
        expectedAmountBS: parseFloat(amountBS), // Monto en Bolívares
        expectedAmountUSD: parseFloat(amountUSD), // Monto en USD
        actualAmount: verificationResult.actualAmount
          ? parseFloat(verificationResult.actualAmount)
          : undefined,
        actualAmountUSD:
          verificationResult.actualAmount && bcvRate > 0
            ? bsToUsd(parseFloat(verificationResult.actualAmount), bcvRate)
            : undefined,
        phoneNumber: phone,
        status:
          verificationResult.success &&
          verificationResult.found &&
          verificationResult.amountMatches
            ? 'verified'
            : verificationResult.found && !verificationResult.amountMatches
              ? 'amount_mismatch'
              : verificationResult.found
                ? 'not_found'
                : 'error',
        verificationDate: new Date(),
        errorMessage: verificationResult.errorMessage,
        bcvRate: bcvRate, // Guardar la tasa BCV del momento
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await createPagoMovilRecord(pagoMovilData);

      if (
        verificationResult.success &&
        verificationResult.found &&
        verificationResult.amountMatches
      ) {
        // Verificación exitosa - agregar al listado y actualizar el total
        const createdPagoMovil = {
          ...pagoMovilData,
          id: Date.now().toString(),
        } as PagoMovil;
        setVerifiedPagoMoviles((prev) => [...prev, createdPagoMovil]);

        // Actualizar el monto total de pagos móviles en USD
        const currentTotal = parseFloat(
          paymentAmounts[PaymentMethodEnum.PAGO_MOVIL] || '0',
        );
        const newTotal = currentTotal + parseFloat(amountUSD);

        setPaymentAmounts((prev) => ({
          ...prev,
          [PaymentMethodEnum.PAGO_MOVIL]: newTotal.toString(),
        }));

        setSelectedPaymentMethods((prev) => {
          if (!prev.includes(PaymentMethodEnum.PAGO_MOVIL)) {
            return [...prev, PaymentMethodEnum.PAGO_MOVIL];
          }
          return prev;
        });

        setShowPagoMovilModal(false);
        setPagoMovilData({
          amount: '',
          reference: '',
          phone: '',
          cedula: '',
          banco: '',
          fechaPago: new Date().toISOString().split('T')[0],
        });
        toast.success({
          title: '¡Verificación exitosa!',
          description: `Pago Móvil validado: Ref ${reference} por Bs.${amountBS} (${amountUSD} USD)`,
          duration: 6000,
        });

        // Recargar pagos móviles desde Firebase
        await loadVerifiedPagoMoviles();
      } else if (
        verificationResult.found &&
        !verificationResult.amountMatches
      ) {
        // Transacción encontrada pero monto no coincide
        toast.warning({
          title: 'Discrepancia en el monto',
          description: `Se encontró la transacción pero hay diferencias. Esperado: Bs.${amountBS}, Banco: Bs.${verificationResult.actualAmount || 'N/A'}. Contacte al administrador para revisar.`,
          duration: 10000,
        });
      } else if (!verificationResult.found) {
        // Transacción no encontrada
        const errorReasons = [
          'La transacción puede estar pendiente de procesamiento bancario',
          'Verifique que el número de referencia sea correcto',
          'Asegúrese de que la transferencia se realizó desde el teléfono indicado',
          'Puede tomar hasta 24 horas en aparecer en el sistema bancario',
        ];

        toast.error({
          title: 'Transacción no encontrada',
          description: `No se localizó la referencia ${reference}. ${errorReasons[Math.floor(Math.random() * errorReasons.length)]}`,
          duration: 10000,
        });
      } else {
        // Error en la verificación
        const specificError = verificationResult.errorMessage?.includes(
          'NO_MOVEMENTS',
        )
          ? 'No hay movimientos bancarios recientes en la cuenta asociada'
          : verificationResult.errorMessage ||
            'Error desconocido en el sistema de verificación';

        toast.error({
          title: '🔧 Error en la verificación',
          description: specificError,
          duration: 8000,
        });
      }
    } catch (_error) {
      toast.error({
        title: '💥 Error del sistema',
        description:
          'Error interno al procesar la verificación. Contacte al soporte técnico.',
        duration: 8000,
      });
    }
  };

  const handlePagoMovilCancel = () => {
    setShowPagoMovilModal(false);
    setPagoMovilData({
      amount: '',
      reference: '',
      phone: '',
      cedula: '',
      banco: '',
      fechaPago: new Date().toISOString().split('T')[0],
    });

    // Si no hay monto, remover el método de los seleccionados
    if (!paymentAmounts[PaymentMethodEnum.PAGO_MOVIL]) {
      setSelectedPaymentMethods((prev) =>
        prev.filter((m) => m !== PaymentMethodEnum.PAGO_MOVIL),
      );
    }
  };

  // Pago Móvil Manual (sin verificación BDV, como el mobile)
  const handlePagoMovilManualSubmit = async () => {
    const { amount, reference } = pagoMovilData;

    if (!amount || parseFloat(amount) <= 0) {
      toast.error({ title: 'Error', description: 'Ingrese un monto válido' });
      return;
    }
    if (!reference || reference.trim().length === 0) {
      toast.error({
        title: 'Error',
        description: 'Ingrese la referencia del pago',
      });
      return;
    }

    // Validar que la referencia no este duplicada en otro pago
    try {
      const conflict = await isPaymentReferenceUsed(reference, order?.id);
      if (conflict) {
        toast.error({
          title: '🚫 Referencia duplicada',
          description: `La referencia ${reference} ya fue registrada en otro pago (orden ${conflict.orderId?.slice(-8) || 'N/A'}, $${conflict.amount.toFixed(2)}). No puede usarse de nuevo.`,
          duration: 10000,
        });
        return;
      }
    } catch (err) {
      console.error(
        '[PAY] isPaymentReferenceUsed (manual) failed for ref',
        reference,
        err,
      );
      toast.error({
        title: 'Error al validar referencia',
        description: `No se pudo verificar si la referencia existe. ${err instanceof Error ? err.message : 'Intente nuevamente.'}`,
      });
      return;
    }

    const amountBS = parseFloat(amount).toFixed(2);
    const amountInUSD =
      bcvRate > 0 ? bsToUsd(parseFloat(amountBS), bcvRate) : 0;

    // Registrar como PAGO_MOVIL_MANUAL (sin verificacion API)
    setPaymentAmounts((prev) => {
      const existing = parseFloat(
        prev[PaymentMethodEnum.PAGO_MOVIL_MANUAL] || '0',
      );
      return {
        ...prev,
        [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: (existing + amountInUSD).toFixed(
          2,
        ),
      };
    });
    setPaymentReferences((prev) => ({
      ...prev,
      [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: reference,
    }));

    if (!selectedPaymentMethods.includes(PaymentMethodEnum.PAGO_MOVIL_MANUAL)) {
      setSelectedPaymentMethods((prev) => [
        ...prev,
        PaymentMethodEnum.PAGO_MOVIL_MANUAL,
      ]);
    }

    toast.success({
      title: 'Pago Móvil Manual registrado',
      description: `Ref: ${reference} — Bs.${amountBS} ($${amountInUSD.toFixed(2)})`,
    });

    setShowPagoMovilModal(false);
    setPagoMovilData({
      amount: '',
      reference: '',
      phone: '',
      cedula: '',
      banco: '',
      fechaPago: new Date().toISOString().split('T')[0],
    });
  };

  // Imprimir precuenta
  const handlePrintPrecuenta = async () => {
    if (!order) return;
    setIsPrintingPrecuenta(true);
    try {
      let waiterName: string | null = null;
      if (order.waiterId) {
        const waiter =
          usersData.find((u) => u.id === order.waiterId) ??
          (order.waiterName ? { name: order.waiterName } : undefined);
        if (waiter) waiterName = waiter.name;
      }
      const result = await printPrecuenta(order, {
        tableName: table?.name ?? null,
        waiterName,
        bcvRate: bcvRate > 0 ? bcvRate : undefined,
        datos,
      });
      if (result.success) {
        const viaMsg =
          result.via === 'queue' ? ' (enviada a cola de impresión)' : '';
        toast.success({ title: `Precuenta enviada${viaMsg}` });
      } else {
        toast.error({ title: 'Error de impresión', description: result.error });
      }
    } catch {
      toast.error({ title: 'Error al imprimir precuenta' });
    } finally {
      setIsPrintingPrecuenta(false);
    }
  };

  // Crear cuenta por cobrar (pago pendiente)
  /**
   * Candado sincronico contra el doble cobro.
   *
   * `isProcessing` (useState) NO alcanza: solo deshabilita el boton en el
   * render siguiente, y ademas se activa DESPUES de varios `await` de red (la
   * validacion de referencias). Medido en el navegador: 28 ms despues del
   * primer clic el boton seguia habilitado, y dos clics generaron DOS pagos de
   * $5.50 sobre una orden de $5.50. Un ref se escribe en el mismo tick, asi
   * que el segundo clic sale por la puerta antes de tocar la red.
   */
  const paymentLockRef = useRef(false);

  // Deduplicación de pago por mala red: genera una sola vez y mantiene estable en reintentos.
  // Se resetea al terminar (éxito o error) para que el próximo pago tenga ID nuevo.
  const paymentRequestIdRef = useRef<string | undefined>(undefined);

  const handlePendingPayment = async () => {
    // Mismo candado que el cobro: dos clics creaban dos cuentas por cobrar.
    if (paymentLockRef.current) return;
    paymentLockRef.current = true;
    try {
      await processPendingPayment();
    } finally {
      paymentLockRef.current = false;
    }
  };

  const processPendingPayment = async () => {
    if (!order || !selectedCustomer) return;

    // Socio resuelto via /members (Firestore) pero sin customer real en Mongo:
    // useCustomerByMember devuelve id:'' en ese caso. Hay que crear/seleccionar
    // un customer antes o la cuenta por cobrar no tiene a quien apuntar.
    if (!selectedCustomer.id || !selectedCustomer.name) {
      toast.error({
        title: 'Cliente sin registro',
        description:
          'Este socio no esta en la base de clientes. Buscalo o crealo en "Cliente" antes de dejar pendiente.',
      });
      setShowCustomerSearch(true);
      return;
    }

    setIsProcessing(true);
    try {
      // Crear cuenta por cobrar
      const receivableData: Omit<AccountReceivable, 'id'> = {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        orderId: order.id,
        invoiceNumber: `INV-${orderId.slice(-8).toUpperCase()}`,
        amount: totalWithTip,
        paidAmount: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        status: InvoiceStatusEnum.PENDING,
        description: `Orden #${orderId.slice(-8).toUpperCase()}`,
        createdAt: new Date(),
      };

      await createAccountsReceivable.mutateAsync(receivableData);

      // Actualizar orden — marcar como CREDIT (cuenta por cobrar)
      // El cobro real se hace desde el modulo de cuentas por cobrar
      await updateOrder.mutateAsync({
        id: order.id,
        data: {
          paymentStatus: PaymentStatusEnum.PENDING,
          status: OrderStatusEnum.CREDIT,
          customerId: selectedCustomer.id,
          tipAmount: tipAmount > 0 ? tipAmount : undefined,
          updatedAt: new Date(),
        },
      });

      // Liberar mesa si la orden tiene una asociada
      if (order.tableId) {
        await updateTable.mutateAsync({
          id: order.tableId,
          data: {
            orderId: null,
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
          },
        });
      }

      // Crear factura automáticamente para pagos pendientes
      const invoicePending = await createInvoiceForOrder(
        order,
        PaymentStatusEnum.PENDING,
      );
      // Enviar precuenta por WhatsApp (no bloquea si falla)
      void notifyCustomerWhatsApp(invoicePending);

      // Guardar propina si hay (Fase 2)
      if (tipAmount > 0 && order.waiterId) {
        try {
          let waiterName = 'Desconocido';
          try {
            const waiter =
              usersData.find((u) => u.id === order.waiterId) ??
              (order.waiterName ? { name: order.waiterName } : undefined);
            if (waiter) waiterName = waiter.name;
          } catch {
            /* no bloquear */
          }
          await createTip.mutateAsync({
            orderId: order.id,
            waiterId: order.waiterId,
            waiterName,
            amount: tipAmount,
            createdAt: new Date(),
            userId: user?.id || 'unknown-user',
          });
        } catch (tipErr) {
          console.warn(
            '[handlePendingPayment] Error guardando propina:',
            tipErr,
          );
        }
      }

      // La impresion termica se hace automaticamente en la receipt page al cargar
      // React Query maneja la invalidación de cache automáticamente

      router.push(`/private/pos/receipt/${order.id}`);
    } catch (error) {
      console.error(
        '[handleCuentaPendiente] Error al crear pago pendiente:',
        error,
      );
      toast.error({
        title: 'Error del sistema',
        description:
          'Error al registrar el pago pendiente. Intente nuevamente.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Función para cancelar y volver a la página anterior
  const handleCancelPayment = () => {
    toast.info({ title: 'Volviendo...', description: 'Pago cancelado' });
    if (order?.tableId) {
      router.push(
        `${PRIVATE_ROUTES.POS_ORDER}?tableId=${order.tableId}&orderId=${order.id}`,
      );
    } else {
      router.push(`${PRIVATE_ROUTES.POS_ORDER}?orderId=${order?.id}`);
    }
  };

  // Función para cobrar directamente (marcar como pagado y volver al POS)
  /**
   * Cierra una orden que ya esta cubierta por sus pagos pero quedo con el
   * estado sin actualizar.
   *
   * Pasaba que la cuenta mostraba "faltan $0.00" y aun asi no habia salida:
   * "Procesar Pago" lo frena el techo (bien, si no se cobraria de nuevo sobre
   * una cuenta saldada) y "Cortesia Total" seria mentir, porque el cliente si
   * pago. Quedaba trabada sin ninguna accion posible.
   *
   * NO crea factura: si ya hubo un pago registrado lo normal es que la factura
   * exista, y emitir otra es exactamente lo que dejo 1.806 facturas duplicadas.
   */
  const handleFinalizarYaPagada = async () => {
    if (!order || isProcessing) return;
    setIsProcessing(true);
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        data: {
          paymentStatus: PaymentStatusEnum.PAID,
          status: OrderStatusEnum.PAID,
          updatedAt: new Date(),
        },
      });

      if (order.tableId) {
        await updateTable.mutateAsync({
          id: order.tableId,
          data: {
            orderId: null,
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
          },
        });
      }

      toast.success({ title: 'Orden cerrada — ya estaba pagada' });
      router.push(`/private/pos/receipt/${order.id}`);
    } catch (error) {
      toast.error({
        title: 'No se pudo cerrar la orden',
        description:
          error instanceof Error ? error.message : 'Intenta de nuevo',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const _handleDirectCharge = async () => {
    if (!order) return;

    setIsProcessing(true);
    try {
      // Marcar orden como pagada directamente
      await updateOrder.mutateAsync({
        id: order.id,
        data: {
          paymentStatus: PaymentStatusEnum.PAID,
          status: OrderStatusEnum.PAID,
          updatedAt: new Date(),
        },
      });

      // Si la orden tiene una mesa asociada, limpiar la asociación y restaurar status
      if (order.tableId) {
        await updateTable.mutateAsync({
          id: order.tableId,
          data: {
            orderId: null,
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
          },
        });
      }

      // Crear factura automáticamente
      const invoicePaid = await createInvoiceForOrder(
        order,
        PaymentStatusEnum.PAID,
      );
      // Enviar factura por WhatsApp al cliente (no bloquea si falla)
      void notifyCustomerWhatsApp(invoicePaid);

      toast.success({
        title: 'Volviendo al POS...',
        description: 'Orden cobrada exitosamente',
      });
      router.push('/private/pos');
    } catch {
      toast.error({
        title: 'Error del sistema',
        description: 'Error al cobrar la orden',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Cortesía TOTAL: orden completa gratis con PIN admin + motivo. El
  // backend cierra la orden ($0), libera la mesa y conserva la comisión.
  const handleFullCourtesy = async () => {
    if (!order) return;
    if (!courtesyReason.trim()) {
      toast.error({
        title: 'Motivo requerido',
        description: 'Indica el motivo de la cortesía total',
      });
      return;
    }
    if (!courtesyPin.trim()) {
      toast.error({
        title: 'PIN requerido',
        description: 'Ingresa el PIN de administrador',
      });
      return;
    }
    setIsApplyingCourtesy(true);
    try {
      await api.post(`/api/orders/${order.id}/full-courtesy`, {
        reason: courtesyReason.trim(),
        adminPin: courtesyPin.trim(),
        responsible: courtesyResponsible,
      });
      toast.success({
        title: 'Cortesía total aplicada',
        description: 'La orden quedó en $0 y la mesa fue liberada',
      });
      setShowCourtesyModal(false);
      router.push(`/private/pos/receipt/${order.id}`);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      toast.error({
        title: 'No se pudo aplicar la cortesía',
        description:
          status === 401
            ? 'PIN de administrador inválido'
            : error instanceof Error
              ? error.message
              : 'Intenta de nuevo',
      });
    } finally {
      setIsApplyingCourtesy(false);
    }
  };

  // Descuento sobre UNA linea. El backend valida el PIN, el tope y recalcula
  // el servicio sobre lo que de verdad se cobra.
  const handleApplyDiscount = async () => {
    if (!order || !discountTarget) return;
    const valor = parseFloat(discountValue);
    if (!(valor > 0)) {
      toast.error({
        title: 'Monto invalido',
        description: 'Indica cuanto vas a descontar',
      });
      return;
    }
    if (!discountReason.trim()) {
      toast.error({
        title: 'Motivo requerido',
        description:
          'Un descuento sin motivo es plata que se fue sin explicacion',
      });
      return;
    }
    if (!discountPin.trim()) {
      toast.error({
        title: 'PIN requerido',
        description: 'Ingresa el PIN de administrador',
      });
      return;
    }
    setIsApplyingDiscount(true);
    try {
      await api.patch(
        `/api/orders/${order.id}/items/${discountTarget._id}/discount`,
        {
          type: discountType,
          value: valor,
          reason: discountReason.trim(),
          adminPin: discountPin.trim(),
        },
      );
      await refetchOrder();
      toast.success({
        title: 'Descuento aplicado',
        description: `${discountTarget.name}: ${
          discountType === 'PCT' ? `${valor}%` : `$${valor.toFixed(2)}`
        }`,
      });
      closeDiscountModal();
    } catch (error) {
      const status = (error as { status?: number })?.status;
      toast.error({
        title: 'No se pudo aplicar el descuento',
        description:
          status === 401
            ? 'PIN de administrador invalido'
            : error instanceof Error
              ? error.message
              : 'Intenta de nuevo',
      });
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  const handleRemoveDiscount = async () => {
    if (!order || !discountTarget) return;
    if (!discountReason.trim() || !discountPin.trim()) {
      toast.error({
        title: 'Faltan datos',
        description: 'Quitar un descuento tambien exige motivo y PIN',
      });
      return;
    }
    setIsApplyingDiscount(true);
    try {
      await api.del(
        `/api/orders/${order.id}/items/${discountTarget._id}/discount`,
        {
          reason: discountReason.trim(),
          adminPin: discountPin.trim(),
        },
      );
      await refetchOrder();
      toast.success({ title: 'Descuento retirado' });
      closeDiscountModal();
    } catch (error) {
      const status = (error as { status?: number })?.status;
      toast.error({
        title: 'No se pudo quitar el descuento',
        description:
          status === 401
            ? 'PIN de administrador invalido'
            : error instanceof Error
              ? error.message
              : 'Intenta de nuevo',
      });
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  const closeDiscountModal = () => {
    setDiscountTarget(null);
    setDiscountValue('');
    setDiscountReason('');
    setDiscountPin('');
    setDiscountType('PCT');
  };

  const handlePayment = async () => {
    if (paymentLockRef.current) return;
    paymentLockRef.current = true;
    try {
      await processPayment();
    } finally {
      paymentLockRef.current = false;
    }
  };

  const processPayment = async () => {
    if (!order) return;

    const totalPaid = calculateTotalPaid();
    const isPendingPayment =
      selectedCustomer &&
      selectedPaymentMethods.includes(PaymentMethodEnum.PENDING);

    if (totalPaid <= 0 && !isPendingPayment) {
      toast.error({
        title: 'Monto requerido',
        description: 'Debe ingresar al menos un monto de pago',
      });
      return;
    }

    // ── Techo del cobro (auditoria 19/08/2026) ──
    // `isPaymentComplete()` solo validaba el piso: exigia un minimo y nunca un
    // maximo. Por eso una orden de $63.80 acepto $379.78 sin una sola alerta,
    // y 42 clientes reales terminaron pagando dos veces ($1026 en total). El
    // caso tipico es el pago mixto: el primer metodo se autocompleta con la
    // cuenta entera y al agregar el segundo nadie le baja el monto al primero.
    // La propina NO cae aca: `remainingToPay` ya la incluye via totalWithTip.
    if (!isPendingPayment) {
      const exceso = obtenerExcesoPago(totalPaid, remainingToPay);
      if (exceso > 0) {
        toast.error({
          title: 'El monto supera la cuenta',
          description:
            `Esta cobrando $${totalPaid.toFixed(2)} y faltan $${remainingToPay.toFixed(2)} ` +
            `($${exceso.toFixed(2)} de mas). Si esta dividiendo entre varios metodos, ` +
            `baje el monto del primero. Si es propina, use los botones de propina ` +
            `para que quede registrada al mesonero.`,
          duration: 12000,
        });
        return;
      }
    }

    // Validar referencias de tarjeta (no pueden estar duplicadas)
    if (selectedPaymentMethods.includes(PaymentMethodEnum.CARD)) {
      const seenInForm = new Set<string>();
      for (const entry of cardPayments) {
        const ref = entry.reference?.trim();
        const amount = parseFloat(entry.amount) || 0;
        if (!ref || amount <= 0) continue;

        // Duplicado dentro del mismo formulario
        if (seenInForm.has(ref)) {
          toast.error({
            title: 'Referencia duplicada',
            description: `La referencia "${ref}" esta repetida en este pago. Cada tarjeta debe tener una referencia unica.`,
          });
          return;
        }
        seenInForm.add(ref);

        // Duplicado en otro pago del sistema
        try {
          const conflict = await isPaymentReferenceUsed(ref, order.id);
          if (conflict) {
            toast.error({
              title: '🚫 Referencia duplicada',
              description: `La referencia "${ref}" ya fue usada en otro pago (orden ${conflict.orderId?.slice(-8) || 'N/A'}, $${conflict.amount.toFixed(2)}).`,
              duration: 10000,
            });
            return;
          }
        } catch (err) {
          console.error(
            '[PAY] isPaymentReferenceUsed (card) failed for ref',
            ref,
            err,
          );
          toast.error({
            title: 'Error al validar referencias',
            description: `No se pudo verificar la referencia "${ref}". ${err instanceof Error ? err.message : 'Intente nuevamente.'}`,
          });
          return;
        }
      }
    }

    // Generar clientRequestId una sola vez (estable en reintentos)
    if (!paymentRequestIdRef.current) {
      paymentRequestIdRef.current = generateAttemptId();
    }

    setIsProcessing(true);
    try {
      toast.info({
        title: 'Por favor espere',
        description: 'Procesando pago...',
      });

      console.log(
        '[PAY] Iniciando pago — orderId:',
        order.id,
        'tableId:',
        order.tableId,
        'total:',
        order.total,
        'bcvRate:',
        bcvRate,
        'clientRequestId:',
        paymentRequestIdRef.current,
      );
      console.log(
        '[PAY] Métodos seleccionados:',
        selectedPaymentMethods,
        'montos:',
        paymentAmounts,
      );
      console.log(
        '[PAY] isPaymentComplete:',
        isPaymentComplete(),
        'totalPaidBs:',
        calculateTotalPaidInBs(),
        'totalDueBs:',
        order.total * bcvRate,
      );

      // Crear pagos por cada método usado (excepto CARD que se maneja aparte)
      const paymentPromises = selectedPaymentMethods
        .filter((method) => {
          if (method === PaymentMethodEnum.CARD) return false; // Las tarjetas van aparte
          const amountStr = paymentAmounts[method];
          return amountStr && parseFloat(amountStr) > 0;
        })
        .map((method) => {
          const amountStr = paymentAmounts[method];
          const amount = parseFloat(amountStr || '0');
          const isBsMethod = method === PaymentMethodEnum.CASH_BS;
          const reference = paymentReferences[method];
          // Tomar proof del pendingPayment correspondiente (cobro mesonero)
          const sourcePending = order.pendingPayments?.find(
            (pp) => pp.method === method,
          );
          const proofImageUrl =
            sourcePending?.proofUrls?.[0] ?? order.paymentProofUrls?.[0];
          const paymentData: Omit<Payment, 'id'> & {
            clientRequestId?: string;
          } = {
            orderId: order.id,
            amount: isBsMethod ? bsToUsd(amount, bcvRate) : amount,
            method: method,
            userId: user?.id || 'unknown-user',
            createdAt: new Date(),
            clientRequestId: paymentRequestIdRef.current,
            ...(isBsMethod && {
              bcvRate,
              expectedAmountBS: amount,
            }),
            ...(reference && { transactionId: reference, reference }),
            ...(proofImageUrl && { proofImageUrl }),
          };
          return createPayment.mutateAsync(paymentData);
        });

      // Crear pagos de tarjeta (Fase 3 — múltiples entradas)
      if (selectedPaymentMethods.includes(PaymentMethodEnum.CARD)) {
        for (const entry of cardPayments) {
          const amount = parseFloat(entry.amount) || 0;
          if (amount <= 0) continue;
          paymentPromises.push(
            createPayment.mutateAsync({
              orderId: order.id,
              amount: bsToUsd(amount, bcvRate),
              method: PaymentMethodEnum.CARD,
              userId: user?.id || 'unknown-user',
              createdAt: new Date(),
              bcvRate,
              expectedAmountBS: amount,
              clientRequestId: paymentRequestIdRef.current,
              ...(entry.reference && { transactionId: entry.reference }),
            }),
          );
        }
      }

      console.log(
        '[PAY] Creando',
        paymentPromises.length,
        'registro(s) de pago...',
      );
      await Promise.all(paymentPromises);
      console.log('[PAY] Pagos creados OK');

      // Guardar propina en Firestore (Fase 2)
      if (tipAmount > 0 && order.waiterId) {
        try {
          let waiterName = 'Desconocido';
          try {
            const waiter =
              usersData.find((u) => u.id === order.waiterId) ??
              (order.waiterName ? { name: order.waiterName } : undefined);
            if (waiter) waiterName = waiter.name;
          } catch {
            /* no bloquear */
          }
          await createTip.mutateAsync({
            orderId: order.id,
            waiterId: order.waiterId,
            waiterName,
            amount: tipAmount,
            createdAt: new Date(),
            userId: user?.id || 'unknown-user',
          });
          console.log('[PAY] Propina guardada OK');
        } catch (tipErr) {
          console.warn(
            '[PAY] Error guardando propina (no bloqueante):',
            tipErr,
          );
        }
      }

      // Considerar pagos previos + nuevos para determinar estado
      const allTimePaid = previousPaymentsTotal + calculateTotalPaid();
      const fullyCovered = isPaymentComplete(); // ya compara contra remainingToPay

      // Verificacion de seguridad: no marcar como PAID si el total pagado
      // en USD es claramente menor al total requerido (orden + propina + CxC, tolerancia de $0.50)
      const orderTotal = totalWithTip;
      const isReallyFullyPaid = allTimePaid >= orderTotal - 0.5;
      const newStatus =
        fullyCovered && isReallyFullyPaid
          ? PaymentStatusEnum.PAID
          : PaymentStatusEnum.PARTIAL;

      console.log(
        '[PAY] newStatus:',
        newStatus,
        '— allTimePaid:',
        allTimePaid.toFixed(2),
        '— orderTotal:',
        orderTotal.toFixed(2),
        '— fullyCovered:',
        fullyCovered,
        '— isReallyFullyPaid:',
        isReallyFullyPaid,
        '— actualizando orden...',
      );
      await updateOrder.mutateAsync({
        id: order.id,
        data: {
          paymentStatus: newStatus,
          status:
            newStatus === PaymentStatusEnum.PAID
              ? OrderStatusEnum.PAID
              : order.status,
          customerId: selectedCustomer?.id || order.customerId,
          tipAmount: tipAmount > 0 ? tipAmount : undefined,
          updatedAt: new Date(),
        },
      });
      console.log('[PAY] Orden actualizada OK');

      // Solo liberar mesa cuando el pago es completo
      if (newStatus === PaymentStatusEnum.PAID && order.tableId) {
        console.log('[PAY] Liberando mesa:', order.tableId);
        await updateTable.mutateAsync({
          id: order.tableId,
          data: {
            orderId: null,
            status: TableStatusEnum.ISAVAILABLE,
            isAvailable: true,
          },
        });
        console.log('[PAY] Mesa liberada OK');
      } else {
        console.log(
          '[PAY] No se libera mesa — newStatus:',
          newStatus,
          'tableId:',
          order.tableId,
        );
      }

      // Actualizar factura existente o crear nueva
      if (existingInvoice) {
        await updateInvoice.mutateAsync({
          id: existingInvoice.id,
          data: {
            status:
              newStatus === PaymentStatusEnum.PAID
                ? InvoiceStatusEnum.PAID
                : InvoiceStatusEnum.PARTIALLY_PAID,
            paidAt:
              newStatus === PaymentStatusEnum.PAID ? new Date() : undefined,
            updatedAt: new Date(),
          },
        });
      } else {
        const invoiceNew = await createInvoiceForOrder(order, newStatus);
        void notifyCustomerWhatsApp(invoiceNew);
      }

      // Aplicar pagos a las cuentas por cobrar seleccionadas
      if (selectedReceivables.size > 0 && totalPaid >= totalOrderAndTip) {
        const excessPayment = totalPaid - totalOrderAndTip;

        // Distribuir el exceso de pago entre las cuentas seleccionadas
        let remainingPayment = excessPayment;

        for (const receivableId of Array.from(selectedReceivables)) {
          const receivable = customerReceivables.find(
            (r) => r.id === receivableId,
          );
          if (!receivable || remainingPayment <= 0) continue;

          const pending = receivable.amount - receivable.paidAmount;
          const paymentToApply = Math.min(pending, remainingPayment);

          // Actualizar la cuenta por cobrar
          const newPaidAmount = receivable.paidAmount + paymentToApply;
          const newStatus =
            newPaidAmount >= receivable.amount
              ? InvoiceStatusEnum.PAID
              : InvoiceStatusEnum.PARTIALLY_PAID;

          await updateAccountsReceivable.mutateAsync({
            id: receivableId,
            data: {
              paidAmount: newPaidAmount,
              status: newStatus,
              updatedAt: new Date(),
            },
          });

          remainingPayment -= paymentToApply;

          console.log(
            `✅ Aplicado $${paymentToApply.toFixed(2)} a cuenta ${receivable.invoiceNumber}`,
          );
        }

        toast.success({
          title: 'Cuentas actualizadas',
          description: `Se aplicaron pagos a ${selectedReceivables.size} cuenta(s) por cobrar`,
        });
      }

      // La impresion termica se hace automaticamente en la receipt page al cargar

      // Actualizar creditUsed de forma no bloqueante para no retrasar la transición al recibo.
      // El cargo al credito del socio TIENE que quedar anotado: si no, su cupo
      // no se agota nunca y puede volver a consumirlo. Antes esto iba a una
      // ruta que solo respondia GET (405) y el error se tragaba en un catch,
      // por eso los 1083 socios del padron siguen en creditUsed 0.
      if (appliedMemberCredit > 0 && memberCredit?.associateNumber) {
        try {
          await anotarConsumoDeCredito(
            memberCredit.associateNumber,
            appliedMemberCredit,
          );
        } catch (creditErr) {
          console.error('[handlePayment] no se anoto el credito:', creditErr);
          toast.error({
            title: 'El cobro se registro, pero el crédito NO',
            description: `No se descontaron ${appliedMemberCredit.toFixed(2)} del cupo del socio #${memberCredit.associateNumber}. Avísale a administración.`,
          });
        }
      }

      // React Query maneja la invalidación de cache automáticamente

      toast.success({
        title: 'Redirigiendo al recibo...',
        description: '¡Pago procesado exitosamente!',
      });
      router.push(`/private/pos/receipt/${order.id}`);
    } catch (error) {
      console.error('[handlePayment] Error al procesar el pago:', error);
      toast.error({
        title: 'Error del sistema',
        description: 'Error al procesar el pago. Intente nuevamente.',
      });
      // NO resetear ref en error: permite reintento con el mismo ID
    } finally {
      setIsProcessing(false);
      // Resetear ref solo después del éxito (controlado por el router.push arriba)
      // En error, el ref se mantiene para reintento
      // Aquí no hay lógica: la ejecución llegó al finally por dos vías:
      // 1. success: router.push ejecutó, la página se va a destruir
      // 2. error: ref se mantiene para reintento manual
      // Por eso dejamos que el siguiente handlePayment reuse el ref
    }
  };

  const handleTipSelect = (amount: number) => {
    // Limpiar tip custom al elegir preset
    setCustomTipBs('');
    setShowCustomTip(false);
    if (selectedTip === amount) {
      setSelectedTip(null);
      setTipAmount(0);
    } else {
      setSelectedTip(amount);
      setTipAmount(amount);
    }
  };

  const handleCustomTipBsChange = (value: string) => {
    // Solo numeros con maximo 2 decimales
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setCustomTipBs(normalized);
    setSelectedTip(null);
    const bsNum = parseFloat(normalized) || 0;
    const usdTip = bcvRate > 0 ? bsToUsd(bsNum, bcvRate) : 0;
    setTipAmount(usdTip);
  };

  // === Helpers para múltiples tarjetas (Fase 3) ===
  const currentTime = new Date().toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (loading || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-page to-elevated">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page to-elevated p-4 overflow-x-hidden">
      <div className="mx-auto max-w-full">
        {/* Header Global - Súper Compacto */}
        <div className="mb-3 flex items-center justify-between px-2 py-2 bg-surface/80 rounded-lg backdrop-blur-sm border border-line">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold text-content font-mono">
              {order
                ? getDisplayOrderNumber(order)
                : `#${orderId.slice(-8).toUpperCase()}`}
            </h1>
            <span className="text-xs text-dim">
              {table ? `${table.name} (Mesa ${table.number})` : 'LLEVAR'}
            </span>
            <span className="text-xs text-dim">{currentTime}</span>
            {previousPaymentsTotal > 0 && (
              <span className="text-xs px-2 py-0.5 bg-accent/15 text-accent rounded-full font-medium">
                Parcial — Pagado: ${previousPaymentsTotal.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Layout Principal en 2 Columnas (7+5) */}
        <div className="grid grid-cols-12 gap-3 h-[calc(100vh-140px)] w-full max-w-none overflow-hidden">
          {/* Columna 1: Tabla de Items (7 columnas) */}
          <div className="col-span-7">
            <Card className="h-full overflow-hidden bg-surface/90 backdrop-blur-sm border-line">
              <div className="h-full flex flex-col">
                <div className="p-3 bg-elevated border-b border-line flex items-center justify-between">
                  <h2 className="font-semibold text-content">
                    PRODUCTOS
                    {splitMode && splitSubtotal !== null && (
                      <span className="ml-2 text-sm font-normal text-brand">
                        ({splitSelection.size} seleccionados · $
                        {splitSubtotal.toFixed(2)})
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2">
                    {hasEligiblePacks && (
                      <button
                        type="button"
                        onClick={() => setModalDeConversionAbierto(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center gap-1.5"
                        title="Ver las conversiones a tobo o caja disponibles"
                      >
                        <Beer className="w-3.5 h-3.5" />
                        Convertir a tobo
                      </button>
                    )}
                    <button
                      onClick={() => toggleSplitMode(order)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        splitMode
                          ? 'bg-brand text-on-brand shadow-sm'
                          : 'bg-surface text-dim border border-line hover:bg-elevated'
                      }`}
                    >
                      {splitMode ? 'Cuenta completa' : 'Dividir cuenta'}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <Table
                    data={order.items}
                    columns={columns}
                    pageSize={20}
                    headerStyles="bg-elevated border-b border-line"
                    bodyStyles="bg-surface divide-y divide-line"
                    rowStyles="hover:bg-elevated transition-colors"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Columna 2: Panel unificado (5 columnas) */}
          <div
            className="col-span-5 grid h-full overflow-hidden"
            style={{ gridTemplateRows: '1fr auto' }}
          >
            {/* Contenido scrolleable */}
            <div className="overflow-y-auto space-y-2 min-h-0 pr-1">
              {/* ── Totales compactos ── */}
              <TarjetaDeTotales
                order={order}
                hasSelectedCustomer={!!selectedCustomer}
                customerReceivablesCount={customerReceivables.length}
                selectedReceivablesSize={selectedReceivables.size}
                onShowReceivablesDetail={() => setShowReceivablesDetail(true)}
                previousPaymentsTotal={previousPaymentsTotal}
                remainingToPay={remainingToPay}
                remainingInBs={remainingInBs}
                loadingRate={loadingRate}
                isUsingDefaultRate={isUsingDefaultRate}
                bcvRate={bcvRate}
                onRefreshBcvRate={handleRefreshBcvRate}
                onEditRateStart={handleEditRateStart}
                appliedMemberCredit={appliedMemberCredit}
                memberAssociateNumber={memberCredit?.associateNumber}
                totalWithTip={totalWithTip}
                selectedReceivablesTotal={selectedReceivablesTotal}
                tipAmount={tipAmount}
                qrPanel={
                  <PagoMovilQrPanel
                    amountUsd={remainingToPay}
                    amountBs={remainingInBs}
                    bcvRate={bcvRate}
                  />
                }
                controlPropina={
                  <ControlDePropina
                    selectedTip={selectedTip}
                    onTipSelect={handleTipSelect}
                    showCustomTip={showCustomTip}
                    onToggleCustomTip={() =>
                      setShowCustomTip((v) => {
                        const next = !v;
                        if (!next) {
                          setCustomTipBs('');
                          setTipAmount(selectedTip ?? 0);
                        }
                        return next;
                      })
                    }
                    customTipBs={customTipBs}
                    onCustomTipChange={handleCustomTipBsChange}
                    tipAmount={tipAmount}
                    bcvRate={bcvRate}
                  />
                }
              />

              {/* ── Pagos Anteriores (solo si hay) ── */}
              {previousPayments.length > 0 && (
                <Card className="p-2 bg-surface/90 backdrop-blur-sm border-accent/20">
                  <button
                    onClick={() =>
                      setShowPreviousPayments(!showPreviousPayments)
                    }
                    className="w-full flex items-center justify-between text-xs font-semibold text-accent"
                  >
                    <span>Pagos Anteriores ({previousPayments.length})</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">
                        ${previousPaymentsTotal.toFixed(2)}
                      </span>
                      {showPreviousPayments ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </button>
                  {showPreviousPayments && (
                    <div className="mt-2 space-y-1 border-t border-accent/20 pt-2">
                      {previousPayments.map((pp, idx) => (
                        <div
                          key={pp.id || idx}
                          className="flex justify-between text-xs text-dim"
                        >
                          <span>
                            {pp.method === PaymentMethodEnum.CASH_BS
                              ? 'Efec. Bs'
                              : pp.method === PaymentMethodEnum.CASH_USD
                                ? 'Efec. $'
                                : pp.method === PaymentMethodEnum.CARD
                                  ? 'Tarjeta'
                                  : pp.method === PaymentMethodEnum.PAGO_MOVIL
                                    ? 'P. Móvil'
                                    : pp.method === PaymentMethodEnum.TRANSFER
                                      ? 'Transf.'
                                      : pp.method}
                          </span>
                          <span className="font-semibold">
                            ${pp.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      <FilaDeResumen
                        className="text-xs font-bold text-accent border-t border-accent/20 pt-1"
                        etiqueta="Restante:"
                        valor={<>${remainingToPay.toFixed(2)}</>}
                      />
                    </div>
                  )}
                </Card>
              )}

              {/* ── Cobro registrado por el mesonero (PENDING_VERIFICATION) ── */}
              <CobroDelMesonero order={order} bcvRate={bcvRate} />

              {/* ── Métodos de Pago ── */}
              <MetodosDePago
                selectedMethods={selectedPaymentMethods}
                onToggleMethod={handlePaymentMethodToggle}
                paymentAmounts={paymentAmounts}
                onAmountChange={handleAmountChange}
                verifiedPagoMoviles={verifiedPagoMoviles}
                onOpenPagoMovil={() => setShowPagoMovilModal(true)}
                cardPayments={cardPayments}
                onUpdateCard={updateCardPayment}
                onRemoveCard={removeCardPayment}
                onAddCard={addCardPayment}
              />

              {/* ── Cliente (colapsable) ── */}
              <Card className="p-2 bg-surface/90 backdrop-blur-sm border-line">
                <button
                  onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                  className="w-full flex items-center justify-between"
                >
                  <h3 className="text-xs font-semibold text-dim">
                    Cliente{' '}
                    {selectedCustomer
                      ? `— ${selectedCustomer.name}`
                      : '(opcional)'}
                  </h3>
                  {showCustomerSearch ? (
                    <ChevronUp className="h-3.5 w-3.5 text-dim" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-dim" />
                  )}
                </button>
                {showCustomerSearch && (
                  <div className="mt-2">
                    <CustomerSearch
                      onSelectCustomerAction={setSelectedCustomer}
                      selectedCustomer={selectedCustomer}
                    />
                  </div>
                )}
              </Card>

              {/* ── Crédito Socio ── */}
              <CreditoDeSocio
                memberCredit={memberCredit}
                isLoading={isLoadingCredit}
                associateNumber={order?.associateNumber}
                eligibleAmount={eligibleCreditAmount}
                appliedAmount={appliedMemberCredit}
                onApply={() => setAppliedMemberCredit(eligibleCreditAmount)}
                onRemove={() => setAppliedMemberCredit(0)}
              />

              {/* ── Resumen de pago ── */}
              <ResumenYVuelto
                totalPagado={calculateTotalPaid()}
                totalPagadoBs={calculateTotalPaidInBs()}
                previousPaymentsTotal={previousPaymentsTotal}
                remainingToPay={remainingToPay}
                remainingInBs={remainingInBs}
                bcvRate={bcvRate}
                pagoCompleto={isPaymentComplete()}
              />
            </div>

            {/* ── Botones de Acción - Sticky bottom ── */}
            <div className="sticky bottom-0 z-10 space-y-1.5 pt-2 pb-3 border-t border-line bg-surface/95 backdrop-blur-sm">
              <div className="text-center leading-none">
                <div className="text-xs text-dim">
                  {calculateTotalPaid() <= 0
                    ? 'Selecciona método de pago'
                    : isPaymentComplete()
                      ? (() => {
                          const chBs =
                            bcvRate > 0
                              ? calcularVueltoBs(
                                  calculateTotalPaidInBs(),
                                  remainingToPay,
                                  bcvRate,
                                )
                              : 0;
                          return hayVuelto(chBs)
                            ? `Pago completo — Cambio: $${bsToUsd(chBs, bcvRate).toFixed(2)}`
                            : 'Pago completo';
                        })()
                      : (() => {
                          const diff = faltaPorPagarBs(
                            remainingInBs,
                            calculateTotalPaidInBs(),
                          );
                          return diff > 0
                            ? `Falta: Bs.${diff.toFixed(2)}`
                            : 'Pago completo';
                        })()}
                </div>
              </div>

              <div
                className={`grid gap-2 ${selectedCustomer ? 'grid-cols-3' : 'grid-cols-2'}`}
              >
                <Button
                  onClick={handleCancelPayment}
                  variant="outline"
                  className="h-10 px-3 bg-surface border-2 border-dim/40 text-content hover:bg-elevated hover:border-dim/60 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Volver</span>
                </Button>
                <Button
                  onClick={() => void handlePrintPrecuenta()}
                  disabled={isPrintingPrecuenta}
                  variant="outline"
                  className="h-10 px-3 bg-brand/5 border-2 border-brand text-brand hover:bg-brand/10 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isPrintingPrecuenta ? '...' : 'Precuenta'}</span>
                </Button>
                {selectedCustomer ? (
                  <Button
                    onClick={handlePendingPayment}
                    disabled={isProcessing}
                    className="h-10 px-3 bg-accent hover:bg-accent/90 text-on-brand border-2 border-accent flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg shadow-sm"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Dejar Pend.</span>
                  </Button>
                ) : null}
              </div>

              {!isPaymentComplete() && calculateTotalPaid() > 0 ? (
                <Button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full h-12 px-4 bg-accent hover:bg-accent/90 text-on-brand shadow-md border-2 border-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-bold rounded-lg"
                >
                  {isProcessing ? (
                    <span>Procesando...</span>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>
                        Pago Parcial — Falta Bs.
                        {Math.max(
                          0,
                          remainingInBs - calculateTotalPaidInBs(),
                        ).toFixed(2)}
                      </span>
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handlePayment}
                  disabled={isProcessing || calculateTotalPaid() <= 0}
                  className="w-full h-12 px-4 bg-ok hover:bg-ok/90 text-on-brand shadow-md border-2 border-ok disabled:bg-ok/90 disabled:text-on-brand disabled:border-ok disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-bold rounded-lg"
                >
                  {isProcessing ? (
                    <span>Procesando...</span>
                  ) : calculateTotalPaid() <= 0 ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Ingrese un monto</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Procesar Pago</span>
                    </>
                  )}
                </Button>
              )}

              {/* Salida para una orden ya cubierta por sus pagos cuyo estado
                  no se actualizo. Sin esto queda trabada: el techo frena el
                  cobro nuevo y no hay otra accion posible. */}
              {remainingToPay <= 0.01 &&
                order?.paymentStatus !== PaymentStatusEnum.PAID && (
                  <Button
                    onClick={handleFinalizarYaPagada}
                    disabled={isProcessing}
                    className="w-full h-11 px-4 bg-ok/15 hover:bg-ok/25 text-ok border border-ok/40 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Finalizar — esta cuenta ya está pagada</span>
                  </Button>
                )}

              {/* Cortesía total: requiere PIN admin + motivo */}
              <Button
                onClick={() => setShowCourtesyModal(true)}
                disabled={isProcessing || isApplyingCourtesy}
                className="w-full h-10 px-4 bg-transparent hover:bg-brand/10 text-brand border border-brand/40 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg"
              >
                <Gift className="w-4 h-4" />
                <span>Cortesía Total (PIN admin)</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      <ModalConfirmarEliminacion
        isOpen={showDeleteConfirm}
        nombreItem={itemToDelete?.name}
        onCancel={cancelDeleteItem}
        onConfirm={confirmDeleteItem}
      />

      {/* Modal de Pago Móvil */}
      <ModalPagoMovil
        isOpen={showPagoMovilModal}
        onClose={handlePagoMovilCancel}
        mode={pagoMovilMode}
        onModeChange={setPagoMovilMode}
        data={pagoMovilData}
        onDataChange={setPagoMovilData}
        bcvRate={bcvRate}
        onManualSubmit={handlePagoMovilManualSubmit}
        onAutoSubmit={handlePagoMovilSubmit}
      />

      {/* Modal de Cuentas por Cobrar - Estilo Apple */}
      <ModalCuentasPorCobrar
        isOpen={showReceivablesDetail}
        onClose={() => setShowReceivablesDetail(false)}
        nombreCliente={selectedCustomer?.name || 'Cliente'}
        receivables={customerReceivables}
        seleccionadas={selectedReceivables}
        totalSeleccionado={selectedReceivablesTotal}
        onToggle={toggleReceivableSelection}
        onLimpiar={() => setSelectedReceivables(new Set())}
      />

      {/* Modal de descuento por producto (PIN admin + motivo) */}
      <ModalDescuento
        target={discountTarget}
        isApplying={isApplyingDiscount}
        tipo={discountType}
        onTipoChange={setDiscountType}
        valor={discountValue}
        onValorChange={setDiscountValue}
        motivo={discountReason}
        onMotivoChange={setDiscountReason}
        pin={discountPin}
        onPinChange={setDiscountPin}
        onClose={closeDiscountModal}
        onRemove={handleRemoveDiscount}
        onApply={handleApplyDiscount}
      />

      {/* Modal de cortesía total (PIN admin + motivo) */}
      <ModalCortesia
        isOpen={showCourtesyModal}
        isApplying={isApplyingCourtesy}
        motivo={courtesyReason}
        onMotivoChange={setCourtesyReason}
        responsable={courtesyResponsible}
        onResponsableChange={setCourtesyResponsible}
        pin={courtesyPin}
        onPinChange={setCourtesyPin}
        onClose={() => {
          setShowCourtesyModal(false);
          setCourtesyPin('');
        }}
        onApply={handleFullCourtesy}
      />

      <ModalDeConversionAPack
        isOpen={modalDeConversionAbierto}
        onClose={() => setModalDeConversionAbierto(false)}
        opciones={opcionesDeConversion}
        onConfirmar={handleConvertToPacks}
        guardando={convertirPack.isPending}
      />

      {/* Toast Container para mostrar notificaciones - se renderiza automáticamente */}
    </div>
  );
}
