import { UserRoleEnum } from '../shared/types/enumShared';

export interface UserBranch {
  id: string;
  userId: string;
  branchId: string;
  organizationId: string;

  // Role specific to this branch
  role: UserRoleEnum;

  // Permissions for this specific branch
  permissions: {
    canManageSettings: boolean;
    canViewReports: boolean;
    canManageInventory: boolean;
    canManageUsers: boolean;
    canProcessOrders: boolean;
    canProcessPayments: boolean;
    canManageCustomers: boolean;
    canManageSuppliers: boolean;
  };

  // Status
  isActive: boolean;
  isDefault: boolean; // Sucursal por defecto para este usuario

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  invitedBy?: string;
  acceptedAt?: Date;
}
