import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Branch, BranchSettings } from '@odin6/types';
import { Organization } from '@odin6/types';
import { UserBranch } from '@odin6/types';

interface BranchState {
  // Current active branch
  currentBranch: Branch | null;
  currentBranchSettings: BranchSettings | null;
  currentOrganization: Organization | null;

  // Available branches for current user
  userBranches: UserBranch[];
  availableBranches: Branch[];

  // Loading states
  isLoading: boolean;
  isLoadingSettings: boolean;

  // Actions
  setCurrentBranch: (branch: Branch) => void;
  setCurrentBranchSettings: (settings: BranchSettings) => void;
  setCurrentOrganization: (organization: Organization) => void;
  setUserBranches: (userBranches: UserBranch[]) => void;
  setAvailableBranches: (branches: Branch[]) => void;
  setLoading: (loading: boolean) => void;
  setLoadingSettings: (loading: boolean) => void;

  // Utility methods
  getCurrentBranchId: () => string | null;
  getCurrentOrganizationId: () => string | null;
  hasMultipleBranches: () => boolean;
  getCurrentUserRole: () => string | null;
  canAccessBranch: (branchId: string) => boolean;

  // Settings helpers
  getCurrency: () => string;
  getTaxRate: () => number;
  getServiceChargeRate: () => number;
  isTipEnabled: () => boolean;
  getTipSuggestions: () => number[];

  // Clear state (logout)
  clearState: () => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentBranch: null,
      currentBranchSettings: null,
      currentOrganization: null,
      userBranches: [],
      availableBranches: [],
      isLoading: false,
      isLoadingSettings: false,

      // Actions
      setCurrentBranch: (branch) => set({ currentBranch: branch }),

      setCurrentBranchSettings: (settings) =>
        set({ currentBranchSettings: settings }),

      setCurrentOrganization: (organization) =>
        set({ currentOrganization: organization }),

      setUserBranches: (userBranches) => set({ userBranches }),

      setAvailableBranches: (branches) => set({ availableBranches: branches }),

      setLoading: (loading) => set({ isLoading: loading }),

      setLoadingSettings: (loading) => set({ isLoadingSettings: loading }),

      // Utility methods
      getCurrentBranchId: () => {
        const { currentBranch } = get();
        return currentBranch?.id || null;
      },

      getCurrentOrganizationId: () => {
        const { currentOrganization } = get();
        return currentOrganization?.id || null;
      },

      hasMultipleBranches: () => {
        const { availableBranches } = get();
        return availableBranches.length > 1;
      },

      getCurrentUserRole: () => {
        const { currentBranch, userBranches } = get();
        if (!currentBranch) return null;

        const userBranch = userBranches.find(
          (ub) => ub.branchId === currentBranch.id,
        );
        return userBranch?.role || null;
      },

      canAccessBranch: (branchId) => {
        const { userBranches } = get();
        return userBranches.some(
          (ub) => ub.branchId === branchId && ub.isActive,
        );
      },

      // Settings helpers
      getCurrency: () => {
        const { currentBranchSettings } = get();
        return currentBranchSettings?.currency || 'USD';
      },

      getTaxRate: () => {
        const { currentBranchSettings } = get();
        return currentBranchSettings?.taxRate || 0;
      },

      getServiceChargeRate: () => {
        const { currentBranchSettings } = get();
        return currentBranchSettings?.serviceChargeEnabled
          ? currentBranchSettings.serviceChargeRate || 0
          : 0;
      },

      isTipEnabled: () => {
        const { currentBranchSettings } = get();
        return currentBranchSettings?.tipEnabled || false;
      },

      getTipSuggestions: () => {
        const { currentBranchSettings } = get();
        return currentBranchSettings?.tipSuggestions || [1, 2, 3, 5];
      },

      // Clear state
      clearState: () =>
        set({
          currentBranch: null,
          currentBranchSettings: null,
          currentOrganization: null,
          userBranches: [],
          availableBranches: [],
          isLoading: false,
          isLoadingSettings: false,
        }),
    }),
    {
      name: 'branch-store',
      partialize: (state) => ({
        currentBranch: state.currentBranch,
        currentBranchSettings: state.currentBranchSettings,
        currentOrganization: state.currentOrganization,
      }),
    },
  ),
);
