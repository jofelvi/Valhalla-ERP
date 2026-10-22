/**
 * Un producto cuenta como insumo de inventario (se cuenta, se pide, se merma).
 *
 * El `false` EXPLICITO manda: antes el criterio era
 * `isForInventory === true || type === 'BASE'`, y ese `||` pisaba al `false`,
 * asi que los 13 servicios de evento (Alquiler Salon, Sonido, Animador,
 * Bartender, PASES INVITADOS...) salian como insumo en las listas de las TRES
 * estaciones. Medido el 24/09/2026 antes de cambiarlo: de los 18 productos
 * BASE con `isForInventory:false`, **uno solo tenia stock** (y era el propio
 * servicio "Entrada") y **ninguno se usaba como ingrediente** — respetar el
 * `false` no esconde ningun insumo real.
 *
 * Sin el campo se cae a `type === 'BASE'`, que es como estaba: hay productos
 * viejos que nunca lo declararon.
 */
export function esInsumoDeInventario(p: {
  isForInventory?: boolean;
  type?: string;
  isActive?: boolean;
}): boolean {
  if (p.isActive === false) return false;
  if (p.isForInventory === true) return true;
  if (p.isForInventory === false) return false;
  return p.type === 'BASE';
}
