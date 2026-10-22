import { formatDate, FechaCruda } from '@/shared/utils/dateHelpers';

/**
 * @deprecated Use formatDate from dateHelpers instead
 * Kept for backward compatibility
 */
export const formatDateForDisplay = (dateValue: FechaCruda): string => {
  return formatDate(dateValue);
};
