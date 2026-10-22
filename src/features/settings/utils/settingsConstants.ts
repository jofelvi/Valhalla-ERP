import { SelectOption } from '@/components/shared/selectCustom/SelectCustom';

// Country options for branch forms
export const countryOptions: SelectOption[] = [
  { value: 'VE', label: 'Venezuela' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'CO', label: 'Colombia' },
  { value: 'PE', label: 'Perú' },
  { value: 'MX', label: 'México' },
  { value: 'AR', label: 'Argentina' },
  { value: 'ES', label: 'España' },
];

// Currency options
export const currencyOptions: SelectOption[] = [
  { value: 'USD', label: 'Dólar Estadounidense (USD)' },
  { value: 'VES', label: 'Bolívar Venezolano (VES)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'COP', label: 'Peso Colombiano (COP)' },
  { value: 'PEN', label: 'Sol Peruano (PEN)' },
  { value: 'MXN', label: 'Peso Mexicano (MXN)' },
];

// Language options
export const languageOptions: SelectOption[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
];

// Timezone options
export const timezoneOptions: SelectOption[] = [
  { value: 'America/Caracas', label: 'Venezuela (UTC-4)' },
  { value: 'America/New_York', label: 'Eastern Time (UTC-5)' },
  { value: 'America/Chicago', label: 'Central Time (UTC-6)' },
  { value: 'America/Denver', label: 'Mountain Time (UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8)' },
  { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
  { value: 'America/Lima', label: 'Perú (UTC-5)' },
  { value: 'America/Mexico_City', label: 'México (UTC-6)' },
];

// Date format options
export const dateFormatOptions: SelectOption[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2023)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2023)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2023-12-31)' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (31-12-2023)' },
];

// Default form values
export const defaultBranchValues = {
  currency: 'USD',
  language: 'es',
  timezone: 'America/Caracas',
  country: 'VE',
  taxRate: 16,
  enableTips: true,
  defaultTipPercentage: 10,
  isDefault: false,
};

export const defaultGeneralSettingsValues = {
  currency: 'USD',
  language: 'es',
  timezone: 'America/Caracas',
  dateFormat: 'DD/MM/YYYY',
  taxRate: 16,
  enableTips: true,
  defaultTipPercentage: 10,
};
