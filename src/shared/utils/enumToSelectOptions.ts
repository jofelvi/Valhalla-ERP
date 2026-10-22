// utils/enumToSelectOptions.ts
import { SelectOption } from '@/components/shared/selectCustom/SelectCustom';

export function enumToSelectOptions<T extends Record<string, string | number>>(
  enumObj: T,
  labelMapper?: (key: keyof T, value: T[keyof T]) => string,
): SelectOption[] {
  return Object.entries(enumObj).map(([key, value]) => {
    const typedValue = value as T[keyof T]; // 👈 solución aquí

    return {
      value: typedValue,
      label: labelMapper
        ? labelMapper(key as keyof T, typedValue)
        : defaultLabelFormatter(key),
    };
  });
}

function defaultLabelFormatter(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

export function arrayToSelectOptions<T>(
  items: T[],
  valueKey: keyof T,
  labelKey: keyof T,
  labelMapper?: (label: T[keyof T], item: T) => string,
): SelectOption[] {
  return items.map((item) => ({
    value: item[valueKey] as string | number,
    label: labelMapper
      ? labelMapper(item[labelKey], item)
      : defaultLabelFormatter(String(item[labelKey])),
  }));
}
