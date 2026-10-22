import {
  CreatePayrollData,
  PayrollCalculation,
  PayrollReport,
  PayrollSettings,
  PayrollSummary,
} from '@odin6/types';
import { PayrollStatusEnum } from '@/shared';
import { api } from '@/services/api/apiClient';
import { Employee } from '@odin6/types';
import { Payroll } from '@odin6/types';

// API-based service wrappers
const employeeService = {
  getById: (id: string) => api.get<Employee>(`/api/employees/${id}`),
};
const getEmployeePayrollByPeriod = (
  empId: string,
  month: number,
  year: number,
) =>
  api.get<Payroll[]>('/api/payroll', {
    employeeId: empId,
    month: String(month),
    year: String(year),
  });
const payrollService = {
  create: (data: CreatePayrollData) => api.post<Payroll>('/api/payroll', data),
  update: (id: string, data: Partial<Payroll>) =>
    api.patch<Payroll>(`/api/payroll/${id}`, data),
  getById: (id: string) => api.get<Payroll>(`/api/payroll/${id}`),
  getAll: () => api.get<Payroll[]>('/api/payroll'),
};
import {
  AttendanceReportService,
  attendanceReportService,
} from './attendanceService';

// Valores neutros: las retenciones de ley salen de nomina.deductions (Ajustes → Nómina)
const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  taxRate: 0,
  socialSecurityRate: 0,
  insuranceRate: 0,
  overtimeRate: 1.5, // 1.5x for overtime
  standardWorkHours: 8,
  workingDaysPerMonth: 22, // Average working days
  minimumWage: 130, // Minimum wage in USD (approximate)
  vacationDaysPay: true,
  holidayPay: true,
};

export class PayrollCalculationService {
  private settings: PayrollSettings;
  private attendanceService: AttendanceReportService;

  constructor(settings?: Partial<PayrollSettings>) {
    this.settings = { ...DEFAULT_PAYROLL_SETTINGS, ...settings };
    this.attendanceService = attendanceReportService;
  }

  /**
   * Calculate payroll for a specific employee and period
   */
  async calculateEmployeePayroll(
    employeeId: string,
    month: number,
    year: number,
    additionalData?: {
      bonuses?: number;
      commissions?: number;
      additionalDeductions?: number;
    },
  ): Promise<PayrollCalculation | null> {
    try {
      const employee = await employeeService.getById(employeeId);
      if (!employee) return null;

      // Get attendance data for the period
      const attendanceSummary =
        await this.attendanceService.generateEmployeeAttendanceSummary(
          employeeId,
          month,
          year,
        );

      if (!attendanceSummary) return null;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Calculate base salary and hours
      const hoursWorked = attendanceSummary.totalHours;
      const regularHours = attendanceSummary.regularHours;
      const overtimeHours = attendanceSummary.overtimeHours;

      // Calculate salary features
      const baseSalaryAmount = this.calculateBaseSalary(
        employee.salary,
        attendanceSummary.presentDays,
        attendanceSummary.workingDays,
      );

      const overtimePay = this.calculateOvertimePay(
        employee.salary,
        overtimeHours,
      );

      const bonuses = additionalData?.bonuses || 0;
      const commissions = additionalData?.commissions || 0;

      // Calculate gross pay
      const grossPay = baseSalaryAmount + overtimePay + bonuses + commissions;

      // Calculate deductions
      const taxes = this.calculateTaxes(grossPay);
      const socialSecurity = this.calculateSocialSecurity(grossPay);
      const insurance = this.calculateInsurance(grossPay);
      const otherDeductions = additionalData?.additionalDeductions || 0;

      const totalDeductions =
        taxes + socialSecurity + insurance + otherDeductions;
      const netPay = grossPay - totalDeductions;

      const payrollCalculation: PayrollCalculation = {
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        position: employee.position,
        department: employee.department,
        period: {
          month,
          year,
          startDate,
          endDate,
        },
        baseSalary: employee.salary,
        hoursWorked,
        regularHours,
        overtimeHours,
        overtimeRate: this.settings.overtimeRate,
        salary: {
          baseSalary: baseSalaryAmount,
          overtime: overtimePay,
          bonuses,
          commissions,
        },
        grossPay,
        deductions: {
          taxes,
          socialSecurity,
          insurance,
          other: otherDeductions,
        },
        totalDeductions,
        netPay,
        attendanceSummary: {
          workingDays: attendanceSummary.workingDays,
          presentDays: attendanceSummary.presentDays,
          absentDays: attendanceSummary.absentDays,
          attendanceRate: attendanceSummary.attendanceRate,
        },
      };

      return payrollCalculation;
    } catch (error) {
      console.error('Error calculating payroll:', error);
      throw error;
    }
  }

  /**
   * Create and save payroll record
   */
  async createPayroll(payrollCalculation: PayrollCalculation): Promise<string> {
    try {
      const payrollData: CreatePayrollData = {
        employeeId: payrollCalculation.employeeId,
        period: {
          startDate: payrollCalculation.period.startDate,
          endDate: payrollCalculation.period.endDate,
          month: payrollCalculation.period.month,
          year: payrollCalculation.period.year,
        },
        salary: {
          baseSalary: payrollCalculation.salary.baseSalary,
          overtime: payrollCalculation.salary.overtime,
          bonuses: payrollCalculation.salary.bonuses,
          commissions: payrollCalculation.salary.commissions,
        },
        deductions: {
          taxes: payrollCalculation.deductions.taxes,
          socialSecurity: payrollCalculation.deductions.socialSecurity,
          insurance: payrollCalculation.deductions.insurance,
          other: payrollCalculation.deductions.other,
        },
        hoursWorked: payrollCalculation.hoursWorked,
        overtimeHours: payrollCalculation.overtimeHours,
      };

      const createdPayroll = await payrollService.create({
        employeeId: payrollData.employeeId,
        period: payrollData.period,
        salary: {
          baseSalary: payrollData.salary.baseSalary,
          overtime: payrollData.salary.overtime ?? 0,
          bonuses: payrollData.salary.bonuses ?? 0,
          commissions: payrollData.salary.commissions ?? 0,
        },
        deductions: {
          taxes: payrollData.deductions?.taxes ?? 0,
          socialSecurity: payrollData.deductions?.socialSecurity ?? 0,
          insurance: payrollData.deductions?.insurance ?? 0,
          other: payrollData.deductions?.other ?? 0,
        },
        hoursWorked: payrollData.hoursWorked,
        overtimeHours: payrollData.overtimeHours ?? 0,
        grossPay: payrollCalculation.grossPay,
        netPay: payrollCalculation.netPay,
        status: PayrollStatusEnum.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return createdPayroll.id;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate payroll summary for multiple employees
   */
  async generatePayrollSummary(
    employeeIds: string[],
    month: number,
    year: number,
  ): Promise<PayrollSummary> {
    try {
      const payrollCalculations: PayrollCalculation[] = [];

      for (const employeeId of employeeIds) {
        const calculation = await this.calculateEmployeePayroll(
          employeeId,
          month,
          year,
        );
        if (calculation) {
          payrollCalculations.push(calculation);
        }
      }

      const totalEmployees = payrollCalculations.length;
      const totalGrossPay = payrollCalculations.reduce(
        (sum, p) => sum + p.grossPay,
        0,
      );
      const totalDeductions = payrollCalculations.reduce(
        (sum, p) => sum + p.totalDeductions,
        0,
      );
      const totalNetPay = payrollCalculations.reduce(
        (sum, p) => sum + p.netPay,
        0,
      );
      const totalOvertimeHours = payrollCalculations.reduce(
        (sum, p) => sum + p.overtimeHours,
        0,
      );
      const averageSalary =
        totalEmployees > 0 ? totalNetPay / totalEmployees : 0;

      // Group by department
      const departmentMap = new Map<
        string,
        {
          employeeCount: number;
          totalGrossPay: number;
          totalNetPay: number;
        }
      >();

      payrollCalculations.forEach((calc) => {
        const dept = departmentMap.get(calc.department) || {
          employeeCount: 0,
          totalGrossPay: 0,
          totalNetPay: 0,
        };

        dept.employeeCount++;
        dept.totalGrossPay += calc.grossPay;
        dept.totalNetPay += calc.netPay;

        departmentMap.set(calc.department, dept);
      });

      const departmentBreakdown = Array.from(departmentMap.entries()).map(
        ([department, data]) => ({
          department,
          ...data,
        }),
      );

      return {
        totalEmployees,
        totalGrossPay,
        totalDeductions,
        totalNetPay,
        totalOvertimeHours,
        averageSalary,
        payrollStatus: PayrollStatusEnum.DRAFT,
        period: { month, year },
        departmentBreakdown,
      };
    } catch (error) {
      console.error('Error generating payroll summary:', error);
      throw error;
    }
  }

  /**
   * Generate detailed payroll report for an employee
   */
  async generatePayrollReport(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<PayrollReport | null> {
    try {
      const employee = await employeeService.getById(employeeId);
      if (!employee) return null;

      const payrollCalculation = await this.calculateEmployeePayroll(
        employeeId,
        month,
        year,
      );
      if (!payrollCalculation) return null;

      const attendanceSummary =
        await this.attendanceService.generateEmployeeAttendanceSummary(
          employeeId,
          month,
          year,
        );

      if (!attendanceSummary) return null;

      // Get previous month's payroll for comparison
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const previousPayrollList = await getEmployeePayrollByPeriod(
        employeeId,
        prevMonth,
        prevYear,
      );

      let previousPayrollData;
      const previousPayroll =
        previousPayrollList && previousPayrollList.length > 0
          ? previousPayrollList[0]
          : null;
      if (previousPayroll) {
        const change = payrollCalculation.netPay - previousPayroll.netPay;
        const changePercentage =
          previousPayroll.netPay > 0
            ? (change / previousPayroll.netPay) * 100
            : 0;

        previousPayrollData = {
          grossPay: previousPayroll.grossPay,
          netPay: previousPayroll.netPay,
          change,
          changePercentage,
        };
      }

      const report: PayrollReport = {
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          position: employee.position,
          department: employee.department,
          hireDate: employee.hireDate,
        },
        period: payrollCalculation.period,
        payroll: payrollCalculation,
        attendance: {
          totalDays: attendanceSummary.workingDays,
          presentDays: attendanceSummary.presentDays,
          absentDays: attendanceSummary.absentDays,
          totalHours: attendanceSummary.totalHours,
          overtimeHours: attendanceSummary.overtimeHours,
        },
        previousPayroll: previousPayrollData,
      };

      return report;
    } catch (error) {
      console.error('Error generating payroll report:', error);
      throw error;
    }
  }

  // Private calculation methods

  private calculateBaseSalary(
    monthlySalary: number,
    presentDays: number,
    workingDays: number,
  ): number {
    if (workingDays === 0) return 0;
    return (monthlySalary / workingDays) * presentDays;
  }

  private calculateOvertimePay(
    monthlySalary: number,
    overtimeHours: number,
  ): number {
    const hourlyRate =
      monthlySalary /
      (this.settings.workingDaysPerMonth * this.settings.standardWorkHours);
    return hourlyRate * this.settings.overtimeRate * overtimeHours;
  }

  private calculateTaxes(grossPay: number): number {
    // Simplified progressive tax calculation
    if (grossPay <= this.settings.minimumWage * 3) {
      return 0; // No tax for low income
    }
    return grossPay * (this.settings.taxRate / 100);
  }

  private calculateSocialSecurity(grossPay: number): number {
    return grossPay * (this.settings.socialSecurityRate / 100);
  }

  private calculateInsurance(grossPay: number): number {
    return grossPay * (this.settings.insuranceRate / 100);
  }

  /**
   * Update payroll settings
   */
  updateSettings(newSettings: Partial<PayrollSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current payroll settings
   */
  getSettings(): PayrollSettings {
    return { ...this.settings };
  }
}

export const payrollCalculationService = new PayrollCalculationService();
