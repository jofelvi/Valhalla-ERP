import type { ExpenseCurrency } from './schemas/expense.schema';

export const r2 = (n: number): number => Math.round(n * 100) / 100;

export function convertir(
  amount: number,
  currency: ExpenseCurrency,
  rate: number,
): { amountBs: number; amountUsd: number } {
  if (currency === 'BS')
    return { amountBs: r2(amount), amountUsd: r2(amount / rate) };
  return { amountBs: r2(amount * rate), amountUsd: r2(amount) };
}

/** "Bs 18.450,00" / "$ 245,00". A mano para no depender del ICU del proceso. */
export function fmtMoney(n: number, currency: ExpenseCurrency): string {
  const [entero, dec] = Math.abs(n).toFixed(2).split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const signo = n < 0 ? '-' : '';
  return `${currency === 'BS' ? 'Bs' : '$'} ${signo}${miles},${dec}`;
}

/** Stock en unidad base, legible: 34500 GR -> "34,5 kg"; 800 ML -> "800 ml". */
export function fmtStock(qty: number, baseUnit: 'GR' | 'ML' | 'UND'): string {
  const num = (v: number) =>
    String(Math.round(v * 100) / 100).replace('.', ',');
  if (baseUnit === 'UND') return `${num(qty)} und`;
  const grande = baseUnit === 'GR' ? 'kg' : 'l';
  const chica = baseUnit === 'GR' ? 'g' : 'ml';
  return Math.abs(qty) >= 1000
    ? `${num(qty / 1000)} ${grande}`
    : `${num(qty)} ${chica}`;
}
