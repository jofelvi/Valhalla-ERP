/**
 * Cómo se escribe el dinero en la APK. Una sola convención, un solo sitio.
 *
 * Espejo de `src/shared/utils/dinero.ts` de la web. El móvil se instala con
 * `pnpm install --ignore-workspace` (ruta corta para el build de Android) y no
 * puede importar `@odin6/types`, así que —igual que `services/money.ts`— se
 * mantiene una copia local. Estas funciones devuelven EXACTAMENTE lo que ya se
 * ve en pantalla (`$1234.50`), para que adoptarlas no cambie ni un píxel.
 */

/** `$1234.50` — el formato que usan hoy las pantallas de la APK. */
export const formatearUsd = (monto: number | null | undefined): string =>
  `$${Number(monto ?? 0).toFixed(2)}`;

/**
 * `1.234,50` — número con dos decimales y separador de miles, SIN símbolo.
 * Para lo que no es un monto aunque lo parezca (ej. la tasa BCV).
 */
export const formatearNumero = (monto: number | null | undefined): string =>
  Number(monto ?? 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** `Bs 1.234,50` — bolívares con separador de miles. */
export const formatearBs = (monto: number | null | undefined): string =>
  `Bs ${formatearNumero(monto)}`;
