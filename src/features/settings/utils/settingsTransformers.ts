import { Branch, BranchSettings } from '@odin6/types';
import {
  BranchFormData,
  GeneralSettingsFormData,
  NewBranchFormData,
} from '../schemas/branchSchemas';

/**
 * Transform NewBranchFormData to Branch creation data
 */
export const transformNewBranchFormData = (
  data: NewBranchFormData,
): Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> => {
  return {
    organizationId: '', // Will be set by the service
    name: data.name,
    description: data.description,
    phone: data.phone,
    email: data.email,
    country: data.country,
    city: data.city,
    location: {
      address: data.address,
    },
    isDefault: data.isDefault || false,
    isActive: true,
  };
};

/**
 * Transform NewBranchFormData to BranchSettings creation data
 */
export const transformNewBranchSettingsData = (
  data: NewBranchFormData,
): BranchSettings => {
  return {
    currency: data.currency,
    language: data.language,
    timezone: data.timezone,
    dateFormat: 'DD/MM/YYYY',
    taxRate: data.taxRate, // Keep as percentage
    enableTips: data.enableTips || false,
    defaultTipPercentage:
      data.enableTips && data.defaultTipPercentage
        ? data.defaultTipPercentage
        : 0,
    tipEnabled: data.enableTips || false,
    tipSuggestions: [10, 15, 20],
    serviceChargeEnabled: false,
    serviceChargeRate: 0,
    businessHours: {
      monday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      tuesday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      wednesday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      thursday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      friday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      saturday: { isOpen: true, openTime: '08:00', closeTime: '22:00' },
      sunday: { isOpen: true, openTime: '10:00', closeTime: '20:00' },
    },
    paymentMethods: {
      cash: true,
      card: true,
      digitalWallet: true,
      bankTransfer: true,
    },
    receiptSettings: {
      showLogo: true,
      showTaxNumber: true,
      footerMessage: 'Gracias por su compra',
      autoprint: false,
    },
    notifications: {
      lowStock: true,
      newOrders: true,
      dailyReports: false,
      systemAlerts: true,
    },
  };
};

/**
 * Transform Branch data to BranchFormData for editing
 */
export const transformBranchToFormData = (branch: Branch): BranchFormData => {
  return {
    name: branch.name,
    description: branch.description || '',
    address: branch.location?.address || '',
    city: branch.city,
    country: branch.country,
    phone: branch.phone || '',
    email: branch.email || '',
    isDefault: branch.isDefault || false,
  };
};

/**
 * Transform BranchSettings to GeneralSettingsFormData
 */
export const transformBranchSettingsToFormData = (
  settings: BranchSettings,
): GeneralSettingsFormData => {
  return {
    currency: settings.currency || 'USD',
    language: settings.language || 'es',
    timezone: settings.timezone || 'America/Caracas',
    dateFormat: settings.dateFormat || 'DD/MM/YYYY',
    taxRate: settings.taxRate || 16, // Keep as percentage
    enableTips: settings.enableTips ?? true,
    defaultTipPercentage: settings.defaultTipPercentage || 10,
  };
};

/**
 * Transform GeneralSettingsFormData to BranchSettings update data
 */
export const transformGeneralSettingsFormData = (
  data: GeneralSettingsFormData,
): Partial<BranchSettings> => {
  return {
    currency: data.currency,
    language: data.language,
    timezone: data.timezone,
    dateFormat: data.dateFormat,
    taxRate: data.taxRate, // Keep as percentage
    enableTips: data.enableTips || false,
    defaultTipPercentage:
      data.enableTips && data.defaultTipPercentage
        ? data.defaultTipPercentage
        : 0,
  };
};
