import { SubscriptionPlanEnum } from '../shared/types/enumShared';

export interface Organization {
  id: string;
  name: string;
  description?: string;
  ownerId: string; // Usuario propietario
  subscriptionPlan: SubscriptionPlanEnum;
  subscriptionStatus: 'active' | 'suspended' | 'cancelled' | 'trial';
  subscriptionStartDate: Date;
  subscriptionEndDate?: Date;
  maxBranches: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
