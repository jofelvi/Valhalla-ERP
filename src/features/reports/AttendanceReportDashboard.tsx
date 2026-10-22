'use client';

import { useActiveEmployees } from '@/hooks/useEmployees';
import { useAttendanceReportData } from './hooks/useAttendanceReportData';
import { useAttendanceCalculations } from './hooks/useAttendanceCalculations';
import { useAttendanceTableColumns } from './hooks/useAttendanceTableColumns';
import { AttendanceHeader } from './components/AttendanceHeader';
import { AttendanceFilters } from './components/AttendanceFilters';
import { AttendanceStatsGrid } from './components/AttendanceStatsGrid';
import { AttendanceTabs } from './components/AttendanceTabs';

export default function AttendanceReportDashboard() {
  const { data: employeesData = [] } = useActiveEmployees();

  const {
    attendanceSummaries,
    dailyCalendar,
    loading,
    error,
    filters,
    setFilters,
    getDepartments,
  } = useAttendanceReportData({ employeesData });

  const {
    overallStats,
    getAttendanceRateColor,
    getAttendanceRateBadge,
    getStatusIcon,
    formatPercentage,
    attendanceCategories,
    additionalStats,
  } = useAttendanceCalculations(attendanceSummaries);

  const columns = useAttendanceTableColumns({
    getAttendanceRateBadge,
    formatPercentage,
  });

  const handleMonthChange = (month: number) => {
    setFilters((prev) => ({ ...prev, selectedMonth: month }));
  };

  const handleYearChange = (year: number) => {
    setFilters((prev) => ({ ...prev, selectedYear: year }));
  };

  const handleEmployeeChange = (employeeId: string) => {
    setFilters((prev) => ({ ...prev, selectedEmployee: employeeId }));
  };

  const handleDepartmentChange = (department: string) => {
    setFilters((prev) => ({ ...prev, selectedDepartment: department }));
  };

  return (
    <div className="space-y-6">
      <AttendanceHeader />

      {error && (
        <div className="bg-danger/10 border border-danger rounded-md p-4">
          <p className="text-danger">{error}</p>
        </div>
      )}

      <AttendanceFilters
        selectedMonth={filters.selectedMonth}
        onMonthChange={handleMonthChange}
        selectedYear={filters.selectedYear}
        onYearChange={handleYearChange}
        selectedEmployee={filters.selectedEmployee}
        onEmployeeChange={handleEmployeeChange}
        selectedDepartment={filters.selectedDepartment}
        onDepartmentChange={handleDepartmentChange}
        employees={employeesData}
        departments={getDepartments()}
      />

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
        </div>
      ) : (
        <>
          <AttendanceStatsGrid
            stats={overallStats}
            getAttendanceRateColor={getAttendanceRateColor}
            formatPercentage={formatPercentage}
          />

          <AttendanceTabs
            summaries={attendanceSummaries}
            dailyCalendar={dailyCalendar}
            columns={columns}
            selectedEmployee={filters.selectedEmployee}
            getStatusIcon={getStatusIcon}
            getAttendanceRateBadge={getAttendanceRateBadge}
            formatPercentage={formatPercentage}
            attendanceCategories={attendanceCategories}
            additionalStats={additionalStats}
          />
        </>
      )}
    </div>
  );
}
