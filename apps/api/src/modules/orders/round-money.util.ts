/**
 * Redondeo de dinero a 2 decimales, replicando exacto el patron de comisiones:
 * `Math.round(value * 100) / 100`.
 *
 * OJO — no se consolido con el `round2` de `order-totals.util.ts`: ese usa
 * `+n.toFixed(2)`, aritmetica DISTINTA (difiere en bordes de coma flotante y
 * negativos) y ademas no esta exportado. En codigo de dinero un cambio de
 * redondeo es un cambio de comportamiento, asi que este helper conserva la
 * formula que ya usaba `OrdersService`.
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
