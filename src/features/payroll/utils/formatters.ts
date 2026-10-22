export function formatUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function formatBs(n: number, rate: number): string {
  return `Bs ${(n * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
