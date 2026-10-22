export interface GoogleMapsLocation {
  address: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  description?: string;

  // Contact Information
  email?: string;
  phone?: string;

  // Location
  country: string;
  city: string;
  location: GoogleMapsLocation;

  // Business Info
  businessRegistration?: string;
  taxId?: string;

  // Settings
  isActive: boolean;
  isDefault: boolean; // Una sucursal por defecto por organización
  settings?: BranchSettings; // Branch configuration settings

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Business Hours type
export interface BusinessHours {
  monday: { isOpen: boolean; openTime: string; closeTime: string };
  tuesday: { isOpen: boolean; openTime: string; closeTime: string };
  wednesday: { isOpen: boolean; openTime: string; closeTime: string };
  thursday: { isOpen: boolean; openTime: string; closeTime: string };
  friday: { isOpen: boolean; openTime: string; closeTime: string };
  saturday: { isOpen: boolean; openTime: string; closeTime: string };
  sunday: { isOpen: boolean; openTime: string; closeTime: string };
}

// Payment Methods type
export interface PaymentMethods {
  cash: boolean;
  card: boolean;
  digitalWallet: boolean;
  bankTransfer: boolean;
}

// Receipt Settings type
export interface ReceiptSettings {
  showLogo: boolean;
  showTaxNumber: boolean;
  footerMessage: string;
  autoprint: boolean;
}

// Notification Settings type
export interface NotificationSettings {
  lowStock: boolean;
  newOrders: boolean;
  dailyReports: boolean;
  systemAlerts: boolean;
}

export interface BranchSettings {
  // Currency & Localization
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;

  // Tax Configuration
  taxRate: number; // As percentage (16 for 16%)

  // Tip Configuration
  enableTips: boolean;
  defaultTipPercentage: number;
  tipEnabled: boolean; // Alias for backwards compatibility
  tipSuggestions: number[]; // Suggested tip percentages

  // Service Charge Configuration
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;

  // Business Hours
  businessHours: BusinessHours;

  // Payment Methods
  paymentMethods: PaymentMethods;

  // Receipt Settings
  receiptSettings: ReceiptSettings;

  // Notification Settings
  notifications: NotificationSettings;
}
