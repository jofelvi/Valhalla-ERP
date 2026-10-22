/**
 * Normaliza el dinero de cada item: total SIEMPRE = unitPrice x quantity.
 * Si unitPrice falta (datos legacy con `price` o solo `total`), lo deriva
 * antes de normalizar. Devuelve un array nuevo; no muta el original.
 *
 * Funcion pura: solo parametros + Number/Math, sin dependencias de Nest ni
 * Mongoose. NO toca `noCharge` ni `discountAmount`; esos campos viajan
 * intactos por el spread y se aplican en otra etapa del calculo de totales.
 */
export function normalizeItemsMoney(
  items: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return items.map((raw) => {
    const it: Record<string, unknown> = { ...raw };
    const qty = Number(it.quantity) || 0;
    let unit = Number(it.unitPrice);
    if (!isFinite(unit) || unit < 0) {
      unit = Number(it.price);
    }
    if (!isFinite(unit) || unit < 0) {
      const tot = Number(it.total ?? it.totalPrice);
      unit = qty > 0 && isFinite(tot) && tot >= 0 ? tot / qty : 0;
    }
    unit = +unit.toFixed(2);
    it.unitPrice = unit;
    it.total = +(unit * qty).toFixed(2);
    return it;
  });
}
