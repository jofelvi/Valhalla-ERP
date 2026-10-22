import { Badge } from '@/components/ui/badge';
import { AttendanceSummary } from '@odin6/types';

export const EmployeeNameCell = (row: AttendanceSummary) => (
  <div>
    <p className="font-medium text-content">{row.employeeName}</p>
    <p className="text-xs text-dim mt-0.5">{row.position}</p>
  </div>
);

export const DepartmentCell = (row: AttendanceSummary) => (
  <Badge variant="outline">{row.department}</Badge>
);

export const PresentDaysCell = (row: AttendanceSummary) => (
  <div className="flex items-center gap-1">
    <span className="font-medium text-ok block w-5 md:w-auto text-right">
      {row.presentDays}
    </span>
    <span className="text-dim">/ {row.workingDays}</span>
  </div>
);

export const AbsentDaysCell = (row: AttendanceSummary) => (
  <div>
    <span className="font-medium text-danger">{row.absentDays}</span>
  </div>
);

export const LateDaysCell = (row: AttendanceSummary) => (
  <div>
    <span className="font-medium text-accent">{row.lateDays}</span>
  </div>
);

export const TotalHoursCell = (row: AttendanceSummary) => (
  <div className="font-medium">{row.totalHours.toFixed(1)}h</div>
);

export const OvertimeHoursCell = (row: AttendanceSummary) => (
  <div className="font-medium text-brand">{row.overtimeHours.toFixed(1)}h</div>
);

export const AttendanceRateCell = (
  row: AttendanceSummary,
  getAttendanceRateBadge: (rate: number) => string,
  formatPercentage: (value: number) => string,
) => (
  <div>
    <Badge className={getAttendanceRateBadge(row.attendanceRate)}>
      {formatPercentage(row.attendanceRate)}
    </Badge>
  </div>
);
