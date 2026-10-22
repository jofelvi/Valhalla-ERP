import { api } from './api/apiClient';

interface VerifyPinResponse {
  valid: boolean;
  adminName: string | null;
}

export const adminPinService = {
  async validatePin(
    pin: string,
  ): Promise<{ valid: boolean; adminName: string | null }> {
    const trimmed = pin.trim();
    if (!trimmed) return { valid: false, adminName: null };
    try {
      return await api.post<VerifyPinResponse>('/api/auth/verify-admin-pin', {
        pin: trimmed,
      });
    } catch {
      return { valid: false, adminName: null };
    }
  },
};
