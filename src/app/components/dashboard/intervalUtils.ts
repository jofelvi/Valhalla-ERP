import { SalesIntervalEnum } from '@/shared/types/enumShared';
import {
  addBusinessDays,
  getBusinessDayEnd,
  getBusinessDayStart,
  getBusinessMonthStart,
  getBusinessWeekStart,
} from '@/shared/utils/businessDay';

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Rangos por JORNADA (06:00 a 06:00), no por calendario. Ver
 * `shared/utils/businessDay.ts`: El negocio cobra despues de medianoche, asi que un
 * corte a las 00:00 parte la noche en dos y descuadra ventas contra caja.
 */
export function getIntervalDateRange(interval: SalesIntervalEnum): DateRange {
  const today = getBusinessDayStart(new Date());

  switch (interval) {
    case SalesIntervalEnum.TODAY:
      return { start: today, end: getBusinessDayEnd(today) };

    case SalesIntervalEnum.YESTERDAY: {
      const start = addBusinessDays(today, -1);
      return { start, end: getBusinessDayEnd(start) };
    }

    case SalesIntervalEnum.CURRENT_WEEK: {
      const monday = getBusinessWeekStart(today);
      return {
        start: monday,
        end: getBusinessDayEnd(addBusinessDays(monday, 6)),
      };
    }

    case SalesIntervalEnum.PREVIOUS_WEEK: {
      const monday = addBusinessDays(getBusinessWeekStart(today), -7);
      return {
        start: monday,
        end: getBusinessDayEnd(addBusinessDays(monday, 6)),
      };
    }

    case SalesIntervalEnum.CURRENT_MONTH: {
      const start = getBusinessMonthStart(today);
      const lastDay = addBusinessDays(getBusinessMonthStart(today, 1), -1);
      return { start, end: getBusinessDayEnd(lastDay) };
    }

    case SalesIntervalEnum.PREVIOUS_MONTH: {
      const start = getBusinessMonthStart(today, -1);
      const lastDay = addBusinessDays(getBusinessMonthStart(today), -1);
      return { start, end: getBusinessDayEnd(lastDay) };
    }

    default:
      return getIntervalDateRange(SalesIntervalEnum.TODAY);
  }
}
