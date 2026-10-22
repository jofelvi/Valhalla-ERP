'use client';
import { Payment } from '@/modelTypes/payment';
import { Order } from '@/modelTypes/order';
import { PaymentMethodEnum } from '@/shared';
import { aFecha } from '@/shared/utils/dateHelpers';
import { usdToBs } from '@/shared/utils/currencyHelpers';
import { useNegocio, useNombreApp, useTarifas } from '@/shared/config';
import { NOMINA_DEFAULT } from '@odin6/types';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import {
  etiquetaImpuesto,
  etiquetaServicio,
} from '@/features/pos/utils/etiquetasDeCobro';
import {
  bancoPagoMovil,
  payloadPagoMovil,
  titularPagoMovil,
  urlQrPagoMovil,
} from '@/features/pos/utils/pagoMovil';
import { calcularTotalesOrden } from '@/features/pos/services/totalesOrden';

interface ReceiptProps {
  order: Order;
  payments: Payment[];
  waiterName?: string;
  tipAmount?: number;
  customerName?: string;
  customerRif?: string;
}

export default function Receipt({
  order,
  payments,
  waiterName,
  tipAmount,
  customerName,
  customerRif,
}: ReceiptProps) {
  const negocio = useNegocio();
  const tarifas = useTarifas();
  const nombre = useNombreApp();
  const servicioEtiqueta = etiquetaServicio(tarifas);
  const impuestoEtiqueta = etiquetaImpuesto(tarifas);
  // Con servicio incluido el monto no se suma: se informa cuánto trae el precio.
  const servicioIncluido =
    tarifas.serviceMode === 'included'
      ? calcularTotalesOrden({
          items: order.items ?? [],
          tieneMesonero: !!order.waiterId,
          tarifas,
          nomina: NOMINA_DEFAULT,
        }).servicioIncluido
      : 0;
  const pm = negocio.mobilePayment;
  const titular = titularPagoMovil(negocio);

  const paymentMethodNames: Record<PaymentMethodEnum, string> = {
    [PaymentMethodEnum.CASH_BS]: 'Efectivo Bs',
    [PaymentMethodEnum.CASH_USD]: 'Efectivo USD',
    [PaymentMethodEnum.CARD]: 'Tarjeta Débito/Crédito',
    [PaymentMethodEnum.TRANSFER]: 'Transferencia Bancaria',
    [PaymentMethodEnum.PAGO_MOVIL]: 'Pago Móvil',
    [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: 'Pago Móvil Manual',
    [PaymentMethodEnum.MIXED]: 'Pago Mixto',
    [PaymentMethodEnum.PENDING]: 'Pago Pendiente',
    [PaymentMethodEnum.PAYROLL_DEDUCTION]: 'Deducción nómina',
  };

  // Usar la fecha de creacion de la orden, no la fecha actual
  const orderDate = aFecha(order.createdAt);

  return (
    <div className="receipt-print bg-white p-8 rounded-xl shadow-lg border border-line print:p-2 print:shadow-none print:border-0 print:rounded-none max-w-3xl mx-auto print:max-w-[58mm] print:text-xs">
      {/* Header - Logo y Nombre de Empresa */}
      <div className="text-center mb-4 pb-3 border-b-2 border-dashed border-line print:mb-2 print:pb-2">
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-content tracking-wide print:text-xl">
            {nombre}
          </h1>
          {negocio.tagline && (
            <p className="text-xs text-dim mt-1 font-medium print:text-[10px]">
              {negocio.tagline}
            </p>
          )}
        </div>
        <div className="space-y-0.5 text-xs text-dim print:text-[9px] print:leading-tight">
          {negocio.address && <p>{negocio.address}</p>}
          {negocio.phone && <p>Tel: {negocio.phone}</p>}
          {negocio.taxId && <p>RIF: {negocio.taxId}</p>}
        </div>
      </div>

      {/* Información de la Orden */}
      <div className="mb-3 text-xs print:mb-2 print:text-[10px]">
        <div className="space-y-1">
          <FilaDeResumen
            etiqueta="Orden:"
            classNameEtiqueta="font-medium"
            valor={<>#{order.id.slice(-8).toUpperCase()}</>}
            classNameValor="font-bold"
          />
          <FilaDeResumen
            etiqueta="Fecha:"
            classNameEtiqueta="font-medium"
            valor={orderDate.toLocaleDateString('es-VE')}
          />
          <FilaDeResumen
            etiqueta="Hora:"
            classNameEtiqueta="font-medium"
            valor={
              <>
                {orderDate.toLocaleTimeString('es-VE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </>
            }
          />
          {(order.tableName || order.tableId) && (
            <div className="flex justify-between">
              <span className="font-medium">Mesa:</span>
              {/* El nombre, no el id: el cliente no tiene por que ver
                  "270TlCbjjDkXtjgcCdHD" en su factura. */}
              <span className="font-bold">
                {order.tableName || order.tableId}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Información del Cliente */}
      {(customerName || customerRif) && (
        <>
          <div className="border-b-2 border-dashed border-line my-3 print:my-2"></div>
          <div className="mb-3 text-xs print:mb-2 print:text-[10px]">
            <div className="font-bold mb-1 print:text-[10px]">
              DATOS DEL CLIENTE:
            </div>
            <div className="space-y-1">
              {customerName && (
                <FilaDeResumen
                  etiqueta="Nombre/Razón Social:"
                  classNameEtiqueta="font-medium"
                  valor={customerName}
                  classNameValor="font-semibold text-right flex-1 ml-4 truncate"
                />
              )}
              {customerRif && (
                <FilaDeResumen
                  etiqueta="CI/RIF:"
                  classNameEtiqueta="font-medium"
                  valor={customerRif}
                  classNameValor="font-semibold text-right flex-1 ml-4"
                />
              )}
            </div>
          </div>
        </>
      )}

      <div className="border-b-2 border-dashed border-line my-3 print:my-2"></div>

      {/* Detalle de Productos */}
      <div className="mb-3 print:mb-2">
        <div className="text-xs font-bold mb-2 print:text-[10px]">
          PRODUCTOS:
        </div>
        <div className="space-y-1">
          {(order.items ?? []).map((item, index) => {
            const itemTotal = item.total ?? 0;
            const qty = item.quantity ?? 1;
            return (
              <div key={index} className="text-xs print:text-[10px]">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {qty} x {item.name ?? '-'}
                  </span>
                  <span className="font-bold">${itemTotal.toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-dim print:text-[9px] ml-4">
                  @ ${qty > 0 ? (itemTotal / qty).toFixed(2) : '0.00'} c/u
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-b-2 border-dashed border-line my-3 print:my-2"></div>

      {/* Totales */}
      <div className="mb-3 text-xs print:mb-2 print:text-[10px]">
        <div className="space-y-1">
          <FilaDeResumen
            etiqueta="Subtotal:"
            valor={<>${(order.subtotal ?? 0).toFixed(2)}</>}
            classNameValor="font-semibold"
          />
          {servicioEtiqueta &&
            tarifas.serviceMode === 'additional' &&
            (order.serviceCharge ?? 0) > 0 && (
              <FilaDeResumen
                etiqueta={`${servicioEtiqueta}:`}
                valor={<>${(order.serviceCharge ?? 0).toFixed(2)}</>}
                classNameValor="font-semibold"
              />
            )}
          {servicioEtiqueta &&
            tarifas.serviceMode === 'included' &&
            servicioIncluido > 0 && (
              <FilaDeResumen
                etiqueta={`${servicioEtiqueta}:`}
                valor={<>${servicioIncluido.toFixed(2)}</>}
                classNameValor="font-semibold"
              />
            )}
          {impuestoEtiqueta && (order.tax ?? 0) > 0 && (
            <FilaDeResumen
              etiqueta={`${impuestoEtiqueta}:`}
              valor={<>${(order.tax ?? 0).toFixed(2)}</>}
              classNameValor="font-semibold"
            />
          )}
          {(tipAmount ?? 0) > 0 && (
            <FilaDeResumen
              etiqueta="Propina:"
              valor={<>${(tipAmount ?? 0).toFixed(2)}</>}
              classNameValor="font-semibold"
            />
          )}
          <div className="border-t-2 border-line pt-1 mt-1"></div>
          <div className="flex justify-between text-base font-bold print:text-xs">
            <span>TOTAL:</span>
            <span>
              $
              {((tipAmount ?? 0) > 0
                ? (order.total ?? 0) + (tipAmount ?? 0)
                : (order.total ?? 0)
              ).toFixed(2)}{' '}
              USD
            </span>
          </div>
        </div>
      </div>

      <div className="border-b-2 border-dashed border-line my-3 print:my-2"></div>

      {/* Detalle de Pagos (agrupados por metodo) */}
      {payments.length > 0 && (
        <div className="mb-3 text-xs print:mb-2 print:text-[10px]">
          <div className="font-bold mb-1">PAGOS:</div>
          <div className="space-y-1">
            {payments.map((payment, index) => {
              const isBsMethod =
                payment.method === PaymentMethodEnum.CASH_BS ||
                payment.method === PaymentMethodEnum.CARD;
              const label =
                paymentMethodNames[payment.method] || payment.method;
              if (isBsMethod) {
                const amountBs =
                  payment.expectedAmountBS ??
                  (payment.bcvRate
                    ? usdToBs(payment.amount, payment.bcvRate)
                    : payment.amount);
                return (
                  <div key={index} className="flex justify-between">
                    <span>{label}</span>
                    <span className="font-semibold">
                      Bs. {amountBs.toFixed(2)}
                    </span>
                  </div>
                );
              }
              return (
                <div key={index} className="flex justify-between">
                  <span>{label}</span>
                  <span className="font-semibold">
                    ${payment.amount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-b-2 border-dashed border-line my-3 print:my-2"></div>

      {/* Pago Movil: solo si el negocio lo configuró */}
      {pm && (
        <>
          <div className="mb-3 print:mb-2">
            <div className="text-xs font-bold mb-2 print:text-[10px] text-center">
              PAGO MOVIL:
            </div>
            <div className="text-center mb-2">
              <img
                src={urlQrPagoMovil(payloadPagoMovil(pm, titular))}
                alt="QR Pago Movil"
                className="mx-auto w-36 h-36 print:w-28 print:h-28"
              />
            </div>
            <div className="space-y-0.5 text-xs text-center print:text-[9px]">
              <p className="font-semibold">{bancoPagoMovil(pm)}</p>
              <p>
                Telefono: <span className="font-bold">{pm.phone}</span>
              </p>
              <p>
                Cedula: <span className="font-bold">{pm.documentId}</span>
              </p>
            </div>
          </div>

          <div className="border-b-2 border-dashed border-line my-3 print:my-2"></div>
        </>
      )}

      {/* Mensaje de Agradecimiento */}
      <div className="text-center my-3 print:my-2">
        <p className="text-sm font-bold print:text-[11px]">
          {negocio.receiptFooter}
        </p>
        <p className="text-xs print:text-[10px] mt-1">
          Vuelva pronto a {nombre}
        </p>
      </div>

      {/* Mesonero */}
      {waiterName && (
        <>
          <div className="border-b-2 border-dashed border-line my-3 print:my-2"></div>
          <div className="text-center text-xs print:text-[10px] text-dim">
            <span className="font-medium">Atendido por: </span>
            <span className="font-bold">{waiterName}</span>
          </div>
        </>
      )}

      <div className="border-b-2 border-dashed border-line my-3 print:my-2"></div>

      {/* Footer */}
      <div className="text-center text-[10px] text-dim print:text-[9px]">
        <p>
          {orderDate.toLocaleDateString('es-VE')}{' '}
          {orderDate.toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className="mt-2">
          <span className="font-bold">{nombre}</span> POS
        </p>
        {negocio.website && (
          <p className="text-[9px] print:text-[8px]">{negocio.website}</p>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
          }

          body {
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Ocultar todo excepto el recibo */
          .no-print,
          button,
          nav,
          header,
          footer,
          aside,
          .print\\:hidden {
            display: none !important;
          }

          /* Mostrar solo el recibo */
          .receipt-print {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: -5px !important;
            width: 58mm !important;
            max-width: 58mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            z-index: 9999 !important;
          }

          /* Eliminar fondos decorativos */
          .receipt-print,
          .receipt-print * {
            background: white !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          /* Bordes en negro para impresion termica */
          .receipt-print .border-dashed {
            border-color: #000 !important;
          }

          /* Todo el texto en negro */
          .receipt-print,
          .receipt-print * {
            color: #000 !important;
          }

          /* Aplicar tamanos de fuente de impresion */
          .receipt-print {
            font-size: 10px !important;
            line-height: 1.4 !important;
          }
        }
      `}</style>
    </div>
  );
}
