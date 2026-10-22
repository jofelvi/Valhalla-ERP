// SOLID: Single Responsibility - Currency formatting utilities
// DRY: Centralized currency handling
// KISS: Simple, focused currency functions

// SOLID: Interface Segregation - Currency formatting options
export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showSymbol?: boolean;
}

// KISS: Simple currency formatter
export function formatCurrency(
  amount: number,
  options: CurrencyFormatOptions = {},
): string {
  const {
    currency = 'USD',
    locale = 'es-ES',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true,
  } = options;

  if (isNaN(amount)) {
    return '0.00';
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: showSymbol ? currency : undefined,
    minimumFractionDigits,
    maximumFractionDigits,
  });

  return formatter.format(amount);
}

// DRY: Specific formatters for common use cases
export const currencyFormatters = {
  // Standard currency display
  standard: (amount: number, currency = 'USD') =>
    formatCurrency(amount, { currency }),

  // Compact currency (no decimals for whole numbers)
  compact: (amount: number, currency = 'USD') =>
    formatCurrency(amount, {
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }),

  // Currency without symbol
  noSymbol: (amount: number) => formatCurrency(amount, { showSymbol: false }),

  // Percentage
  percentage: (amount: number, decimals = 1) => `${amount.toFixed(decimals)}%`,

  // Large numbers with K, M suffixes
  abbreviated: (amount: number, currency = 'USD') => {
    const absAmount = Math.abs(amount);

    if (absAmount >= 1000000) {
      return `${formatCurrency(amount / 1000000, { currency, maximumFractionDigits: 1 })}M`;
    }

    if (absAmount >= 1000) {
      return `${formatCurrency(amount / 1000, { currency, maximumFractionDigits: 1 })}K`;
    }

    return formatCurrency(amount, { currency });
  },
};

// SOLID: Single Responsibility - Currency conversion utilities
export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  lastUpdated: Date;
}

export class CurrencyConverter {
  private rates: Map<string, CurrencyRate> = new Map();

  // SOLID: Open/Closed - Extensible rate management
  setRate(from: string, to: string, rate: number): void {
    const key = `${from}-${to}`;
    this.rates.set(key, {
      from,
      to,
      rate,
      lastUpdated: new Date(),
    });
  }

  // KISS: Simple conversion logic
  convert(amount: number, from: string, to: string): number | null {
    if (from === to) return amount;

    const key = `${from}-${to}`;
    const reverseKey = `${to}-${from}`;

    // Try direct rate
    const directRate = this.rates.get(key);
    if (directRate) {
      return amount * directRate.rate;
    }

    // Try reverse rate
    const reverseRate = this.rates.get(reverseKey);
    if (reverseRate) {
      return amount / reverseRate.rate;
    }

    return null; // No rate available
  }

  // DRY: Currency conversion with formatting
  convertAndFormat(
    amount: number,
    from: string,
    to: string,
    options: CurrencyFormatOptions = {},
  ): string | null {
    const converted = this.convert(amount, from, to);
    if (converted === null) return null;

    return formatCurrency(converted, {
      currency: to,
      ...options,
    });
  }
}

// DRY: Common currency calculations
export const currencyCalculations = {
  // Calculate percentage of amount
  percentage: (amount: number, percentage: number): number => {
    return (amount * percentage) / 100;
  },

  // Add percentage to amount
  addPercentage: (amount: number, percentage: number): number => {
    return amount + currencyCalculations.percentage(amount, percentage);
  },

  // Subtract percentage from amount
  subtractPercentage: (amount: number, percentage: number): number => {
    return amount - currencyCalculations.percentage(amount, percentage);
  },

  // Calculate tax amount
  calculateTax: (subtotal: number, taxRate: number): number => {
    return currencyCalculations.percentage(subtotal, taxRate);
  },

  // Calculate total with tax
  calculateTotalWithTax: (subtotal: number, taxRate: number): number => {
    return currencyCalculations.addPercentage(subtotal, taxRate);
  },

  // Calculate discount amount
  calculateDiscount: (amount: number, discountRate: number): number => {
    return currencyCalculations.percentage(amount, discountRate);
  },

  // Apply discount to amount
  applyDiscount: (amount: number, discountRate: number): number => {
    return currencyCalculations.subtractPercentage(amount, discountRate);
  },

  // Round to currency precision
  roundToCurrency: (amount: number, decimals = 2): number => {
    return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
  },
};

// Conversión Bs <-> USD con redondeo a 2 decimales
// Centraliza la lógica para evitar errores de punto flotante
/**
 * La conversion NO se define aca: vive en `@odin6/types` (packages/types/src/
 * money), la fuente unica que comparten API, web POS y app movil.
 *
 * Tener una copia propia en cada app fue lo que dejo 603 pagos guardados en
 * bolivares dentro del campo de dolares. Se re-exporta para no romper los
 * imports existentes, pero la matematica es una sola.
 */
export {
  bsToUsd,
  usdToBs,
  resolveUsdAmount,
  prepararMonto,
  pareceOtraMoneda,
  seIngresaEnBolivares,
  METODOS_EN_BOLIVARES,
  MAX_FACTOR_SOBRE_TOTAL,
} from '@odin6/types';

// KISS: Default currency converter instance
export const defaultCurrencyConverter = new CurrencyConverter();

// DRY: Common currency symbols
export const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  VES: 'Bs',
  ARS: '$',
  COP: '$',
  PEN: 'S/',
  CLP: '$',
  BRL: 'R$',
};
