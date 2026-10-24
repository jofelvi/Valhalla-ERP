import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  SHADOWS,
  BORDER_RADIUS,
} from '../../constants';
import { showAlert } from '../../utils/alert';
import {
  CREDITO_HABILITADO,
  PROPINA_HABILITADA,
  COMANDA_AL_PAGAR,
} from '../../config/funciones';
import {
  enviarComandaDeOrden,
  pedidoCobrado,
} from '../../services/comandaAlPagar';
import {
  orderService,
  tableService,
  printQueueService,
  uploadPaymentProofs,
  logClientEvent,
} from '../../services';
import { getBcvRate, usdToBs, bsToUsd } from '../../services/bcvRateService';
import { prepararMonto } from '../../services/money';
import {
  totalPagadoUsd,
  validarTechoMoneda,
} from '../../services/cobroMobile.ts';
import {
  Order,
  PendingPaymentEntry,
  PaymentMethodEnum,
  PaymentStatusEnum,
  TableStatusEnum,
  CreditRequest,
} from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store';
import { packCountLabel } from '../../services/packPricing';
import { useTarifas } from '../../config/hooks';
import { pctTexto } from '../../config/totalesDeOrden';
import { tarifasDeOrden } from '../../config/tarifasDeOrden';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'WaiterPayment'>;

const BANCOS = [
  { code: '0102', name: 'Banco de Venezuela (BDV)' },
  { code: '0134', name: 'Banesco' },
  { code: '0105', name: 'Mercantil' },
  { code: '0108', name: 'Provincial / BBVA' },
  { code: '0191', name: 'BNC Nacional de Crédito' },
  { code: '0175', name: 'Bicentenario del Pueblo' },
  { code: '0115', name: 'Exterior' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0174', name: 'Banplus' },
  { code: '0171', name: 'Activo' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0177', name: 'Banfanb' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0137', name: 'Sofitasa' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0146', name: 'Bangente' },
  { code: '0151', name: 'BFC Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'DelSur Banco Universal' },
  { code: '0166', name: 'Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
];

interface MethodConfig {
  method: PaymentMethodEnum;
  label: string;
  icon: string;
  needsReference: boolean;
  amountCurrency: 'USD' | 'BS';
}

const METHOD_CONFIGS: MethodConfig[] = [
  {
    method: PaymentMethodEnum.CASH_USD,
    label: 'Efectivo USD',
    icon: 'cash-outline',
    needsReference: false,
    amountCurrency: 'USD',
  },
  {
    method: PaymentMethodEnum.CASH_BS,
    label: 'Efectivo Bs',
    icon: 'cash-outline',
    needsReference: false,
    amountCurrency: 'BS',
  },
  {
    method: PaymentMethodEnum.PAGO_MOVIL,
    label: 'Pago Móvil',
    icon: 'phone-portrait-outline',
    needsReference: true,
    amountCurrency: 'BS',
  },
  {
    method: PaymentMethodEnum.TRANSFER,
    label: 'Transferencia',
    icon: 'swap-horizontal-outline',
    needsReference: true,
    amountCurrency: 'USD',
  },
  {
    method: PaymentMethodEnum.CARD,
    label: 'Punto de Venta',
    icon: 'card-outline',
    needsReference: true,
    amountCurrency: 'BS',
  },
];

const getConfig = (method: PaymentMethodEnum): MethodConfig =>
  METHOD_CONFIGS.find((c) => c.method === method) ?? METHOD_CONFIGS[0];

interface PaymentEntry {
  id: number;
  method: PaymentMethodEnum;
  amount: string;
  reference: string;
  pmPhone: string;
  pmCedula: string;
  pmBanco: string;
  proofImages: string[];
  confirmed: boolean;
}

let nextEntryId = 1;

const formatAmountInput = (text: string): string => {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  if (parts[1] && parts[1].length > 2)
    return parts[0] + '.' + parts[1].slice(0, 2);
  return cleaned;
};

export const WaiterPaymentScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { orderId, tableId } = route.params;
  const user = useAuthStore((s) => s.user);
  const customerProfile = useAuthStore((s) => s.customer);

  const [order, setOrder] = useState<Order | null>(null);
  const tarifasVigentes = useTarifas();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [bcvRate, setBcvRate] = useState<number>(0);

  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [openBankPickerFor, setOpenBankPickerFor] = useState<number | null>(
    null,
  );
  // Propina opcional. Se ingresa en Bs (porque la dejan por el punto de venta)
  // y el backend la guarda en USD para que comisiones/liquidaciones sumen igual
  // que el resto de los montos.
  const [tipBsInput, setTipBsInput] = useState<string>('');
  // Modal de confirmacion "Enviar a Caja" — mismo estilo que el resto de la app.
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [isPrintingPrecuenta, setIsPrintingPrecuenta] = useState(false);

  // Credit request modal states
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditNoteInput, setCreditNoteInput] = useState<string>('');
  const [isRequestingCredit, setIsRequestingCredit] = useState(false);
  const [isCancellingCredit, setIsCancellingCredit] = useState(false);

  // Progreso de upload por imagen: key = `${entryId}-${imgIdx}` -> 0..100
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );
  // Cual entry esta subiendo en este momento (para mostrar la galeria)
  const [uploadingEntryId, setUploadingEntryId] = useState<number | null>(null);
  // AbortController activo para permitir cancelar
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const unsubscribe = orderService.subscribeToOrder(
      orderId,
      (updatedOrder) => {
        setOrder(updatedOrder);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    getBcvRate().then(setBcvRate);
  }, []);

  const isRealCustomer = useMemo(
    () =>
      !!(
        order?.customerId &&
        order.customerId !== order?.waiterId &&
        order.customerId !== order?.userId
      ),
    [order?.customerId, order?.waiterId, order?.userId],
  );

  const tipBs = useMemo(() => {
    const n = parseFloat(tipBsInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [tipBsInput]);

  // Con PROPINA_HABILITADA apagada la propina queda en 0: no cambia el total
  // ni viaja al backend (tipAmount = 0).
  const tipUsd = useMemo(
    () => (PROPINA_HABILITADA && bcvRate > 0 ? bsToUsd(tipBs, bcvRate) : 0),
    [tipBs, bcvRate],
  );

  const effectiveTotalUsd = useMemo(
    () => (order ? order.total + tipUsd : 0),
    [order, tipUsd],
  );

  const { totalProcessedUsd, remainingUsd } = useMemo(() => {
    if (!order) return { totalProcessedUsd: 0, remainingUsd: 0 };
    const processed = totalPagadoUsd(paymentEntries, bcvRate, true);
    return {
      totalProcessedUsd: processed,
      remainingUsd: Math.max(effectiveTotalUsd - processed, 0),
    };
  }, [order, paymentEntries, bcvRate, effectiveTotalUsd]);

  const confirmedEntries = useMemo(
    () => paymentEntries.filter((e) => e.confirmed),
    [paymentEntries],
  );
  const draftEntry = useMemo(
    () => paymentEntries.find((e) => !e.confirmed),
    [paymentEntries],
  );

  const addPayment = useCallback(
    (method: PaymentMethodEnum) => {
      if (paymentEntries.some((e) => !e.confirmed)) {
        showAlert(
          'Pago pendiente',
          'Guarda o elimina el pago actual antes de agregar otro',
        );
        return;
      }
      const config = getConfig(method);
      let defaultAmount = '';
      if (bcvRate > 0) {
        defaultAmount =
          config.amountCurrency === 'BS'
            ? usdToBs(remainingUsd, bcvRate).toFixed(2)
            : remainingUsd.toFixed(2);
      }
      const entry: PaymentEntry = {
        id: nextEntryId++,
        method,
        amount: defaultAmount,
        reference: '',
        pmPhone: '',
        pmCedula: '',
        pmBanco: '',
        proofImages: [],
        confirmed: false,
      };
      setPaymentEntries((prev) => [...prev, entry]);
      setShowAddMenu(false);
    },
    [paymentEntries, bcvRate, remainingUsd],
  );

  const removePayment = useCallback((id: number) => {
    setPaymentEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateField = useCallback(
    (id: number, field: keyof PaymentEntry, value: string) => {
      setPaymentEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
      );
    },
    [],
  );

  const confirmEntry = useCallback(
    (id: number) => {
      const entry = paymentEntries.find((e) => e.id === id);
      if (!entry) return;
      const config = getConfig(entry.method);

      const parsedAmount = parseFloat(entry.amount);
      if (!parsedAmount || parsedAmount <= 0) {
        showAlert('Monto inválido', 'Ingresa un monto válido');
        return;
      }
      if (config.needsReference && !entry.reference.trim()) {
        showAlert(
          'Referencia requerida',
          `Ingresa la referencia para ${config.label}`,
        );
        return;
      }
      if (entry.method === PaymentMethodEnum.PAGO_MOVIL) {
        if (!entry.pmPhone || entry.pmPhone.length < 10) {
          showAlert(
            'Teléfono requerido',
            'Ingresa el teléfono (mín. 10 dígitos)',
          );
          return;
        }
        if (!entry.pmCedula || entry.pmCedula.trim().length < 4) {
          showAlert('Cédula requerida', 'Ingresa la cédula (ej: V12345678)');
          return;
        }
        if (!entry.pmBanco) {
          showAlert('Banco requerido', 'Selecciona el banco de origen');
          return;
        }
      }

      setPaymentEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, confirmed: true } : e)),
      );
    },
    [paymentEntries],
  );

  const handlePickImage = useCallback(async (entryId: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permisos', 'Se necesitan permisos para acceder a la galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPaymentEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          return {
            ...e,
            proofImages: [
              ...e.proofImages,
              ...result.assets.map((a) => a.uri),
            ].slice(0, 5),
          };
        }),
      );
    }
  }, []);

  const handleTakePhoto = useCallback(async (entryId: number) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permisos', 'Se necesitan permisos para usar la cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) {
      setPaymentEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          return {
            ...e,
            proofImages: [...e.proofImages, result.assets[0].uri].slice(0, 5),
          };
        }),
      );
    }
  }, []);

  const removeImage = useCallback((entryId: number, imgIndex: number) => {
    setPaymentEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        return {
          ...e,
          proofImages: e.proofImages.filter((_, i) => i !== imgIndex),
        };
      }),
    );
  }, []);

  const handleSendToCashier = () => {
    if (!order || !user || confirmedEntries.length === 0) return;
    setShowConfirmSend(true);
  };

  const handlePrintPrecuenta = async () => {
    if (!order) return;
    setIsPrintingPrecuenta(true);
    try {
      await printQueueService.enqueuePrintPrecuenta(order, {
        bcvRate,
        waiterName: user?.name ?? undefined,
      });
      showAlert('Precuenta enviada', 'Se envió a la cola de impresión');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showAlert('Error al imprimir precuenta', msg.slice(0, 200));
    } finally {
      setIsPrintingPrecuenta(false);
    }
  };

  const handleRequestCredit = async () => {
    if (!order || !user) return;
    setIsRequestingCredit(true);
    try {
      await orderService.requestCredit(
        order.id,
        creditNoteInput.trim() || undefined,
      );
      showAlert(
        'Solicitud enviada',
        'Crédito solicitado — esperando autorización de caja',
      );
      setShowCreditModal(false);
      setCreditNoteInput('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showAlert('Error al solicitar crédito', msg.slice(0, 200));
    } finally {
      setIsRequestingCredit(false);
    }
  };

  const handleCancelCreditRequest = async () => {
    if (!order) return;
    setIsCancellingCredit(true);
    try {
      await orderService.cancelCreditRequest(order.id);
      showAlert('Cancelada', 'Solicitud de crédito cancelada');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showAlert('Error al cancelar solicitud', msg.slice(0, 200));
    } finally {
      setIsCancellingCredit(false);
    }
  };

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const processPayments = async () => {
    if (!order || !user) return;
    setIsProcessing(true);
    setUploadProgress({});
    abortRef.current = new AbortController();

    try {
      const pendingPayments: PendingPaymentEntry[] = [];
      let allProofUrls: string[] = [];

      for (const entry of confirmedEntries) {
        const config = getConfig(entry.method);

        let proofUrls: string[] = [];
        if (entry.proofImages.length > 0) {
          setIsUploading(true);
          setUploadingEntryId(entry.id);
          proofUrls = await uploadPaymentProofs(entry.proofImages, order.id, {
            onProgress: (imgIdx, pct) => {
              setUploadProgress((prev) => ({
                ...prev,
                [`${entry.id}-${imgIdx}`]: pct,
              }));
            },
            signal: abortRef.current?.signal,
          });
          allProofUrls = [...allProofUrls, ...proofUrls];
        }

        const parsedAmount = parseFloat(entry.amount);
        // El monto lo prepara la fuente unica (services/money.ts, copia de
        // packages/types). Antes se convertia aca a mano y quedaba un hueco:
        // con `bcvRate > 0` falso —el scraper del BCV falla seguido— el
        // `else` mandaba el numero EN BOLIVARES dentro del campo de dolares.
        // Asi se guardaron 603 pagos en la moneda equivocada.
        const preparado = prepararMonto(parsedAmount, entry.method, bcvRate);
        if (!preparado.convertible) {
          setIsProcessing(false);
          showAlert(
            'Falta la tasa del dia',
            `No se pudo obtener la tasa BCV, y ${config.label} se cobra en bolivares. ` +
              'Sin la tasa el monto se guardaria en la moneda equivocada. ' +
              'Revisa la conexion y vuelve a intentar.',
          );
          return;
        }
        const { amountUsd, amountBs } = preparado;

        const techoCheck = validarTechoMoneda(amountUsd, order.total);
        if (techoCheck.error) {
          setIsProcessing(false);
          setIsUploading(false);
          setUploadingEntryId(null);
          showAlert(
            'Monto no válido',
            techoCheck.mensaje ?? 'El monto excede el límite permitido.',
          );
          return;
        }

        const pe: PendingPaymentEntry = {
          method: entry.method,
          amount: amountUsd,
          amountBs,
          reference: entry.reference.trim() || null,
          proofUrls: proofUrls.length > 0 ? proofUrls : null,
        };

        if (entry.method === PaymentMethodEnum.PAGO_MOVIL) {
          pe.pagoMovilPhone = entry.pmPhone.trim();
          pe.pagoMovilCedula = entry.pmCedula.trim().toUpperCase();
          pe.pagoMovilBanco = entry.pmBanco;
        }

        pendingPayments.push(pe);
      }

      setIsUploading(false);
      setUploadingEntryId(null);

      const uniqueMethods = new Set(confirmedEntries.map((e) => e.method));
      const isSingle =
        uniqueMethods.size === 1 && confirmedEntries.length === 1;
      const primaryMethod = isSingle
        ? confirmedEntries[0].method
        : PaymentMethodEnum.MIXED;

      const updateData: Record<string, unknown> = {
        paymentStatus: PaymentStatusEnum.PENDING_VERIFICATION,
        paymentMethod: primaryMethod,
        bcvRate,
        pendingPayments,
        paymentProofUrls: allProofUrls.length > 0 ? allProofUrls : null,
        // Si la orden venia rechazada, limpiar el flag al reenviar el pago
        paymentRejected: false,
        paymentRejectionReason: null,
        paymentRejectedAt: null,
        // Propina (USD). El backend la suma al cierre y queda visible en el POS.
        tipAmount: tipUsd > 0 ? tipUsd : 0,
      };

      if (isSingle) {
        const entry = confirmedEntries[0];
        const config = getConfig(entry.method);
        const parsedAmount = parseFloat(entry.amount);
        updateData.paymentReference = entry.reference.trim() || null;
        updateData.paymentAmountBs =
          config.amountCurrency === 'BS'
            ? parsedAmount
            : usdToBs(parsedAmount, bcvRate);
        if (entry.method === PaymentMethodEnum.PAGO_MOVIL) {
          updateData.pagoMovilPhone = entry.pmPhone.trim();
          updateData.pagoMovilCedula = entry.pmCedula.trim().toUpperCase();
          updateData.pagoMovilBanco = entry.pmBanco;
        }
      }

      // Estado ANTES del update: si la orden aun no estaba cobrada (ni rechazada),
      // este pago es el que la cobra y es cuando sale la comanda.
      const primerCobro =
        COMANDA_AL_PAGAR &&
        !order.paymentRejected &&
        !pedidoCobrado(order.paymentStatus);

      await orderService.updateOrder(order.id, updateData);
      if (tableId) {
        await tableService.updateTableStatus(
          tableId,
          TableStatusEnum.CLEANING,
          null,
        );
      }

      if (primerCobro) {
        // Fire-and-forget: imprimir nunca debe frenar ni romper el cobro.
        void enviarComandaDeOrden(order.id, {
          waiterName: customerProfile?.name ?? user.displayName ?? undefined,
          cajaSummary: true,
        }).catch(() => {});
      }

      // Navegacion directa: Alert.alert con onPress es inconsistente en web
      // (RNW no garantiza que el callback se dispare). El feedback visual viene
      // del badge "En verificacion" en la lista de pedidos.
      navigation.navigate('WaiterTabs');
    } catch (error) {
      console.error('[WaiterPayment] Error registrando cobro:', error);
      setIsUploading(false);
      setUploadingEntryId(null);
      const msg = error instanceof Error ? error.message : String(error);
      const stack =
        error instanceof Error ? error.stack?.slice(0, 500) : undefined;

      // Log al backend para auditoria — incluye contexto util para debugging
      void logClientEvent({
        level: 'error',
        source: 'WaiterPayment.processPayments',
        message: msg,
        userId: user?.uid,
        userEmail: user?.email,
        context: {
          orderId: order?.id,
          orderTotal: order?.total,
          methods: confirmedEntries.map((e) => e.method),
          entriesCount: confirmedEntries.length,
          totalProofImages: confirmedEntries.reduce(
            (n, e) => n + e.proofImages.length,
            0,
          ),
          bcvRate,
          stack,
        },
      });

      // Mostrar causa real para diagnostico (timeout, 400, upload, etc)
      showAlert(
        'Error registrando cobro',
        `${msg.slice(0, 200)}\n\nIntenta de nuevo. Si persiste, avisa al admin.`,
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || !order) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="cash-outline" size={36} color={COLORS.primary} />
        </View>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: SPACING.lg }}
        />
        <Text style={styles.loadingText}>Cargando orden...</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner de rechazo de pago */}
          {order.paymentRejected && (
            <View style={styles.rejectedBanner}>
              <View style={styles.rejectedHeader}>
                <Ionicons
                  name="close-circle"
                  size={22}
                  color="COLORS.errorLight"
                />
                <Text style={styles.rejectedTitle}>
                  Pago rechazado por caja
                </Text>
              </View>
              {order.paymentRejectionReason && (
                <View style={styles.rejectedReasonBox}>
                  <Text style={styles.rejectedReasonLabel}>Motivo:</Text>
                  <Text style={styles.rejectedReasonText}>
                    {order.paymentRejectionReason}
                  </Text>
                </View>
              )}
              <Text style={styles.rejectedHint}>
                Corrige el monto/comprobante y vuelve a enviar el pago.
              </Text>
            </View>
          )}

          {/* Banners de crédito solicitado */}
          {order.creditRequest?.status === 'REQUESTED' && (
            <View style={styles.creditRequestedBanner}>
              <View style={styles.creditBannerHeader}>
                <Ionicons
                  name="hourglass-outline"
                  size={22}
                  color="COLORS.orange"
                />
                <Text style={styles.creditBannerTitle}>
                  ⏳ Crédito solicitado — esperando autorización de caja
                </Text>
              </View>
              {order.creditRequest.note && (
                <Text style={styles.creditBannerNote}>
                  Nota: {order.creditRequest.note}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => {
                  showAlert(
                    'Cancelar solicitud',
                    '¿Seguro que deseas cancelar la solicitud de crédito?',
                    [
                      { text: 'No', onPress: () => {}, style: 'cancel' },
                      {
                        text: 'Sí, cancelar',
                        onPress: () => {
                          void handleCancelCreditRequest();
                        },
                        style: 'destructive',
                      },
                    ],
                  );
                }}
                disabled={isCancellingCredit}
              >
                <Text style={styles.creditBannerButton}>
                  {isCancellingCredit ? 'Cancelando...' : 'Cancelar solicitud'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {order.creditRequest?.status === 'REJECTED' && (
            <View style={styles.creditRejectedBanner}>
              <View style={styles.creditBannerHeader}>
                <Ionicons
                  name="close-circle"
                  size={22}
                  color="COLORS.errorLight"
                />
                <Text style={styles.creditBannerTitle}>Crédito rechazado</Text>
              </View>
              {order.creditRequest.rejectionReason && (
                <Text style={styles.creditRejectionReason}>
                  {order.creditRequest.rejectionReason}
                </Text>
              )}
              <Text style={styles.creditRejectionHint}>
                Puedes volver a solicitar crédito si lo deseas.
              </Text>
            </View>
          )}

          {(order.creditRequest?.status === 'APPROVED' ||
            order.status === 'CREDIT') && (
            <View style={styles.creditApprovedBanner}>
              <View style={styles.creditBannerHeader}>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={COLORS.success}
                />
                <Text style={styles.creditBannerTitle}>
                  ✅ Crédito aprobado — cuenta por cobrar creada
                </Text>
              </View>
              <Text style={styles.creditApprovedHint}>
                La orden ha sido marcada como crédito.
              </Text>
            </View>
          )}

          {/* Resumen del pedido */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons
                name="receipt-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>Resumen del Pedido</Text>
            </View>
            <View style={styles.orderInfo}>
              <Text style={styles.orderNumber}>
                #{order.id.slice(-6).toUpperCase()}
              </Text>
              {order.tableName && (
                <View style={styles.tableBadge}>
                  <Ionicons
                    name="restaurant-outline"
                    size={13}
                    color={COLORS.primary}
                  />
                  <Text style={styles.tableText}>{order.tableName}</Text>
                </View>
              )}
            </View>

            {(order.customerAlias || order.customerName) && (
              <View style={styles.customerRow}>
                <Ionicons
                  name="person-circle-outline"
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.customerLabel}>Cliente:</Text>
                <Text style={styles.customerValue}>
                  {order.customerAlias || order.customerName}
                </Text>
              </View>
            )}

            {order.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemQty}>
                    {packCountLabel(
                      item.quantity,
                      item.productId,
                      item.presentationQty,
                    )}
                    ×
                  </Text>
                  <Text style={styles.itemName}>{item.productName}</Text>
                </View>
                <Text style={styles.itemPrice}>
                  ${item.totalPrice.toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Subtotal</Text>
              <Text style={styles.subtotalValue}>
                ${order.subtotal.toFixed(2)}
              </Text>
            </View>
            {(order.serviceCharge ?? 0) > 0 && (
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>
                  Servicio{' '}
                  {pctTexto(tarifasDeOrden(order, tarifasVigentes).serviceRate)}
                  %
                </Text>
                <Text style={styles.subtotalValue}>
                  ${(order.serviceCharge ?? 0).toFixed(2)}
                </Text>
              </View>
            )}

            {PROPINA_HABILITADA && (
              <View style={styles.tipBlock}>
                <View style={styles.tipHeaderRow}>
                  <Ionicons
                    name="heart-outline"
                    size={15}
                    color={COLORS.primary}
                  />
                  <Text style={styles.tipLabel}>Propina (Bs)</Text>
                  {bcvRate <= 0 && (
                    <Text style={styles.tipDetailLabel}>· cargando tasa…</Text>
                  )}
                </View>
                <View style={styles.tipQuickRow}>
                  {[0, 0.1, 0.15, 0.2].map((pct) => {
                    // Calculo en Bs: % del subtotal en USD * tasa BCV
                    const calcBs =
                      bcvRate > 0
                        ? Math.round(order.total * pct * bcvRate * 100) / 100
                        : 0;
                    const label =
                      pct === 0 ? '0%' : `${Math.round(pct * 100)}%`;
                    const isActive =
                      Math.abs(tipBs - calcBs) < 0.5 &&
                      (calcBs > 0 || tipBs === 0);
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.tipChip,
                          isActive && styles.tipChipActive,
                        ]}
                        onPress={() =>
                          setTipBsInput(calcBs > 0 ? calcBs.toFixed(2) : '')
                        }
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.tipChipText,
                            isActive && styles.tipChipTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                        {pct > 0 && bcvRate > 0 && (
                          <Text
                            style={[
                              styles.tipChipSubText,
                              isActive && styles.tipChipTextActive,
                            ]}
                          >
                            Bs {calcBs.toFixed(0)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <View style={styles.tipInputWrap}>
                    <Text style={styles.tipInputPrefix}>Bs</Text>
                    <TextInput
                      style={styles.tipInput}
                      value={tipBsInput}
                      onChangeText={(t) => setTipBsInput(formatAmountInput(t))}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                {tipBs > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.tipDetailLabel}>
                      Propina {tipBs.toFixed(2)} Bs
                    </Text>
                    <Text style={styles.tipDetailValue}>
                      ≈ ${tipUsd.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total a Cobrar</Text>
              <Text style={styles.totalValue}>
                ${effectiveTotalUsd.toFixed(2)}
              </Text>
            </View>
            {bcvRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.bsLabel}>Total en Bs</Text>
                <Text style={styles.bsValue}>
                  Bs. {usdToBs(effectiveTotalUsd, bcvRate).toFixed(2)}
                </Text>
              </View>
            )}

            {confirmedEntries.length > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.processedLabel}>Procesado</Text>
                  <Text style={styles.processedValue}>
                    ${totalProcessedUsd.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text
                    style={[
                      styles.remainingLabel,
                      remainingUsd <= 0.01 && styles.remainingComplete,
                    ]}
                  >
                    Restante
                  </Text>
                  <Text
                    style={[
                      styles.remainingValue,
                      remainingUsd <= 0.01 && styles.remainingComplete,
                    ]}
                  >
                    {remainingUsd <= 0.01
                      ? '✓ Completo'
                      : `$${remainingUsd.toFixed(2)}`}
                  </Text>
                </View>
                {bcvRate > 0 && remainingUsd > 0.01 && (
                  <Text style={styles.rateText}>
                    Restante en Bs: {usdToBs(remainingUsd, bcvRate).toFixed(2)}
                  </Text>
                )}
              </>
            )}

            {bcvRate > 0 && (
              <Text style={styles.rateText}>
                Tasa BCV: {bcvRate.toFixed(2)} Bs/$
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.precuentaBtn,
                isPrintingPrecuenta && styles.precuentaBtnDisabled,
              ]}
              onPress={() => {
                void handlePrintPrecuenta();
              }}
              disabled={isPrintingPrecuenta}
              activeOpacity={0.8}
            >
              {isPrintingPrecuenta ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons
                  name="print-outline"
                  size={18}
                  color={COLORS.primary}
                />
              )}
              <Text style={styles.precuentaBtnText}>
                {isPrintingPrecuenta ? 'Enviando...' : 'Imprimir Precuenta'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pagos confirmados */}
          {confirmedEntries.map((entry, idx) => {
            const config = getConfig(entry.method);
            const amt = parseFloat(entry.amount);
            const amountLabel =
              config.amountCurrency === 'BS'
                ? `Bs. ${amt.toFixed(2)}`
                : `$${amt.toFixed(2)}`;

            const isUp = uploadingEntryId === entry.id;

            return (
              <View key={entry.id} style={styles.confirmedCard}>
                <View style={styles.confirmedRow}>
                  <View style={styles.confirmedLeft}>
                    <View style={styles.confirmedIcon}>
                      <Ionicons
                        name={config.icon as 'cash-outline'}
                        size={18}
                        color={COLORS.primary}
                      />
                    </View>
                    <View style={styles.confirmedInfo}>
                      <Text style={styles.confirmedMethod}>
                        {config.label} #{idx + 1}
                      </Text>
                      <Text style={styles.confirmedAmount}>{amountLabel}</Text>
                      {entry.reference ? (
                        <Text style={styles.confirmedRef}>
                          Ref: {entry.reference}
                        </Text>
                      ) : null}
                      {entry.pmPhone ? (
                        <Text style={styles.confirmedRef}>
                          Tel: {entry.pmPhone} • CI: {entry.pmCedula}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.confirmedRight}>
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={COLORS.success}
                    />
                    {!isProcessing && (
                      <TouchableOpacity
                        onPress={() => removePayment(entry.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.confirmedDeleteBtn}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={COLORS.error}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {isUp && entry.proofImages.length > 0 && (
                  <View style={styles.uploadGallery}>
                    <Text style={styles.uploadGalleryTitle}>
                      Subiendo comprobantes ({entry.proofImages.length})
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {entry.proofImages.map((uri, imgIdx) => {
                        const pct =
                          uploadProgress[`${entry.id}-${imgIdx}`] ?? 0;
                        const done = pct >= 100;
                        return (
                          <View key={imgIdx} style={styles.uploadThumb}>
                            <Image
                              source={{ uri }}
                              style={styles.uploadImage}
                            />
                            {!done && (
                              <View style={styles.uploadOverlay}>
                                <Text style={styles.uploadPctText}>{pct}%</Text>
                              </View>
                            )}
                            {done && (
                              <View style={styles.uploadDoneBadge}>
                                <Ionicons
                                  name="checkmark"
                                  size={14}
                                  color="#fff"
                                />
                              </View>
                            )}
                            <View style={styles.uploadBarTrack}>
                              <View
                                style={[
                                  styles.uploadBarFill,
                                  {
                                    width: `${pct}%`,
                                    backgroundColor: done
                                      ? COLORS.success
                                      : COLORS.primary,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            );
          })}

          {/* Formulario borrador */}
          {draftEntry &&
            (() => {
              const entry = draftEntry;
              const config = getConfig(entry.method);
              const isPM = entry.method === PaymentMethodEnum.PAGO_MOVIL;
              const bancoName = BANCOS.find(
                (b) => b.code === entry.pmBanco,
              )?.name;

              return (
                <View style={styles.section}>
                  <View style={styles.entryHeader}>
                    <View style={styles.entryHeaderLeft}>
                      <View style={styles.entryIconContainer}>
                        <Ionicons
                          name={config.icon as 'cash-outline'}
                          size={18}
                          color={COLORS.primary}
                        />
                      </View>
                      <Text style={styles.entryTitle}>{config.label}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removePayment(entry.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={COLORS.error}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>
                    Monto ({config.amountCurrency === 'BS' ? 'Bs' : 'USD'})
                  </Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.amountPrefix}>
                      {config.amountCurrency === 'BS' ? 'Bs.' : '$'}
                    </Text>
                    <TextInput
                      style={styles.amountInput}
                      value={entry.amount}
                      onChangeText={(text) =>
                        updateField(entry.id, 'amount', formatAmountInput(text))
                      }
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                  </View>
                  {bcvRate > 0 && entry.amount && (
                    <Text style={styles.conversionText}>
                      {config.amountCurrency === 'BS'
                        ? `≈ $${(parseFloat(entry.amount || '0') / bcvRate).toFixed(2)} USD`
                        : `≈ Bs. ${usdToBs(parseFloat(entry.amount || '0'), bcvRate).toFixed(2)}`}
                    </Text>
                  )}

                  {config.needsReference && !isPM && (
                    <>
                      <Text style={styles.fieldLabel}>Referencia</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={entry.reference}
                        onChangeText={(text) =>
                          updateField(entry.id, 'reference', text)
                        }
                        placeholder="Número de referencia"
                        placeholderTextColor={COLORS.textLight}
                        autoCapitalize="characters"
                      />
                    </>
                  )}

                  {isPM && (
                    <>
                      <Text style={styles.fieldLabel}>Referencia</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={entry.reference}
                        onChangeText={(text) =>
                          updateField(
                            entry.id,
                            'reference',
                            text.replace(/\D/g, ''),
                          )
                        }
                        placeholder="Número de referencia"
                        placeholderTextColor={COLORS.textLight}
                        keyboardType="number-pad"
                        maxLength={20}
                      />

                      <Text style={styles.fieldLabel}>Teléfono</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={entry.pmPhone}
                        onChangeText={(text) =>
                          updateField(
                            entry.id,
                            'pmPhone',
                            text.replace(/\D/g, '').slice(0, 11),
                          )
                        }
                        placeholder="04123456789"
                        placeholderTextColor={COLORS.textLight}
                        keyboardType="phone-pad"
                        maxLength={11}
                      />

                      <Text style={styles.fieldLabel}>Cédula</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={entry.pmCedula}
                        onChangeText={(text) =>
                          updateField(entry.id, 'pmCedula', text.toUpperCase())
                        }
                        placeholder="V12345678"
                        placeholderTextColor={COLORS.textLight}
                        autoCapitalize="characters"
                      />

                      <Text style={styles.fieldLabel}>Banco de Origen</Text>
                      <TouchableOpacity
                        style={styles.bankSelector}
                        onPress={() =>
                          setOpenBankPickerFor(
                            openBankPickerFor === entry.id ? null : entry.id,
                          )
                        }
                        activeOpacity={0.8}
                      >
                        <Text
                          style={
                            entry.pmBanco
                              ? styles.bankText
                              : styles.bankPlaceholder
                          }
                        >
                          {bancoName ?? 'Seleccionar banco'}
                        </Text>
                        <Ionicons
                          name={
                            openBankPickerFor === entry.id
                              ? 'chevron-up'
                              : 'chevron-down'
                          }
                          size={18}
                          color={COLORS.textSecondary}
                        />
                      </TouchableOpacity>

                      {openBankPickerFor === entry.id && (
                        <View style={styles.bankList}>
                          <ScrollView
                            style={styles.bankScroll}
                            nestedScrollEnabled
                          >
                            {BANCOS.map((banco) => (
                              <TouchableOpacity
                                key={banco.code}
                                style={[
                                  styles.bankItem,
                                  entry.pmBanco === banco.code &&
                                    styles.bankItemSelected,
                                ]}
                                onPress={() => {
                                  updateField(entry.id, 'pmBanco', banco.code);
                                  setOpenBankPickerFor(null);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.bankCode}>
                                  {banco.code}
                                </Text>
                                <Text
                                  style={[
                                    styles.bankName,
                                    entry.pmBanco === banco.code &&
                                      styles.bankNameSelected,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {banco.name}
                                </Text>
                                {entry.pmBanco === banco.code && (
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={16}
                                    color={COLORS.primary}
                                  />
                                )}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </>
                  )}

                  <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>
                    Comprobante (opcional)
                  </Text>
                  {entry.proofImages.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.imageScroll}
                    >
                      {entry.proofImages.map((uri, imgIdx) => (
                        <View key={imgIdx} style={styles.imageWrapper}>
                          <Image source={{ uri }} style={styles.proofImage} />
                          <TouchableOpacity
                            style={styles.removeImageBtn}
                            onPress={() => removeImage(entry.id, imgIdx)}
                          >
                            <Ionicons
                              name="close-circle"
                              size={24}
                              color={COLORS.error}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                  {entry.proofImages.length < 5 && (
                    <View style={styles.imageButtons}>
                      <TouchableOpacity
                        style={styles.imageBtn}
                        onPress={() => handlePickImage(entry.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="images-outline"
                          size={18}
                          color={COLORS.primary}
                        />
                        <Text style={styles.imageBtnText}>Galería</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.imageBtn}
                        onPress={() => handleTakePhoto(entry.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={18}
                          color={COLORS.primary}
                        />
                        <Text style={styles.imageBtnText}>Cámara</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.saveEntryBtnWrapper}>
                    <TouchableOpacity
                      onPress={() => confirmEntry(entry.id)}
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={[COLORS.success, COLORS.successLight]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.saveEntryBtn}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={COLORS.background}
                        />
                        <Text style={styles.saveEntryText}>Guardar Pago</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}

          {/* Botón agregar pago */}
          {!draftEntry && (
            <View style={styles.section}>
              {/* Botón solicitar crédito - solo si hay cliente real */}
              {CREDITO_HABILITADO && isRealCustomer && (
                <TouchableOpacity
                  style={styles.creditRequestBtn}
                  onPress={() => setShowCreditModal(true)}
                  disabled={
                    order.creditRequest?.status === 'REQUESTED' ||
                    order.creditRequest?.status === 'APPROVED'
                  }
                  activeOpacity={0.8}
                >
                  <View style={styles.creditRequestIcon}>
                    <Ionicons
                      name="card-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <Text style={styles.creditRequestText}>
                    Solicitar crédito
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.addPaymentBtn}
                onPress={() => setShowAddMenu(!showAddMenu)}
                activeOpacity={0.8}
              >
                <View style={styles.addPaymentIcon}>
                  <Ionicons
                    name="add-circle-outline"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.addPaymentText}>
                  Agregar Método de Pago
                </Text>
                <Ionicons
                  name={showAddMenu ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>

              {showAddMenu && (
                <View style={styles.addMenu}>
                  {METHOD_CONFIGS.map((config) => (
                    <TouchableOpacity
                      key={config.method}
                      style={styles.addMenuItem}
                      onPress={() => addPayment(config.method)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.addMenuIconContainer}>
                        <Ionicons
                          name={config.icon as 'cash-outline'}
                          size={18}
                          color={COLORS.primary}
                        />
                      </View>
                      <Text style={styles.addMenuLabel}>{config.label}</Text>
                      <Ionicons
                        name="add"
                        size={18}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Botón enviar a caja con gradiente */}
          {confirmedEntries.length > 0 && !draftEntry && (
            <>
              <View
                style={[
                  styles.payButtonWrapper,
                  (isProcessing ||
                    isUploading ||
                    order.creditRequest?.status === 'REQUESTED') &&
                    styles.payButtonWrapperDisabled,
                ]}
              >
                <TouchableOpacity
                  onPress={handleSendToCashier}
                  disabled={
                    isProcessing ||
                    isUploading ||
                    order.creditRequest?.status === 'REQUESTED'
                  }
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={[COLORS.gradientStart, COLORS.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.payButton}
                  >
                    {isProcessing || isUploading ? (
                      <>
                        <ActivityIndicator
                          size="small"
                          color={COLORS.background}
                        />
                        <Text style={styles.payButtonText}>
                          {isUploading
                            ? 'Subiendo comprobantes...'
                            : 'Procesando...'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          name="send"
                          size={22}
                          color={COLORS.background}
                        />
                        <Text style={styles.payButtonText}>
                          Enviar {confirmedEntries.length}{' '}
                          {confirmedEntries.length === 1 ? 'pago' : 'pagos'} a
                          Caja
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Boton cancelar durante upload */}
              {isUploading && (
                <TouchableOpacity
                  style={styles.cancelUploadBtn}
                  onPress={cancelUpload}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="close-outline"
                    size={18}
                    color={COLORS.error}
                  />
                  <Text style={styles.cancelUploadText}>Cancelar subida</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de confirmacion al enviar a Caja */}
      <Modal
        visible={showConfirmSend}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmSend(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconCircle}>
                <Ionicons name="send" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.modalTitle}>Enviar a Caja</Text>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ gap: 8 }}
            >
              {confirmedEntries.map((e, i) => {
                const config = getConfig(e.method);
                const amt = parseFloat(e.amount);
                const label =
                  config.amountCurrency === 'BS'
                    ? `Bs. ${amt.toFixed(2)}`
                    : `$${amt.toFixed(2)}`;
                return (
                  <View key={e.id} style={styles.modalRow}>
                    <View style={styles.modalRowLeft}>
                      <Ionicons
                        name={config.icon as 'cash-outline'}
                        size={16}
                        color={COLORS.primary}
                      />
                      <Text style={styles.modalRowLabel}>
                        {i + 1}. {config.label}
                      </Text>
                    </View>
                    <Text style={styles.modalRowValue}>{label}</Text>
                  </View>
                );
              })}
              <View style={styles.modalDivider} />
              <View style={styles.modalRow}>
                <Text style={styles.modalTotalLabel}>Total</Text>
                <Text style={styles.modalTotalValue}>
                  ${totalProcessedUsd.toFixed(2)}
                </Text>
              </View>
              {PROPINA_HABILITADA && tipUsd > 0 && (
                <View style={styles.modalRow}>
                  <Text style={styles.modalTipLabel}>Incluye propina</Text>
                  <Text style={styles.modalTipValue}>
                    Bs {tipBs.toFixed(2)} (≈${tipUsd.toFixed(2)})
                  </Text>
                </View>
              )}
              <Text style={styles.modalHint}>
                El cajero verificara estos pagos.
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowConfirmSend(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => {
                  setShowConfirmSend(false);
                  void processPayments();
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="send" size={16} color={COLORS.background} />
                <Text style={styles.modalBtnPrimaryText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de solicitud de crédito */}
      <Modal
        visible={showCreditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreditModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconCircle}>
                <Ionicons
                  name="card-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.modalTitle}>Solicitar crédito</Text>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ gap: 12 }}
            >
              <Text style={styles.creditModalDescription}>
                La orden quedará pendiente de pago como cuenta por cobrar del
                cliente{' '}
                {order?.customerName || order?.customerAlias || 'cliente'}.
              </Text>
              <Text style={styles.creditModalSubtitle}>
                Caja debe autorizarlo.
              </Text>
              <Text style={styles.creditModalLabel}>Nota (opcional)</Text>
              <TextInput
                style={styles.creditModalInput}
                placeholder="Ej: Cliente solicita plazo de 3 días"
                placeholderTextColor={COLORS.textSecondary}
                value={creditNoteInput}
                onChangeText={setCreditNoteInput}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
              <Text style={styles.creditModalHint}>
                {creditNoteInput.length}/200 caracteres
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => {
                  setShowCreditModal(false);
                  setCreditNoteInput('');
                }}
                disabled={isRequestingCredit}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => {
                  void handleRequestCredit();
                }}
                disabled={isRequestingCredit}
                activeOpacity={0.85}
              >
                {isRequestingCredit ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <Ionicons
                    name="card-outline"
                    size={16}
                    color={COLORS.background}
                  />
                )}
                <Text style={styles.modalBtnPrimaryText}>
                  {isRequestingCredit ? 'Solicitando...' : 'Solicitar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
  // ── Banner de pago rechazado ──
  rejectedBanner: {
    backgroundColor: COLORS.errorLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.errorLight,
  },
  rejectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  rejectedTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.errorLight,
  },
  rejectedReasonBox: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.errorLight,
  },
  rejectedReasonLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.errorDark,
    marginBottom: 2,
  },
  rejectedReasonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.errorDark,
    lineHeight: 18,
  },
  rejectedHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.errorDarker,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  orderNumber: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: 3,
  },
  tableText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  itemQty: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    marginRight: SPACING.sm,
    minWidth: 28,
  },
  itemName: { fontSize: FONT_SIZE.md, color: COLORS.text, flex: 1 },
  itemPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  subtotalLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  subtotalValue: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  totalLabel: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  totalValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  bsLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  bsValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primaryLight,
  },
  processedLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.success,
  },
  processedValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.success,
  },
  remainingLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.warning,
  },
  remainingValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.warning,
  },
  remainingComplete: { color: COLORS.success },
  rateText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.sm,
    textAlign: 'right',
  },
  precuentaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}50`,
    backgroundColor: `${COLORS.primary}12`,
  },
  precuentaBtnDisabled: { opacity: 0.6 },
  precuentaBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  customerLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  customerValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  tipBlock: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  tipLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  tipQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  tipChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  tipChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tipChipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  tipChipSubText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 1,
  },
  tipChipTextActive: { color: COLORS.background },
  // Modal "Enviar a Caja"
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    ...SHADOWS.large,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  modalBody: { maxHeight: 320, marginBottom: SPACING.md },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  modalRowLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  modalRowValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  modalTotalLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  modalTotalValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  modalTipLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  modalTipValue: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.semibold,
  },
  modalHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  modalActions: { flexDirection: 'row', gap: SPACING.sm },
  modalBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modalBtnSecondary: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnSecondaryText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  modalBtnPrimary: { backgroundColor: COLORS.primary },
  modalBtnPrimaryText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.background,
    fontWeight: FONT_WEIGHT.bold,
  },
  tipInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    minWidth: 100,
  },
  tipInputPrefix: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  tipInput: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    paddingVertical: 0,
  },
  tipDetailLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  tipDetailValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.success,
    marginTop: SPACING.sm,
  },
  // Pagos confirmados
  confirmedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmedLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  confirmedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  confirmedInfo: { flex: 1 },
  confirmedMethod: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  confirmedAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    marginTop: 2,
  },
  confirmedRef: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  confirmedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  confirmedDeleteBtn: { marginLeft: SPACING.xs },
  // Entry draft
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  entryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  entryIconContainer: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  // Campos
  fieldLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
  },
  amountPrefix: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    marginRight: SPACING.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  conversionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'right',
  },
  bankSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bankText: { fontSize: FONT_SIZE.md, color: COLORS.text },
  bankPlaceholder: { fontSize: FONT_SIZE.md, color: COLORS.textLight },
  bankList: {
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  bankScroll: { maxHeight: 250 },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  bankItemSelected: { backgroundColor: `${COLORS.primary}12` },
  bankCode: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textSecondary,
    minWidth: 40,
  },
  bankName: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text },
  bankNameSelected: { color: COLORS.primary, fontWeight: FONT_WEIGHT.semibold },
  imageScroll: { marginBottom: SPACING.sm },
  imageWrapper: { marginRight: SPACING.md, position: 'relative' },
  proofImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  imageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  imageBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  saveEntryBtnWrapper: {
    marginTop: SPACING.lg,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    borderRadius: BORDER_RADIUS.xl,
  },
  saveEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
  },
  saveEntryText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  // Agregar pago
  addPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  addPaymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPaymentText: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  addMenu: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.md,
  },
  addMenuIconContainer: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMenuLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHT.medium,
  },
  // Enviar
  payButtonWrapper: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.lg,
  },
  payButtonWrapperDisabled: { opacity: 0.6, shadowOpacity: 0, elevation: 0 },
  payButton: {
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  payButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
  // Galeria de upload con barras de progreso
  uploadGallery: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  uploadGalleryTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  uploadThumb: {
    marginRight: SPACING.md,
    width: 80,
  },
  uploadImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadPctText: {
    color: '#fff',
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  uploadDoneBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.success,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBarTrack: {
    marginTop: SPACING.xs,
    height: 4,
    width: 80,
    borderRadius: 2,
    backgroundColor: COLORS.backgroundSecondary,
    overflow: 'hidden',
  },
  uploadBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Boton cancelar subida
  cancelUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: 'transparent',
    marginBottom: SPACING.lg,
  },
  cancelUploadText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.error,
  },
  // ── Credit request banners ──
  creditRequestedBanner: {
    backgroundColor: COLORS.orangeLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.orangeLight,
  },
  creditRejectedBanner: {
    backgroundColor: COLORS.errorLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.errorLight,
  },
  creditApprovedBanner: {
    backgroundColor: COLORS.successLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.successLight,
  },
  creditBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  creditBannerTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.warningDark,
    flex: 1,
  },
  creditBannerNote: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.warningDark,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
  },
  creditBannerButton: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.error,
    textDecorationLine: 'underline',
  },
  creditRejectionReason: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.errorDark,
    marginBottom: SPACING.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  creditRejectionHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.errorDarker,
    fontStyle: 'italic',
  },
  creditApprovedHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.successDark,
    fontStyle: 'italic',
  },
  // ── Credit request button ──
  creditRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}50`,
    backgroundColor: `${COLORS.primary}12`,
    marginBottom: SPACING.md,
  },
  creditRequestIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creditRequestText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
    flex: 1,
  },
  // ── Credit request modal ──
  creditModalDescription: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  creditModalSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  creditModalLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  creditModalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  creditModalHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
});
