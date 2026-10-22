'use client';
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/shared/button/Button';
import AttendanceReportDashboard from '@/features/reports/AttendanceReportDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Banknote,
  BarChart3Icon,
  Calendar,
  CreditCard,
  DollarSignIcon,
  DownloadIcon,
  PieChart,
  Smartphone,
  TrendingUpIcon,
  PackageCheck,
  Wallet,
} from 'lucide-react';
import Loader from '@/components/shared/Loader/Loader';
import { useOrders, useProducts } from '@/hooks';
import { DateFilterEnum, PaymentMethodEnum } from '@/shared';
import {
  aFecha,
  getDateRange,
  getStartOfDay,
  getEndOfDay,
  rangoParaElServidor,
} from '@/shared/utils/dateHelpers';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { Panel } from '@/components/shared/panel/Panel';
import {
  IconoEnCuadro,
  TituloDePantalla,
} from '@/components/shared/cabecera/CabeceraDePantalla';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';

export default function ReportsPage() {
  // Filtros
  const [dateFilter, setDateFilter] = useState<DateFilterEnum>(
    DateFilterEnum.THIS_MONTH,
  );
  const [customDate, setCustomDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );

  // El rango va al SERVIDOR. Antes esta pantalla se bajaba TODAS las ordenes y
  // recortaba por fecha en el navegador; con el tope de 500 del endpoint eso
  // dejaria un reporte de un mes viejo incompleto o en cero, sin un solo error.
  // Ver `rangoParaElServidor`.
  const rango = useMemo(
    () => rangoParaElServidor(dateFilter, customDate),
    [dateFilter, customDate],
  );
  const { data: orders = [], isLoading: ordersLoading } = useOrders({
    ...rango,
    limit: '2000',
  });
  const { data: products = [], isLoading: productsLoading } = useProducts();

  const isLoading = ordersLoading || productsLoading;

  // Filtrado de ordenes por fecha y status = PAID (o parcial?)
  const filteredOrders = useMemo(() => {
    let startDate: Date;
    let endDate: Date;

    if (dateFilter === DateFilterEnum.CUSTOM) {
      const selectedDate = new Date(customDate + 'T00:00:00');
      startDate = getStartOfDay(selectedDate);
      endDate = getEndOfDay(selectedDate);
    } else {
      const range = getDateRange(dateFilter);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    return orders.filter((o) => {
      if (!o.createdAt) return false;
      const date = aFecha(o.createdAt);
      // Validar que la orden esté pagada al menos parcial o totalmente.
      // NOTA (F0a): PaymentStatusEnum es minúscula ('paid'/'partial'); esta
      // comparación es contra mayúsculas. Se conserva el comportamiento EXACTO
      // de hoy con String() (no se decide aquí si el dato real es mayúscula o
      // minúscula); pendiente de corroborar en F2/Dinero.
      const status = String(o.paymentStatus);
      const isPaid = status === 'PAID' || status === 'PARTIAL';
      return isPaid && date >= startDate && date <= endDate;
    });
  }, [orders, dateFilter, customDate]);

  // Calculos Financieros a tiempo real
  const financialMetrics = useMemo(() => {
    let netRevenue = 0; // Ventas puras
    let totalTips = 0; // Propinas
    let totalDiscounts = 0;

    // Aggregates for Payment Methods
    const paymentBreakdown: Record<string, number> = {
      [PaymentMethodEnum.CASH_USD]: 0,
      [PaymentMethodEnum.CASH_BS]: 0,
      [PaymentMethodEnum.PAGO_MOVIL]: 0,
      [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: 0,
      [PaymentMethodEnum.TRANSFER]: 0,
      [PaymentMethodEnum.CARD]: 0,
      [PaymentMethodEnum.MIXED]: 0,
      UNKNOWN: 0,
    };

    filteredOrders.forEach((o) => {
      const subtotal = o.subtotal || 0;
      const tips = o.tipAmount ?? 0; // propinas opcionales
      const disc = o.discountAmount ?? 0;
      const orderNet = subtotal - disc; // ingresos reales por productos

      netRevenue += orderNet;
      totalTips += tips;
      totalDiscounts += disc;

      // TODO: Las ordenes PaymentMethod MIXED deberian desglosar sus pagos individuales,
      // pero usaremos el total como aproximacion rapida
      const method = o.paymentMethod || 'UNKNOWN';
      if (paymentBreakdown[method] !== undefined) {
        paymentBreakdown[method] += orderNet + tips; // El cliente pagó net+tips usando este metodo
      } else {
        paymentBreakdown['UNKNOWN'] += orderNet + tips;
      }
    });

    return {
      netRevenue,
      totalTips,
      totalDiscounts,
      averageTicket:
        filteredOrders.length > 0 ? netRevenue / filteredOrders.length : 0,
      orderCount: filteredOrders.length,
      paymentBreakdown,
    };
  }, [filteredOrders]);

  // Calcular Inventario Real
  const inventoryMetrics = useMemo(() => {
    let internalCostValue = 0;
    let potentialSalesValue = 0;

    products.forEach((p) => {
      // asumimos product.cost existe iterativamente o fallback 0
      const cost = p.cost || 0;
      const price = p.price || 0;
      const stock = p.stock || 0;

      if (stock > 0) {
        internalCostValue += cost * stock;
        potentialSalesValue += price * stock;
      }
    });

    return {
      internalCostValue,
      potentialSalesValue,
      totalItems: products.reduce((acc, p) => acc + (p.stock || 0), 0),
    };
  }, [products]);

  const paymentIconMap: Record<string, React.ReactNode> = {
    [PaymentMethodEnum.CASH_USD]: (
      <DollarSignIcon className="w-5 h-5 text-ok" />
    ),
    [PaymentMethodEnum.CASH_BS]: <Banknote className="w-5 h-5 text-accent" />,
    [PaymentMethodEnum.PAGO_MOVIL]: (
      <Smartphone className="w-5 h-5 text-brand" />
    ),
    [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: (
      <Smartphone className="w-5 h-5 text-brand/80" />
    ),
    [PaymentMethodEnum.CARD]: <CreditCard className="w-5 h-5 text-blue-500" />,
    [PaymentMethodEnum.TRANSFER]: (
      <Wallet className="w-5 h-5 text-indigo-500" />
    ),
    [PaymentMethodEnum.MIXED]: <PieChart className="w-5 h-5 text-brand" />,
  };

  const paymentNameMap: Record<string, string> = {
    [PaymentMethodEnum.CASH_USD]: 'Efectivo USD',
    [PaymentMethodEnum.CASH_BS]: 'Efectivo Bs',
    [PaymentMethodEnum.PAGO_MOVIL]: 'Pago Móvil (Auto)',
    [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: 'Pago Móvil (Manual)',
    [PaymentMethodEnum.CARD]: 'Punto de Venta',
    [PaymentMethodEnum.TRANSFER]: 'Transferencia',
    [PaymentMethodEnum.MIXED]: 'Pago Mixto',
    UNKNOWN: 'Sin Definir',
  };

  if (isLoading) {
    return <Loader fullScreen text="Cargando data financiera..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header Card */}
        <Panel className="p-3.5 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconoEnCuadro>
              <BarChart3Icon className="h-5 w-5 text-brand" />
            </IconoEnCuadro>
            <TituloDePantalla
              titulo="Reportes"
              subtitulo="Análisis financiero y métricas en tiempo real"
            />
          </div>

          {/* Generador y Filtros */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-elevated/50 px-3 py-1.5 rounded-lg border border-line text-sm">
              <Calendar className="w-4 h-4 text-brand" />
              <select
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(e.target.value as DateFilterEnum)
                }
                className="bg-transparent text-sm text-content font-medium focus:outline-none"
              >
                <option value={DateFilterEnum.TODAY}>Hoy</option>
                <option value={DateFilterEnum.YESTERDAY}>Ayer</option>
                <option value={DateFilterEnum.THIS_WEEK}>Esta Semana</option>
                <option value={DateFilterEnum.LAST_WEEK}>Semana Pasada</option>
                <option value={DateFilterEnum.THIS_MONTH}>Este Mes</option>
                <option value={DateFilterEnum.LAST_MONTH}>Mes Anterior</option>
                <option value={DateFilterEnum.CUSTOM}>Fecha Específica</option>
              </select>
              {dateFilter === DateFilterEnum.CUSTOM && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="bg-surface border border-line text-xs rounded px-2 py-1 text-content outline-none"
                />
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-brand/50 text-brand"
            >
              <DownloadIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
          </div>
        </Panel>

        <Tabs defaultValue="overview" className="space-y-3">
          <TabsList className="bg-elevated border border-line p-1 pb-1 w-full max-w-sm grid grid-cols-2 rounded-xl">
            <TabsTrigger
              value="overview"
              className="rounded-lg text-dim hover:text-content data-[state=active]:bg-surface data-[state=active]:text-brand data-[state=active]:shadow-sm transition-colors"
            >
              Financiero
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="rounded-lg text-dim hover:text-content data-[state=active]:bg-surface data-[state=active]:text-brand data-[state=active]:shadow-sm transition-colors"
            >
              Asistencia (RRHH)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3">
            {/* Quick Stats Financieros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              <Card className="bg-surface/80 border-line shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-brand mb-1">
                        Ingresos Netos (Ventas)
                      </p>
                      <p
                        className="text-lg sm:text-xl font-bold text-brand truncate"
                        title={formatearUsdConMiles(
                          financialMetrics.netRevenue,
                        )}
                      >
                        {formatearUsdConMiles(financialMetrics.netRevenue)}
                      </p>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-brand/20 flex items-center justify-center shrink-0">
                      <BarChart3Icon className="h-4 w-4 text-brand" />
                    </div>
                  </div>
                  <p className="text-xs text-dim mt-2">Descuenta cortesías</p>
                </CardContent>
              </Card>

              <Card className="bg-surface/80 border-line shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-ok mb-1">
                        Propinas Recaudadas
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-ok truncate">
                        {formatearUsdConMiles(financialMetrics.totalTips)}
                      </p>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-ok/20 flex items-center justify-center shrink-0">
                      <DollarSignIcon className="h-4 w-4 text-ok" />
                    </div>
                  </div>
                  <p className="text-xs text-dim mt-2">No son del local</p>
                </CardContent>
              </Card>

              <Card className="bg-surface/80 border-line shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-accent mb-1">
                        Ticket Promedio
                      </p>
                      <p className="text-lg sm:text-xl font-bold text-accent truncate">
                        {formatearUsdConMiles(financialMetrics.averageTicket)}
                      </p>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                      <TrendingUpIcon className="h-4 w-4 text-accent" />
                    </div>
                  </div>
                  <p className="text-xs text-dim mt-2">
                    {financialMetrics.orderCount} órdenes
                  </p>
                </CardContent>
              </Card>

              {/* Inventory Valuation Card */}
              <Card className="bg-surface/80 border-line shadow-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-dim mb-1">
                        Valorización Inv.
                      </p>
                      <p
                        className="text-lg sm:text-xl font-bold text-content truncate"
                        title={formatearUsdConMiles(
                          inventoryMetrics.potentialSalesValue,
                        )}
                      >
                        {formatearUsdConMiles(
                          inventoryMetrics.potentialSalesValue,
                        )}
                      </p>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-elevated border border-line flex items-center justify-center shrink-0">
                      <PackageCheck className="h-4 w-4 text-dim" />
                    </div>
                  </div>
                  <p className="text-xs text-dim mt-2">
                    {new Intl.NumberFormat('es-VE').format(
                      inventoryMetrics.totalItems,
                    )}{' '}
                    unidades
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Payment Breakdown */}
              <Card className="bg-surface border-line shadow-sm">
                <CardHeader className="border-b border-line pb-3 bg-elevated/30 p-3.5">
                  <CardTitle className="text-base text-content font-bold flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-brand" />
                    Desglose de Caja
                  </CardTitle>
                </CardHeader>
                <CardContent className="block p-0">
                  <div className="w-full">
                    {Object.entries(financialMetrics.paymentBreakdown)
                      .filter(([_, amount]) => amount > 0)
                      .sort((a, b) => b[1] - a[1]) // highest first
                      .map(([method, amount], i) => (
                        <div
                          key={method}
                          className={`flex items-center justify-between p-3 ${i !== 0 && 'border-t border-line'} hover:bg-elevated/50 transition-colors`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-surface border border-line flex items-center justify-center">
                              {paymentIconMap[method] || (
                                <PieChart className="w-4 h-4 text-dim" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-content text-sm">
                                {paymentNameMap[method] || method}
                              </p>
                              <p className="text-xs text-dim font-medium uppercase">
                                Caja
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-brand bg-brand/10 px-2 py-1 rounded text-sm">
                              {formatearUsdConMiles(amount)}
                            </p>
                          </div>
                        </div>
                      ))}
                    {Object.values(financialMetrics.paymentBreakdown).every(
                      (amount) => amount === 0,
                    ) && (
                      <div className="p-6 text-center bg-elevated rounded-b-xl border-t border-line">
                        <Wallet className="w-10 h-10 text-line mx-auto mb-2" />
                        <p className="text-content font-semibold text-sm">
                          No hubieron ventas en el período
                        </p>
                        <p className="text-dim text-xs mt-1">
                          Selecciona otras fechas en el filtro superior.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Resume Text / Future expansion */}
              <Card className="bg-surface border-line shadow-sm flex flex-col items-center justify-center text-center p-6">
                <PieChart className="w-12 h-12 text-brand/20 mb-3" />
                <h3 className="text-base font-bold text-content mb-1">
                  Desglose Paramétrico
                </h3>
                <p className="text-dim text-xs max-w-[80%] mb-4">
                  Cálculos dinámicos de órdenes con estado pagado. Gráficas
                  visuales en V2.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <FilaDeResumen
                    className="bg-elevated px-3 py-2 rounded text-xs"
                    etiqueta="Órdenes:"
                    classNameEtiqueta="text-dim font-medium"
                    valor={financialMetrics.orderCount}
                    classNameValor="text-brand font-bold"
                  />
                  <FilaDeResumen
                    className="bg-danger/10 px-3 py-2 rounded text-xs text-danger"
                    etiqueta="Descuentos:"
                    classNameEtiqueta="font-medium"
                    valor={formatearUsdConMiles(
                      financialMetrics.totalDiscounts,
                    )}
                    classNameValor="font-bold"
                  />
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-3">
            <AttendanceReportDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
