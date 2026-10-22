import type { ReactNode } from 'react';
import { AlertCircle, DollarSign, TrendingUp, Edit3 } from 'lucide-react';
import { Card } from '@/components/shared/card/card';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import type { Order } from '@/modelTypes/order';
import { useTarifas } from '@/shared/config';
import { etiquetaServicio } from '@/features/pos/utils/etiquetasDeCobro';

interface TarjetaDeTotalesProps {
  order: Order | undefined;
  /** Hay un cliente seleccionado con cuentas por cobrar → botón de detalle. */
  hasSelectedCustomer: boolean;
  customerReceivablesCount: number;
  selectedReceivablesSize: number;
  onShowReceivablesDetail: () => void;

  previousPaymentsTotal: number;
  remainingToPay: number;
  remainingInBs: number;

  loadingRate: boolean;
  isUsingDefaultRate: boolean;
  bcvRate: number;
  onRefreshBcvRate: () => void;
  onEditRateStart: () => void;

  appliedMemberCredit: number;
  memberAssociateNumber?: string;
  totalWithTip: number;
  selectedReceivablesTotal: number;
  tipAmount: number;

  /** Bloque de QR de Pago Móvil (interactivo; se renderiza dentro de la tarjeta). */
  qrPanel: ReactNode;
  /** Control de propina (interactivo; se renderiza dentro de la tarjeta). */
  controlPropina: ReactNode;
}

/**
 * Tarjeta "Total a Pagar": muestra el total en USD y Bs, el control de tasa BCV,
 * el QR de Pago Móvil, la propina y los desgloses (servicio, crédito de socio,
 * cuentas por cobrar). Es PRESENTACIONAL: todos los cálculos llegan como props;
 * los hijos interactivos (QR y propina) entran como slots ya construidos.
 */
export function TarjetaDeTotales({
  order,
  hasSelectedCustomer,
  customerReceivablesCount,
  selectedReceivablesSize,
  onShowReceivablesDetail,
  previousPaymentsTotal,
  remainingToPay,
  remainingInBs,
  loadingRate,
  isUsingDefaultRate,
  bcvRate,
  onRefreshBcvRate,
  onEditRateStart,
  appliedMemberCredit,
  memberAssociateNumber,
  totalWithTip,
  selectedReceivablesTotal,
  tipAmount,
  qrPanel,
  controlPropina,
}: TarjetaDeTotalesProps) {
  const tarifas = useTarifas();
  const servicioEtiqueta = etiquetaServicio(tarifas);
  return (
    <Card className="p-3 bg-surface/95 backdrop-blur-sm border-line shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-dim">Total a Pagar</h2>
        {hasSelectedCustomer && customerReceivablesCount > 0 && (
          <button
            onClick={onShowReceivablesDetail}
            className="px-3 py-1 bg-accent/15 hover:bg-accent text-accent text-xs font-medium rounded-full transition-all flex items-center gap-1"
          >
            <AlertCircle className="h-3 w-3" />
            {selectedReceivablesSize > 0 ? (
              <span>{selectedReceivablesSize} cuenta(s)</span>
            ) : (
              <span>{customerReceivablesCount} pendiente(s)</span>
            )}
          </button>
        )}
      </div>

      {/* Total original cuando hay pagos previos */}
      {previousPaymentsTotal > 0 && order && (
        <div className="bg-elevated rounded-xl p-2 mb-2 border border-line">
          <FilaDeResumen
            className="text-xs text-dim"
            classNameValor="font-bold text-content"
            etiqueta="Total factura:"
            valor={<>${order.total.toFixed(2)}</>}
          />
          <FilaDeResumen
            className="text-xs text-ok"
            classNameValor="font-bold"
            etiqueta="Pagado:"
            valor={<>${previousPaymentsTotal.toFixed(2)}</>}
          />
          <FilaDeResumen
            className="text-xs text-danger border-t border-line pt-1 mt-1"
            classNameValor="font-bold"
            etiqueta="Pendiente:"
            valor={<>${remainingToPay.toFixed(2)}</>}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* Total USD */}
        <div className="bg-gradient-to-br from-brand/20 to-brand/10 border border-brand/30 rounded-xl p-2 shadow-md">
          <div className="text-xl font-bold text-brand flex items-center justify-center gap-1">
            <DollarSign className="h-4 w-4" />
            {remainingToPay.toFixed(2)}
          </div>
          <div className="text-[10px] font-medium text-brand text-center">
            {previousPaymentsTotal > 0 ? 'USD Restante' : 'USD'}
          </div>
        </div>
        {/* Total Bs */}
        <div className="bg-gradient-to-br from-ok/20 to-ok/10 border border-ok/30 rounded-xl p-2 shadow-md">
          <div className="text-lg font-bold text-ok flex items-center justify-center gap-1">
            <TrendingUp className="h-4 w-4" />
            {remainingInBs.toFixed(2)}
          </div>
          <div className="text-[10px] text-ok text-center flex items-center justify-center gap-1">
            {loadingRate ? (
              'Cargando...'
            ) : (
              <>
                <span className={isUsingDefaultRate ? 'text-accent' : ''}>
                  BCV: {bcvRate.toFixed(2)}
                </span>
                <button
                  onClick={onRefreshBcvRate}
                  disabled={loadingRate}
                  className="p-0.5 hover:bg-ok/30 rounded disabled:opacity-50 transition-colors"
                  title="Actualizar"
                >
                  <TrendingUp
                    className={`w-3 h-3 ${loadingRate ? 'animate-spin' : ''}`}
                  />
                </button>
                {(isUsingDefaultRate || bcvRate <= 50) && (
                  <button
                    onClick={onEditRateStart}
                    className="p-0.5 hover:bg-ok/30 rounded transition-colors"
                    title="Editar"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* QR de cobro Pago Móvil (mostrar/ocultar) */}
      {qrPanel}

      {/* Propina inline */}
      {controlPropina}

      {/* Desglose servicio */}
      {order && (order.serviceCharge || 0) > 0 && (
        <div className="mb-1.5 p-1.5 bg-ok/15 rounded-lg border border-ok/20">
          <div className="space-y-0.5 text-xs">
            <FilaDeResumen
              className="text-dim"
              etiqueta="Subtotal:"
              valor={<>${order.subtotal.toFixed(2)}</>}
            />
            {(order.discountAmount || 0) > 0 && (
              <FilaDeResumen
                className="text-ok"
                etiqueta="Descuentos:"
                valor={<>-${(order.discountAmount || 0).toFixed(2)}</>}
              />
            )}
            <FilaDeResumen
              className="text-ok font-semibold"
              etiqueta={`${servicioEtiqueta ?? 'Servicio'}:`}
              valor={<>${(order.serviceCharge || 0).toFixed(2)}</>}
            />
            {(order.noChargeAmount || 0) > 0 && (
              <FilaDeResumen
                className="text-brand"
                etiqueta="Cortesías:"
                valor={<>-${(order.noChargeAmount || 0).toFixed(2)}</>}
              />
            )}
          </div>
        </div>
      )}

      {/* Desglose crédito socio */}
      {appliedMemberCredit > 0 && (
        <div className="mb-1.5 p-1.5 bg-accent/15 rounded-lg border border-accent/20">
          <div className="space-y-0.5 text-xs">
            <FilaDeResumen
              className="text-dim"
              etiqueta="Total orden:"
              valor={<>${(totalWithTip + appliedMemberCredit).toFixed(2)}</>}
            />
            <FilaDeResumen
              className="text-accent font-semibold"
              etiqueta={<>Crédito socio #{memberAssociateNumber}:</>}
              valor={<>-${appliedMemberCredit.toFixed(2)}</>}
            />
          </div>
        </div>
      )}

      {/* Desglose cuentas seleccionadas */}
      {selectedReceivablesSize > 0 && (
        <div className="mb-1.5 p-1.5 bg-accent/15 rounded-lg border border-accent/20">
          <div className="space-y-0.5 text-xs">
            <FilaDeResumen
              className="text-dim"
              etiqueta="Orden:"
              valor={<>${order?.total.toFixed(2)}</>}
            />
            {tipAmount > 0 && (
              <FilaDeResumen
                className="text-dim"
                etiqueta="Propina:"
                valor={<>${tipAmount.toFixed(2)}</>}
              />
            )}
            <FilaDeResumen
              className="text-accent font-semibold"
              etiqueta={<>+{selectedReceivablesSize} cuenta(s):</>}
              valor={<>${selectedReceivablesTotal.toFixed(2)}</>}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
