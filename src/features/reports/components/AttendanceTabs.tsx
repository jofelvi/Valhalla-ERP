import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceSummary, DailyAttendance } from '@odin6/types';
import { AttendanceStatusEnum } from '@/shared';
import { AttendanceSummaryTab } from './AttendanceSummaryTab';
import { AttendanceCalendarTab } from './AttendanceCalendarTab';
import { AttendanceAnalyticsTab } from './AttendanceAnalyticsTab';

interface AttendanceTabsProps {
  summaries: AttendanceSummary[];
  dailyCalendar: DailyAttendance[];
  columns: ColumnDef<AttendanceSummary>[];
  selectedEmployee: string;
  getStatusIcon: (status: AttendanceStatusEnum) => React.ReactNode;
  getAttendanceRateBadge: (rate: number) => string;
  formatPercentage: (value: number) => string;
  attendanceCategories: { perfect: number; regular: number; low: number };
  additionalStats: {
    totalVacationDays: number;
    totalSickLeaveDays: number;
    averageHoursPerEmployee: string;
  };
}

export const AttendanceTabs: React.FC<AttendanceTabsProps> = ({
  summaries,
  dailyCalendar,
  columns,
  selectedEmployee,
  getStatusIcon,
  getAttendanceRateBadge,
  formatPercentage,
  attendanceCategories,
  additionalStats,
}) => {
  const showCalendarTab = selectedEmployee !== 'all';

  return (
    <Tabs defaultValue="summary" className="space-y-4">
      <TabsList className="bg-elevated border border-line p-1 pb-1 flex max-w-md rounded-xl">
        <TabsTrigger
          value="summary"
          className="flex-1 rounded-lg text-dim hover:text-content data-[state=active]:bg-surface data-[state=active]:text-brand data-[state=active]:shadow-sm transition-colors"
        >
          Resumen
        </TabsTrigger>
        {showCalendarTab && (
          <TabsTrigger
            value="calendar"
            className="flex-1 rounded-lg text-dim hover:text-content data-[state=active]:bg-surface data-[state=active]:text-brand data-[state=active]:shadow-sm transition-colors"
          >
            Calendario
          </TabsTrigger>
        )}
        <TabsTrigger
          value="analytics"
          className="flex-1 rounded-lg text-dim hover:text-content data-[state=active]:bg-surface data-[state=active]:text-brand data-[state=active]:shadow-sm transition-colors"
        >
          Análisis
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary">
        <AttendanceSummaryTab
          summaries={summaries}
          columns={columns}
          getAttendanceRateBadge={getAttendanceRateBadge}
          formatPercentage={formatPercentage}
        />
      </TabsContent>

      {showCalendarTab && (
        <TabsContent value="calendar">
          <AttendanceCalendarTab
            calendar={dailyCalendar}
            getStatusIcon={getStatusIcon}
          />
        </TabsContent>
      )}

      <TabsContent value="analytics">
        <AttendanceAnalyticsTab
          categories={attendanceCategories}
          additionalStats={additionalStats}
        />
      </TabsContent>
    </Tabs>
  );
};
