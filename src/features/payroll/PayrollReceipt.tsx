'use client';
import Modal from '@/components/shared/modal';
import Link from 'next/link';
import { Payroll } from '@odin6/types';
import { PRIVATE_ROUTES } from '@/shared';
import { useNombreApp } from '@/shared/config';
import { Receipt, XIcon, Printer, ExternalLink } from 'lucide-react';

export interface ReceiptLine {
  label: string;
  amount: number;
  sign: '+' | '-';
  /** Cuenta por cobrar que originó la línea: la hace clicable hacia su ficha. */
  accountReceivableId?: string;
}

// Construye las lineas del recibo a partir del pago guardado
export function buildReceiptLines(p: Payroll): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  if (p.daysWorked != null) {
    lines.push({
      label: `${p.daysWorked} día(s) × $${(p.dailyRate ?? 0).toFixed(2)}`,
      amount: p.salary?.baseSalary ?? 0,
      sign: '+',
    });
  } else if ((p.salary?.baseSalary ?? 0) > 0) {
    lines.push({
      label: 'Salario base',
      amount: p.salary.baseSalary,
      sign: '+',
    });
  }
  if ((p.salary?.commissions ?? 0) > 0) {
    lines.push({
      label: `Comisiones (${(p.paidOrderIds ?? []).length} orden(es))`,
      amount: p.salary.commissions,
      sign: '+',
    });
  }
  if ((p.tips ?? 0) > 0) {
    lines.push({ label: 'Propinas', amount: p.tips ?? 0, sign: '+' });
  }
  for (const a of p.adjustments ?? []) {
    const bs =
      a.currency === 'BS' ? ` (Bs ${a.amount.toLocaleString('es-VE')})` : '';
    lines.push({
      label: `${a.concept}${bs}`,
      amount: a.amountUsd,
      sign: a.type === 'ADDITION' ? '+' : '-',
    });
  }
  for (const d of p.expenseDeductions ?? []) {
    lines.push({
      label: d.description,
      amount: d.amount,
      sign: '-',
      accountReceivableId: d.accountReceivableId,
    });
  }
  return lines;
}

export function printReceipt(
  p: Payroll,
  nombre: string,
  nombreNegocio: string,
) {
  const lines = buildReceiptLines(p);
  const fecha = p.paymentDate ? new Date(p.paymentDate) : new Date(p.createdAt);
  const periodo = p.period
    ? `${new Date(p.period.startDate).toLocaleDateString('es-VE')} — ${new Date(p.period.endDate).toLocaleDateString('es-VE')}`
    : '—';
  const rows = lines
    .map(
      (l) =>
        `<tr><td>${l.label}</td><td style="text-align:right;color:${l.sign === '-' ? '#b91c1c' : '#111'}">${l.sign}$${l.amount.toFixed(2)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><head><title>Recibo de pago — ${nombre}</title>
    <style>
      body{font-family:Arial,sans-serif;max-width:480px;margin:24px auto;color:#111;font-size:14px}
      h1{font-size:18px;margin:0}h2{font-size:14px;font-weight:normal;color:#555;margin:4px 0 16px}
      table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #eee}
      .total td{font-weight:bold;border-top:2px solid #111;border-bottom:none;font-size:16px}
      .meta{color:#555;font-size:12px;margin-bottom:16px}
      .firma{margin-top:56px;display:flex;justify-content:space-between;gap:24px}
      .firma div{flex:1;border-top:1px solid #999;padding-top:6px;text-align:center;font-size:12px;color:#555}
    </style></head><body>
    <h1>${nombreNegocio} — Recibo de pago</h1>
    <h2>${nombre}</h2>
    <p class="meta">Fecha de pago: ${fecha.toLocaleDateString('es-VE')} · Semana: ${periodo}</p>
    <table>${rows}
      <tr class="total"><td>Neto pagado</td><td style="text-align:right">$${(p.netPay ?? 0).toFixed(2)}</td></tr>
    </table>
    <div class="firma"><div>Recibí conforme</div><div>Entregado por</div></div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`;
  const w = window.open('', '_blank', 'width=560,height=720');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

interface PayrollReceiptModalProps {
  payroll: Payroll;
  nombre: string;
  onClose: () => void;
}

export function PayrollReceiptModal({
  payroll,
  nombre,
  onClose,
}: PayrollReceiptModalProps) {
  const nombreNegocio = useNombreApp();
  if (typeof document === 'undefined') return null;
  const fecha = payroll.paymentDate
    ? new Date(payroll.paymentDate)
    : payroll.createdAt
      ? new Date(payroll.createdAt)
      : null;
  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/60"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl shadow-2xl w-full max-w-md border border-line max-h-[90vh] flex flex-col"
    >
      <div className="flex items-center justify-between p-5 border-b border-line">
        <h2 className="font-semibold text-content flex items-center gap-2">
          <Receipt className="h-4 w-4 text-accent" />
          Recibo de pago
        </h2>
        <button onClick={onClose} className="text-dim hover:text-content">
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="p-5 space-y-3 overflow-y-auto">
        <div>
          <p className="text-sm text-content font-medium">{nombre}</p>
          <p className="text-xs text-dim">
            Pagado:{' '}
            {fecha && !isNaN(fecha.getTime())
              ? fecha.toLocaleDateString('es-VE')
              : '—'}
            {payroll.period && (
              <>
                {' · '}Semana:{' '}
                {new Date(payroll.period.startDate).toLocaleDateString('es-VE')}{' '}
                — {new Date(payroll.period.endDate).toLocaleDateString('es-VE')}
              </>
            )}
          </p>
        </div>
        <div className="bg-elevated/50 rounded-xl p-3 space-y-1.5 text-sm">
          {buildReceiptLines(payroll).map((l, i) => {
            const amount = (
              <span
                className={`font-medium flex-shrink-0 ${
                  l.sign === '-' ? 'text-danger' : 'text-content'
                }`}
              >
                {l.sign}${l.amount.toFixed(2)}
              </span>
            );
            // Los descuentos de consumo llevan a la cuenta que los originó,
            // en otra pestaña para no perder la nómina que se está revisando.
            if (l.accountReceivableId) {
              return (
                <Link
                  key={i}
                  href={PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE_DETAILS(
                    l.accountReceivableId,
                  )}
                  target="_blank"
                  className="flex justify-between gap-2 rounded-lg -mx-1 px-1 py-0.5 hover:bg-elevated transition-colors group"
                  title="Ver la cuenta por cobrar"
                >
                  <span className="text-dim group-hover:text-accent inline-flex items-center gap-1 underline underline-offset-2 decoration-dotted">
                    {l.label}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </span>
                  {amount}
                </Link>
              );
            }
            return (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-dim">{l.label}</span>
                {amount}
              </div>
            );
          })}
          <div className="flex justify-between border-t border-line pt-1.5">
            <span className="font-semibold text-content">Neto pagado</span>
            <span className="font-bold text-content">
              ${(payroll.netPay ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
        {payroll.proofUrl && (
          <a
            href={payroll.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 underline underline-offset-2"
          >
            Ver comprobante adjunto
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="flex gap-3 p-5 border-t border-line">
        <button
          onClick={onClose}
          className="flex-1 px-3 py-2 rounded-xl border border-line text-sm font-medium text-content hover:bg-elevated transition-colors"
        >
          Cerrar
        </button>
        <button
          onClick={() => printReceipt(payroll, nombre, nombreNegocio)}
          className="flex-1 px-3 py-2 rounded-xl bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
      </div>
    </Modal>
  );
}
