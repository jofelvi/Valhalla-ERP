'use client';

export function PayrollTableHead() {
  return (
    <thead>
      <tr className="border-b border-line bg-elevated/50">
        <th className="px-4 py-3 text-left text-xs font-semibold text-dim uppercase tracking-wide">
          Empleado
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-dim uppercase tracking-wide">
          Dpto.
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-dim uppercase tracking-wide">
          Días y pago
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-dim uppercase tracking-wide">
          Comisión / Propina
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-dim uppercase tracking-wide">
          Consumos (descontar)
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-dim uppercase tracking-wide">
          Neto
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-dim uppercase tracking-wide">
          Comprobante
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold text-dim uppercase tracking-wide">
          Acción
        </th>
      </tr>
    </thead>
  );
}
