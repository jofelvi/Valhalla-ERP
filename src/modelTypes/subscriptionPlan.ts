import { SubscriptionPlanEnum } from '@/shared/types/enumShared';

export interface SubscriptionPlan {
  id: string;
  name: SubscriptionPlanEnum;
  displayName: string;
  description: string;

  // Pricing
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;

  // Limits
  maxBranches: number;
  maxUsersPerBranch: number;
  maxProductsPerBranch: number;
  maxOrdersPerMonth: number;
  maxStorageGB: number;

  // Features
  features: {
    multiCurrency: boolean;
    advancedReports: boolean;
    apiAccess: boolean;
    customIntegrations: boolean;
    prioritySupport: boolean;
    whitelabeling: boolean;
    customDomain: boolean;
    backupAndRestore: boolean;
    auditLogs: boolean;
    customFields: boolean;
  };

  // Trial
  trialDays: number;

  // Status
  isActive: boolean;
  isPublic: boolean; // Si aparece en pricing público

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
