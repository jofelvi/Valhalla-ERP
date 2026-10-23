import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  SHADOWS,
  BORDER_RADIUS,
} from '../../constants';
import { api } from '../../services/api/apiClient';
import {
  orderService,
  tableService,
  invoiceService,
  paymentService,
  printQueueService,
  genPaymentRequestId,
} from '../../services';
import { getBcvRate, usdToBs } from '../../services/bcvRateService';
import { prepararMonto, bsToUsd } from '../../services/money';
import {
  totalPagadoUsd,
  pagoCompleto,
  validarTechoMoneda,
} from '../../services/cobroMobile.ts';
import { cashRegisterService } from '../../services/cashRegisterService';
import {
  Order,
  PendingPaymentEntry,
  PaymentMethodEnum,
  PaymentStatusEnum,
  OrderStatusEnum,
  TableStatusEnum,
  InvoiceStatusEnum,
  InvoiceItem,
} from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store';
import { packCountLabel } from '../../services/packPricing';
import { useTarifas } from '../../config/hooks';
import { pctTexto } from '../../config/totalesDeOrden';
import { tarifasDeOrden } from '../../config/tarifasDeOrden';
import { showAlert } from '../../utils/alert';
import { CREDITO_HABILITADO } from '../../config/funciones';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'CashierPayment'>;

interface MethodConfig {
  method: PaymentMethodEnum;
  label: string;
  icon: string;
  amountCurrency: 'USD' | 'BS';
}

const METHOD_CONFIGS: MethodConfig[] = [
  {
    method: PaymentMethodEnum.CASH_USD,
    label: 'Efectivo USD',
    icon: 'cash-outline',
    amountCurrency: 'USD',
  },
  {
    method: PaymentMethodEnum.CASH_BS,
    label: 'Efectivo Bs',
    icon: 'cash-outline',
    amountCurrency: 'BS',
  },
  {
    method: PaymentMethodEnum.PAGO_MOVIL,
    label: 'Pago Movil',
    icon: 'phone-portrait-outline',
    amountCurrency: 'BS',
  },
  {
    method: PaymentMethodEnum.CARD,
    label: 'Punto de Venta',
    icon: 'card-outline',
    amountCurrency: 'BS',
  },
  {
    method: PaymentMethodEnum.TRANSFER,
    label: 'Transferencia',
    icon: 'swap-horizontal-outline',
    amountCurrency: 'USD',
  },
];

const getConfig = (method: PaymentMethodEnum): MethodConfig =>
  METHOD_CONFIGS.find((c) => c.method === method) ?? METHOD_CONFIGS[0];

interface PaymentEntry {
  id: number;
  method: PaymentMethodEnum;
  amount: string;
  reference: string;
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

export const CashierPaymentScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { orderId, tableId } = route.params;
  const user = useAuthStore((s) => s.user);

  const [order, setOrder] = useState<Order | null>(null);
  const tarifasVigentes = useTarifas();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bcvRate, setBcvRate] = useState(0);
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [showMethods, setShowMethods] = useState(false);

  useEffect(() => {
    const unsubscribe = orderService.subscribeToOrder(orderId, (updated) => {
      setOrder(updated);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    getBcvRate().then(setBcvRate);
  }, []);

  // Pre-llenar con pagos pendientes del mesonero
  useEffect(() => {
    if (!order?.pendingPayments?.length || paymentEntries.length > 0) return;

    const prefilled: PaymentEntry[] = order.pendingPayments.map((pp) => {
      const config = getConfig(pp.method);
      const amountBs = typeof pp.amountBs === 'number' ? pp.amountBs : 0;
      const amountUsd = typeof pp.amount === 'number' ? pp.amount : 0;
      const displayAmount = (
        config.amountCurrency === 'BS' ? amountBs : amountUsd
      ).toFixed(2);

      return {
        id: nextEntryId++,
        method: pp.method,
        amount: displayAmount,
        reference: pp.reference ?? '',
      };
    });

    setPaymentEntries(prefilled);
  }, [order?.pendingPayments, paymentEntries.length]);

  const { totalPaidUsd, remainingUsd, changeUsd } = useMemo(() => {
    if (!order) return { totalPaidUsd: 0, remainingUsd: 0, changeUsd: 0 };
    const paid = totalPagadoUsd(paymentEntries, bcvRate);
    const remaining = Math.max(order.total - paid, 0);
    const change = Math.max(paid - order.total, 0);
    return { totalPaidUsd: paid, remainingUsd: remaining, changeUsd: change };
  }, [order, paymentEntries, bcvRate]);

  const isPaymentComplete = useMemo(() => {
    if (!order) return false;
    return pagoCompleto(paymentEntries, bcvRate, order.total);
  }, [order, paymentEntries, bcvRate]);

  const addPayment = useCallback(
    (method: PaymentMethodEnum) => {
      const config = getConfig(method);
      let defaultAmount = '';
      if (bcvRate > 0 && remainingUsd > 0.01) {
        defaultAmount =
          config.amountCurrency === 'BS'
            ? usdToBs(remainingUsd, bcvRate).toFixed(2)
            : remainingUsd.toFixed(2);
      }
      setPaymentEntries((prev) => [
        ...prev,
        { id: nextEntryId++, method, amount: defaultAmount, reference: '' },
      ]);
      setShowMethods(false);
    },
    [bcvRate, remainingUsd],
  );

  const removePayment = useCallback((id: number) => {
    setPaymentEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateField = useCallback(
    (id: number, field: 'amount' | 'reference', value: string) => {
      setPaymentEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
      );
    },
    [],
  );

  const handleProcessPayment = () => {
    if (!order || !isPaymentComplete) return;

    const validEntries = paymentEntries.filter(
      (e) => (parseFloat(e.amount) || 0) > 0,
    );
    if (validEntries.length === 0) {
      showAlert('Sin pagos', 'Agrega al menos un metodo de pago');
      return;
    }

    const lines = validEntries
      .map((e, i) => {
        const config = getConfig(e.method);
        const amt = parseFloat(e.amount);
        const label =
          config.amountCurrency === 'BS'
            ? `Bs. ${amt.toFixed(2)}`
            : `$${amt.toFixed(2)}`;
        return `${i + 1}. ${config.label}: ${label}`;
      })
      .join('\n');

    let summary = `${lines}\n\nTotal cobrado: $${totalPaidUsd.toFixed(2)}`;
    if (changeUsd > 0.01) {
      summary += `\nCambio: $${changeUsd.toFixed(2)}`;
      if (bcvRate > 0)
        summary += ` (Bs. ${usdToBs(changeUsd, bcvRate).toFixed(2)})`;
    }

    showAlert('Confirmar Cobro', summary, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cobrar', onPress: processPayment },
    ]);
  };

  const handlePendingPayment = () => {
    if (!order) return;
    showAlert(
      'Dejar Pendiente',
      `¿Dejar la orden #${order.id.slice(-6).toUpperCase()} como cuenta por cobrar?\n\nMonto: $${order.total.toFixed(2)}${bcvRate > 0 ? ` (Bs. ${usdToBs(order.total, bcvRate).toFixed(2)})` : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: processPendingPayment },
      ],
    );
  };

  const processPendingPayment = async () => {
    if (!order || !user) return;
    setIsProcessing(true);

    try {
      // 1. Crear cuenta por cobrar en el backend
      const dueDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      await api.post('/api/accounts-receivable', {
        customerId: order.customerId,
        customerName: order.customerName ?? 'Sin nombre',
        orderId: order.id,
        invoiceNumber: `INV-${order.id.slice(-8).toUpperCase()}`,
        amount: order.total,
        paidAmount: 0,
        dueDate,
        status: InvoiceStatusEnum.PENDING,
        description: `Orden #${order.id.slice(-8).toUpperCase()}`,
      });

      // 2. Actualizar orden como entregada con pago pendiente
      await orderService.updateOrder(order.id, {
        paymentStatus: PaymentStatusEnum.PENDING,
        status: OrderStatusEnum.CREDIT,
        pendingPayments: null,
      });

      // 3. Liberar mesa si aplica
      if (tableId) {
        await tableService.updateTableStatus(
          tableId,
          TableStatusEnum.ISAVAILABLE,
          null,
        );
      }

      // 4. Log en sesion de caja
      cashRegisterService
        .getActiveSession(user.uid)
        .then((session) => {
          if (session) {
            cashRegisterService
              .logEvent(session.id, {
                type: 'payment_processed',
                description: `Cuenta pendiente #${order.id.slice(-6).toUpperCase()} — $${order.total.toFixed(2)}`,
                orderId: order.id,
                amount: order.total,
              })
              .catch(() => {});
          }
        })
        .catch(() => {});

      showAlert(
        'Cuenta Pendiente',
        `Orden #${order.id.slice(-6).toUpperCase()} registrada como cuenta por cobrar.`,
        [{ text: 'OK', onPress: () => navigation.navigate('CashierTabs') }],
      );
    } catch (error) {
      console.error('Error creando cuenta pendiente:', error);
      showAlert('Error', 'No se pudo registrar la cuenta pendiente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processPayment = async () => {
    if (!order || !user) return;
    setIsProcessing(true);

    try {
      const validEntries = paymentEntries.filter(
        (e) => (parseFloat(e.amount) || 0) > 0,
      );

      // Llave de idempotencia del intento de cobro. Protege el reintento de la
      // MISMA peticion (timeout con el pago ya guardado); un nuevo toque en
      // "Cobrar" es un intento nuevo y genera otra llave.
      const clientRequestId = genPaymentRequestId();

      // 1. Crear Invoice
      const invoiceItems: InvoiceItem[] = order.items.map((item) => ({
        productId: item.productId,
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.totalPrice,
      }));

      const uniqueMethods = new Set(validEntries.map((e) => e.method));
      const paymentMethod =
        uniqueMethods.size === 1
          ? validEntries[0].method
          : PaymentMethodEnum.MIXED;

      const invoiceId = await invoiceService.createInvoice({
        orderId: order.id,
        customerId: order.customerId ?? null,
        customerName: order.customerName ?? null,
        userId: user.uid,
        items: invoiceItems,
        subtotal: order.subtotal,
        tax: order.tax ?? 0,
        total: order.total,
        status: InvoiceStatusEnum.PAID,
        paymentMethod,
      });

      // 2. Crear Payment docs (uno por metodo)
      for (const [entryIndex, entry] of validEntries.entries()) {
        const config = getConfig(entry.method);
        const parsedAmount = parseFloat(entry.amount);

        // Mismo hueco que en el cobro del mesonero: sin tasa, el `else`
        // mandaba bolivares en el campo de dolares. La conversion la hace la
        // fuente unica (services/money.ts) y avisa si no se puede.
        const preparado = prepararMonto(parsedAmount, entry.method, bcvRate);
        if (!preparado.convertible) {
          setIsProcessing(false);
          showAlert(
            'Falta la tasa del dia',
            `No se pudo obtener la tasa BCV y ${config.label} se cobra en bolivares. ` +
              'Sin la tasa el monto quedaria guardado en la moneda equivocada.',
          );
          return;
        }
        const amountUsd = preparado.amountUsd;
        const techoCheck = validarTechoMoneda(amountUsd, order.total);
        if (techoCheck.error) {
          setIsProcessing(false);
          showAlert(
            'Monto no válido',
            techoCheck.mensaje ?? 'El monto excede el límite permitido.',
          );
          return;
        }
        const expectedAmountBS = preparado.amountBs;

        await paymentService.createPayment({
          invoiceId,
          orderId: order.id,
          userId: user.uid,
          amount: Math.round(amountUsd * 100) / 100,
          paymentMethod: entry.method,
          reference: entry.reference.trim() || null,
          bcvRate: bcvRate > 0 ? bcvRate : undefined,
          expectedAmountBS: expectedAmountBS > 0 ? expectedAmountBS : undefined,
          // Una llave por pago: el servidor deduplica por la llave sola, y en un
          // cobro mixto la misma llave haria pasar el 2do metodo por duplicado.
          clientRequestId: `${clientRequestId}-${entryIndex}`,
        });
      }

      // 3. Actualizar orden como pagada
      await orderService.updateOrder(order.id, {
        paymentStatus: PaymentStatusEnum.PAID,
        status: OrderStatusEnum.PAID,
        paymentMethod,
        bcvRate,
        pendingPayments: null,
      });

      // 4. Liberar mesa si aplica
      if (tableId) {
        await tableService.updateTableStatus(
          tableId,
          TableStatusEnum.ISAVAILABLE,
          null,
        );
      }

      // 5. Encolar impresion de recibo (fire-and-forget)
      const printPayments = validEntries.map((entry) => {
        const config = getConfig(entry.method);
        const parsedAmount = parseFloat(entry.amount);
        const amountUsd =
          config.amountCurrency === 'BS' && bcvRate > 0
            ? bsToUsd(parsedAmount, bcvRate)
            : parsedAmount;
        return {
          method: entry.method,
          amount: Math.round(amountUsd * 100) / 100,
        };
      });
      printQueueService
        .enqueuePrintReceipt(order, printPayments)
        .catch((err) => {
          console.error('Error encolando impresion:', err);
        });

      // Log evento en sesion de caja
      if (user) {
        cashRegisterService
          .getActiveSession(user.uid)
          .then((session) => {
            if (session) {
              cashRegisterService
                .logEvent(session.id, {
                  type: 'payment_processed',
                  description: `Cobro #${order.id.slice(-6).toUpperCase()} — $${order.total.toFixed(2)}`,
                  orderId: order.id,
                  amount: order.total,
                })
                .catch(() => {});
              if (tableId) {
                cashRegisterService
                  .logEvent(session.id, {
                    type: 'table_freed',
                    description: `Mesa ${order.tableName ?? tableId} liberada`,
                    orderId: order.id,
                  })
                  .catch(() => {});
              }
            }
          })
          .catch(() => {});
      }

      showAlert(
        'Cobro Exitoso',
        `Orden #${order.id.slice(-6).toUpperCase()} cobrada correctamente.${changeUsd > 0.01 ? `\nCambio: $${changeUsd.toFixed(2)}` : ''}`,
        [{ text: 'OK', onPress: () => navigation.navigate('CashierTabs') }],
      );
    } catch (error) {
      console.error('Error procesando cobro:', error);
      showAlert('Error', 'No se pudo procesar el cobro. Intenta de nuevo.');
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Resumen del pedido */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
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
            {order.sector && (
              <View style={styles.tableBadge}>
                <Ionicons name="map-outline" size={13} color={COLORS.primary} />
                <Text style={styles.tableText}>
                  {order.sector.charAt(0).toUpperCase() + order.sector.slice(1)}
                </Text>
              </View>
            )}
          </View>

          {order.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemQty}>
                  {packCountLabel(
                    item.quantity,
                    item.productId,
                    item.presentationQty,
                  )}
                  x
                </Text>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.productName}
                </Text>
              </View>
              <Text style={styles.itemPrice}>
                ${item.totalPrice.toFixed(2)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          {(order.serviceCharge ?? 0) > 0 && (
            <>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Subtotal</Text>
                <Text style={styles.subtotalValue}>
                  ${order.subtotal.toFixed(2)}
                </Text>
              </View>
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
            </>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${order.total.toFixed(2)}</Text>
          </View>
          {bcvRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.bsLabel}>Total en Bs</Text>
              <Text style={styles.bsValue}>
                Bs. {usdToBs(order.total, bcvRate).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Pre-llenado del mesonero */}
        {order.pendingPayments && order.pendingPayments.length > 0 && (
          <View style={styles.prefilledBanner}>
            <Ionicons name="information-circle" size={18} color={COLORS.info} />
            <Text style={styles.prefilledText}>
              Pagos registrados por mesonero (puedes editar los montos)
            </Text>
          </View>
        )}

        {/* Pagos agregados */}
        {paymentEntries.map((entry) => {
          const config = getConfig(entry.method);
          return (
            <View key={entry.id} style={styles.section}>
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
                    ? `= $${(parseFloat(entry.amount || '0') / bcvRate).toFixed(2)} USD`
                    : `= Bs. ${usdToBs(parseFloat(entry.amount || '0'), bcvRate).toFixed(2)}`}
                </Text>
              )}

              {(entry.method === PaymentMethodEnum.PAGO_MOVIL ||
                entry.method === PaymentMethodEnum.CARD ||
                entry.method === PaymentMethodEnum.TRANSFER) && (
                <>
                  <Text style={styles.fieldLabel}>Referencia</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={entry.reference}
                    onChangeText={(text) =>
                      updateField(entry.id, 'reference', text)
                    }
                    placeholder="Numero de referencia"
                    placeholderTextColor={COLORS.textLight}
                    autoCapitalize="characters"
                  />
                </>
              )}
            </View>
          );
        })}

        {/* Boton agregar metodo de pago */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.addPaymentBtn}
            onPress={() => setShowMethods(!showMethods)}
            activeOpacity={0.8}
          >
            <View style={styles.addPaymentIcon}>
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.addPaymentText}>Agregar Metodo de Pago</Text>
            <Ionicons
              name={showMethods ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          {showMethods && (
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
                  <Ionicons name="add" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Resumen del cobro */}
        {paymentEntries.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons
                name="calculator-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>Resumen del Cobro</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total pagado</Text>
              <Text style={styles.summaryValueGreen}>
                ${totalPaidUsd.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total orden</Text>
              <Text style={styles.summaryValue}>${order.total.toFixed(2)}</Text>
            </View>

            <View style={styles.divider} />

            {remainingUsd > 0.01 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.remainingLabel}>Falta</Text>
                <Text style={styles.remainingValue}>
                  ${remainingUsd.toFixed(2)}
                  {bcvRate > 0
                    ? ` (Bs. ${usdToBs(remainingUsd, bcvRate).toFixed(2)})`
                    : ''}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.completeLabel}>Estado</Text>
                  <Text style={styles.completeValue}>Completo</Text>
                </View>
                {changeUsd > 0.01 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.changeLabel}>Cambio</Text>
                    <Text style={styles.changeValue}>
                      ${changeUsd.toFixed(2)}
                      {bcvRate > 0
                        ? ` (Bs. ${usdToBs(changeUsd, bcvRate).toFixed(2)})`
                        : ''}
                    </Text>
                  </View>
                )}
              </>
            )}

            {bcvRate > 0 && (
              <Text style={styles.rateText}>
                Tasa BCV: {bcvRate.toFixed(2)} Bs/$
              </Text>
            )}
          </View>
        )}

        {/* Boton dejar pendiente (a crédito): oculto mientras CREDITO_HABILITADO sea false */}
        {CREDITO_HABILITADO && (
          <TouchableOpacity
            style={styles.pendingBtn}
            onPress={handlePendingPayment}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={20} color={COLORS.warning} />
            <Text style={styles.pendingBtnText}>Dejar Pendiente (Crédito)</Text>
          </TouchableOpacity>
        )}

        {/* Boton procesar */}
        {paymentEntries.length > 0 && (
          <View
            style={[
              styles.processWrapper,
              !isPaymentComplete && styles.processWrapperDisabled,
            ]}
          >
            <TouchableOpacity
              onPress={handleProcessPayment}
              disabled={!isPaymentComplete || isProcessing}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={
                  isPaymentComplete
                    ? [COLORS.success, COLORS.successLight]
                    : [COLORS.textLight, COLORS.textLight]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.processBtn}
              >
                {isProcessing ? (
                  <>
                    <ActivityIndicator size="small" color={COLORS.background} />
                    <Text style={styles.processBtnText}>Procesando...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={COLORS.background}
                    />
                    <Text style={styles.processBtnText}>
                      {isPaymentComplete
                        ? 'Procesar Cobro'
                        : 'Falta completar el pago'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl * 2 },
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

  prefilledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: `${COLORS.info}15`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: `${COLORS.info}30`,
  },
  prefilledText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.info,
    fontWeight: FONT_WEIGHT.medium,
  },

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

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  summaryValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.text,
  },
  summaryValueGreen: {
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
  completeLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.success,
  },
  completeValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.success,
  },
  changeLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  changeValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  rateText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.sm,
    textAlign: 'right',
  },

  pendingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.warning,
    borderStyle: 'dashed',
  },
  pendingBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.warning,
  },

  processWrapper: {
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.lg,
  },
  processWrapperDisabled: { opacity: 0.6, shadowOpacity: 0, elevation: 0 },
  processBtn: {
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  processBtnText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.background,
  },
});
