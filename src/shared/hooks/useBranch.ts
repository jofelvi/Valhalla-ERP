// hooks/useBranch.ts
import React, { useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useBranchStore } from '@/shared/store/useBranchStore';
import { api } from '@/services/api/apiClient';
import { Branch, BranchSettings } from '@odin6/types';
import { Organization } from '@odin6/types';
import { UserBranch } from '@odin6/types';
import { SubscriptionPlanEnum, UserRoleEnum } from '@/shared/types/enumShared';

// Wrapper services using API client (branch endpoints may not be fully migrated yet)
const branchService = {
  getById: async (id: string) => {
    try {
      return await api.get<Branch>(`/api/branches/${id}`);
    } catch {
      return null;
    }
  },
  getByOrganization: async (orgId: string) => {
    try {
      return await api.get<Branch[]>('/api/branches', {
        organizationId: orgId,
      });
    } catch {
      return [];
    }
  },
  create: async (data: Omit<Branch, 'id'>) =>
    api.post<Branch>('/api/branches', data),
};
const branchSettingsService = {
  getByBranchId: async (branchId: string) => {
    try {
      return await api.get<BranchSettings>(`/api/branch-settings/${branchId}`);
    } catch {
      return null;
    }
  },
  createDefault: async (branchId: string, userId: string) =>
    api.post<BranchSettings>('/api/branch-settings', { branchId, userId }),
  update: async (
    branchId: string,
    updates: Partial<BranchSettings>,
    userId: string,
  ) =>
    api.patch<BranchSettings>(`/api/branch-settings/${branchId}`, {
      ...updates,
      userId,
    }),
};
const organizationService = {
  getById: async (id: string) => {
    try {
      return await api.get<Organization>(`/api/organizations/${id}`);
    } catch {
      return null;
    }
  },
  getByOwner: async (ownerId: string) => {
    try {
      return await api.get<Organization[]>('/api/organizations', { ownerId });
    } catch {
      return [];
    }
  },
  create: async (data: Omit<Organization, 'id'>) =>
    api.post<Organization>('/api/organizations', data),
};
const userBranchService = {
  getByUserId: async (userId: string) => {
    try {
      return await api.get<UserBranch[]>('/api/user-branches', { userId });
    } catch {
      return [];
    }
  },
  addUserToBranch: async (data: Omit<UserBranch, 'id'>) =>
    api.post<UserBranch>('/api/user-branches', data),
  setDefaultBranch: async (userId: string, branchId: string) =>
    api.patch<UserBranch>('/api/user-branches/set-default', {
      userId,
      branchId,
    }),
};

export const useBranch = () => {
  const { data: session } = useSession();
  const {
    currentBranch,
    currentBranchSettings,
    currentOrganization,
    userBranches,
    availableBranches,
    isLoading,
    isLoadingSettings,
    setCurrentBranch,
    setCurrentBranchSettings,
    setCurrentOrganization,
    setUserBranches,
    setAvailableBranches,
    setLoading,
    setLoadingSettings,
    clearState,
    getCurrentBranchId,
    getCurrentOrganizationId,
    hasMultipleBranches,
    getCurrentUserRole,
    canAccessBranch,
    getCurrency,
    getTaxRate,
    getServiceChargeRate,
    isTipEnabled,
    getTipSuggestions,
  } = useBranchStore();

  // Track if we're currently creating default branch to prevent duplicates
  const isCreatingDefaultBranch = React.useRef(false);

  // Create default organization and branch for new users
  const createDefaultBranchForUser = useCallback(async (userId: string) => {
    // Prevent concurrent creation of default branches
    if (isCreatingDefaultBranch.current) {
      console.log('Already creating default branch, skipping...');
      return;
    }

    // Double-check that user still has no branches before creating
    const existingUserBranches = await userBranchService.getByUserId(userId);
    if (existingUserBranches.length > 0) {
      console.log('User already has branches, skipping default creation');
      return;
    }

    // Check if user already has an organization
    const existingOrganizations = await organizationService.getByOwner(userId);
    if (existingOrganizations.length > 0) {
      console.log('User already has organization, checking for branches...');
      // If user has organization but no branches, create a branch for the existing org
      const existingOrg = existingOrganizations[0];

      const orgBranches = await branchService.getByOrganization(existingOrg.id);
      if (orgBranches.length === 0) {
        console.log('Creating branch for existing organization');
        isCreatingDefaultBranch.current = true;

        try {
          const defaultBranch = await branchService.create({
            organizationId: existingOrg.id,
            name: 'Sucursal Principal',
            description: 'Sucursal principal por defecto',
            email: '',
            phone: '',
            country: 'Venezuela',
            city: 'Caracas',
            location: {
              address: 'Dirección por defecto',
            },
            businessRegistration: '',
            taxId: '',
            isActive: true,
            isDefault: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
          });

          await branchSettingsService.createDefault(defaultBranch.id, userId);

          await userBranchService.addUserToBranch({
            userId: userId,
            branchId: defaultBranch.id,
            organizationId: existingOrg.id,
            role: 'admin' as UserRoleEnum,
            permissions: {
              canManageSettings: true,
              canViewReports: true,
              canManageInventory: true,
              canManageUsers: true,
              canProcessOrders: true,
              canProcessPayments: true,
              canManageCustomers: true,
              canManageSuppliers: true,
            },
            isActive: true,
            isDefault: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            invitedBy: userId,
            acceptedAt: new Date(),
          });

          console.log('Branch created for existing organization');
          return defaultBranch;
        } finally {
          isCreatingDefaultBranch.current = false;
        }
      }
      return;
    }

    console.log('Creating default organization and branch for user:', userId);
    isCreatingDefaultBranch.current = true;

    try {
      // Create default organization
      const defaultOrganization = await organizationService.create({
        name: 'Mi Organización',
        description: 'Organización por defecto',
        ownerId: userId,
        subscriptionPlan: SubscriptionPlanEnum.BASIC,
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date(),
        maxBranches: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('Default organization created:', defaultOrganization);

      // Create default branch
      const defaultBranch = await branchService.create({
        organizationId: defaultOrganization.id,
        name: 'Sucursal Principal',
        description: 'Sucursal principal por defecto',
        email: '',
        phone: '',
        country: 'Venezuela',
        city: 'Caracas',
        location: {
          address: 'Dirección por defecto',
        },
        businessRegistration: '',
        taxId: '',
        isActive: true,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
      });

      console.log('Default branch created:', defaultBranch);

      // Create default settings for the branch
      await branchSettingsService.createDefault(defaultBranch.id, userId);

      // Add user to branch with admin permissions
      await userBranchService.addUserToBranch({
        userId: userId,
        branchId: defaultBranch.id,
        organizationId: defaultOrganization.id,
        role: 'admin' as UserRoleEnum,
        permissions: {
          canManageSettings: true,
          canViewReports: true,
          canManageInventory: true,
          canManageUsers: true,
          canProcessOrders: true,
          canProcessPayments: true,
          canManageCustomers: true,
          canManageSuppliers: true,
        },
        isActive: true,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        invitedBy: userId,
        acceptedAt: new Date(),
      });

      console.log('User added to default branch');
      return defaultBranch;
    } catch (error) {
      console.error('Error creating default branch for user:', error);
      throw error;
    } finally {
      isCreatingDefaultBranch.current = false;
    }
  }, []);

  // Initialize branches when user logs in
  const initializeBranches = useCallback(async () => {
    console.log('=== INITIALIZING BRANCHES ===');
    console.log('Session user ID:', session?.user?.id);

    if (!session?.user?.id) {
      console.log('No session user ID, skipping initialization');
      return;
    }

    setLoading(true);
    try {
      console.log('Getting user branches...');
      // Get user's branches
      const userBranchesData = await userBranchService.getByUserId(
        session.user.id,
      );
      console.log('User branches data:', userBranchesData);
      setUserBranches(userBranchesData);

      if (userBranchesData.length === 0) {
        console.log(
          'User has no branches, creating default organization and branch',
        );
        await createDefaultBranchForUser(session.user.id);
        // Retry initialization after creating default branch
        setTimeout(() => initializeBranches(), 1000);
        setLoading(false);
        return;
      }

      console.log('Getting available branches...');
      // Get available branches
      const branchPromises = userBranchesData.map((ub) =>
        branchService.getById(ub.branchId),
      );
      const branches = (await Promise.all(branchPromises)).filter(
        Boolean,
      ) as Branch[];
      console.log('Available branches:', branches);
      setAvailableBranches(branches);

      // Set current branch (default or first available)
      const defaultUserBranch = userBranchesData.find((ub) => ub.isDefault);
      const targetBranchId =
        defaultUserBranch?.branchId || userBranchesData[0]?.branchId;
      const targetBranch = branches.find((b) => b.id === targetBranchId);

      console.log('Target branch ID:', targetBranchId);
      console.log('Target branch:', targetBranch);

      if (targetBranch) {
        console.log('Setting current branch:', targetBranch);
        setCurrentBranch(targetBranch);

        // Load organization
        console.log('Loading organization...');
        const organization = await organizationService.getById(
          targetBranch.organizationId,
        );
        console.log('Organization:', organization);
        if (organization) {
          setCurrentOrganization(organization);
        }

        // Load branch settings
        console.log('Loading branch settings...');
        await loadBranchSettings(targetBranch.id);
      }
    } catch (error) {
      console.error('Error initializing branches:', error);
    } finally {
      setLoading(false);
      console.log('=== BRANCH INITIALIZATION COMPLETE ===');
    }
  }, [session?.user?.id, createDefaultBranchForUser]);

  // Load branch settings
  const loadBranchSettings = useCallback(
    async (branchId: string) => {
      setLoadingSettings(true);
      try {
        let settings = await branchSettingsService.getByBranchId(branchId);

        // Create default settings if none exist
        if (!settings && session?.user?.id) {
          settings = await branchSettingsService.createDefault(
            branchId,
            session.user.id,
          );
        }

        if (settings) {
          setCurrentBranchSettings(settings);
        }
      } catch (error) {
        console.error('Error loading branch settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    },
    [session?.user?.id],
  );

  // Switch to different branch
  const switchBranch = useCallback(
    async (branchId: string) => {
      if (!canAccessBranch(branchId)) {
        throw new Error('Access denied to this branch');
      }

      const branch = availableBranches.find((b) => b.id === branchId);
      if (!branch) {
        throw new Error('Branch not found');
      }

      setLoading(true);
      try {
        // Set as current branch
        setCurrentBranch(branch);

        // Load organization if different
        if (branch.organizationId !== getCurrentOrganizationId()) {
          const organization = await organizationService.getById(
            branch.organizationId,
          );
          if (organization) {
            setCurrentOrganization(organization);
          }
        }

        // Load branch settings
        await loadBranchSettings(branch.id);

        // Optionally set as default for user
        if (session?.user?.id) {
          await userBranchService.setDefaultBranch(session.user.id, branchId);
        }
      } catch (error) {
        console.error('Error switching branch:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      availableBranches,
      canAccessBranch,
      getCurrentOrganizationId,
      session?.user?.id,
    ],
  );

  // Update branch settings
  const updateBranchSettings = useCallback(
    async (updates: Partial<BranchSettings>) => {
      console.log('=== UPDATE BRANCH SETTINGS HOOK ===');
      console.log('Current branch ID:', currentBranch?.id);
      console.log('Current user ID:', session?.user?.id);
      console.log('Updates to apply:', updates);

      if (!currentBranch?.id || !session?.user?.id) {
        console.log('Missing currentBranch.id or session.user.id');
        return;
      }

      try {
        console.log('Calling branchSettingsService.update...');
        await branchSettingsService.update(
          currentBranch.id,
          updates,
          session.user.id,
        );

        console.log(
          'branchSettingsService.update completed, reloading settings...',
        );
        // Reload settings
        await loadBranchSettings(currentBranch.id);
        console.log('Settings reloaded successfully');
      } catch (error) {
        console.error('Error updating branch settings:', error);
        throw error;
      }
    },
    [currentBranch?.id, session?.user?.id, loadBranchSettings],
  );

  // Create new branch
  const createBranch = useCallback(
    async (branchData: Omit<Branch, 'id'>) => {
      if (!session?.user?.id || !currentOrganization) return;

      try {
        const newBranch = await branchService.create({
          ...branchData,
          createdBy: session.user.id,
        });

        // Create default settings
        await branchSettingsService.createDefault(
          newBranch.id,
          session.user.id,
        );

        // Add user to branch with admin permissions
        await userBranchService.addUserToBranch({
          userId: session.user.id,
          branchId: newBranch.id,
          organizationId: currentOrganization.id,
          role: 'admin' as UserRoleEnum,
          permissions: {
            canManageSettings: true,
            canViewReports: true,
            canManageInventory: true,
            canManageUsers: true,
            canProcessOrders: true,
            canProcessPayments: true,
            canManageCustomers: true,
            canManageSuppliers: true,
          },
          isActive: true,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Refresh user branches
        await initializeBranches();

        return newBranch;
      } catch (error) {
        console.error('Error creating branch:', error);
        throw error;
      }
    },
    [session?.user?.id, currentOrganization, initializeBranches],
  );

  // Initialize on mount and when user changes
  useEffect(() => {
    if (session?.user?.id) {
      initializeBranches();
    } else {
      clearState();
    }
  }, [session?.user?.id, initializeBranches, clearState]);

  return {
    // State
    currentBranch,
    currentBranchSettings,
    currentOrganization,
    userBranches,
    availableBranches,
    isLoading,
    isLoadingSettings,

    // Methods
    switchBranch,
    updateBranchSettings,
    createBranch,
    initializeBranches,

    // Utilities
    getCurrentBranchId,
    getCurrentOrganizationId,
    hasMultipleBranches,
    getCurrentUserRole,
    canAccessBranch,

    // Settings shortcuts
    getCurrency,
    getTaxRate,
    getServiceChargeRate,
    isTipEnabled,
    getTipSuggestions,
  };
};
