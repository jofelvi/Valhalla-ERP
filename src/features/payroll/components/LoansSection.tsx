'use client';

interface EmployeeLoans {
  id: string;
  concept: string;
  amount: number;
  paidAmount?: number;
  createdAt: string | Date;
}

interface LoansSectionProps {
  pendingLoans: EmployeeLoans[];
  loanAbonoMap: Map<string, number>;
  onLoanAbonChange: (loanId: string, amount: number) => void;
  bcvRate: number;
  formatUSD: (n: number) => string;
  formatBs: (n: number, rate: number) => string;
}

export function LoansSection({
  pendingLoans,
  loanAbonoMap,
  onLoanAbonChange,
  bcvRate,
  formatUSD,
  formatBs,
}: LoansSectionProps) {
  if (pendingLoans.length === 0) {
    return null;
  }

  return (
    <div className="bg-elevated/30 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-content">
        Préstamos pendientes ({pendingLoans.length})
      </p>
      {pendingLoans.map((loan) => {
        const saldo = loan.amount - (loan.paidAmount ?? 0);
        const isSelected = loanAbonoMap.has(loan.id);
        const abonoAmount = loanAbonoMap.get(loan.id) ?? 0;

        return (
          <div
            key={loan.id}
            className="space-y-1.5 rounded-lg border border-line/40 p-2.5"
          >
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    if (isSelected) {
                      const next = new Map(loanAbonoMap);
                      next.delete(loan.id);
                      onLoanAbonChange(loan.id, -1); // Signal delete via negative
                    } else {
                      onLoanAbonChange(loan.id, saldo);
                    }
                  }}
                  className="accent-danger flex-shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-xs text-content truncate">
                    {loan.concept}
                  </span>
                  <span className="block text-[10px] text-dim">
                    {new Date(loan.createdAt).toLocaleDateString('es-VE')}
                  </span>
                </span>
              </span>
              <span className="text-right flex-shrink-0">
                <span className="block text-xs font-semibold text-danger">
                  Saldo: {formatUSD(saldo)}
                </span>
                {(loan.paidAmount ?? 0) > 0 && (
                  <span className="block text-[10px] text-ok">
                    Abonado: {formatUSD(loan.paidAmount ?? 0)}
                  </span>
                )}
                {bcvRate > 0 && (
                  <span className="block text-[10px] text-dim">
                    {formatBs(saldo, bcvRate)}
                  </span>
                )}
              </span>
            </label>
            {isSelected && saldo > 0 && (
              <div className="flex items-center gap-2 ml-6">
                <span className="text-[10px] text-dim">Abonar:</span>
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-dim text-xs">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={saldo}
                    value={abonoAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isFinite(val) || val < 0) {
                        onLoanAbonChange(loan.id, 0);
                      } else if (val > saldo) {
                        onLoanAbonChange(loan.id, saldo);
                      } else {
                        onLoanAbonChange(loan.id, val);
                      }
                    }}
                    className="input-field !py-1 !pl-6 !pr-2 text-xs w-full"
                    placeholder={formatUSD(saldo)}
                  />
                </div>
                {bcvRate > 0 && (
                  <span className="text-[10px] text-dim flex-shrink-0">
                    {formatBs(abonoAmount, bcvRate)}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[10px] text-dim">
        Destilda un préstamo para no descontarlo, o edita el monto para abonar
        una parte.
      </p>
    </div>
  );
}
