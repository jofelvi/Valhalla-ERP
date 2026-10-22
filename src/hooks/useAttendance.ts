import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/apiClient';
import { Attendance, AttendanceStatusEnum } from '@odin6/types';

export const attendanceKeys = {
  all: ['attendance'] as const,
  lists: () => [...attendanceKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...attendanceKeys.lists(), filters] as const,
  details: () => [...attendanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...attendanceKeys.details(), id] as const,
  byEmployee: (employeeId: string) =>
    [...attendanceKeys.all, 'employee', employeeId] as const,
};

export function useAttendance(
  filters?: Record<string, string | number | boolean | undefined>,
) {
  return useQuery({
    queryKey: attendanceKeys.list(filters),
    queryFn: () => api.get<Attendance[]>('/api/attendance', filters),
  });
}

export function useAttendanceByEmployee(
  employeeId: string,
  filters?: Record<string, unknown>,
) {
  return useQuery({
    queryKey: attendanceKeys.byEmployee(employeeId),
    queryFn: () =>
      api.get<Attendance[]>('/api/attendance', {
        employeeId,
        ...filters,
      } as Record<string, string>),
    enabled: !!employeeId,
  });
}

export function useAttendanceRecord(id: string) {
  return useQuery({
    queryKey: attendanceKeys.detail(id),
    queryFn: () => api.get<Attendance>(`/api/attendance/${id}`),
    enabled: !!id,
  });
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) =>
      api.post('/api/attendance/checkin', { employeeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.lists() });
    },
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) =>
      api.post('/api/attendance/checkout', { employeeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.lists() });
    },
  });
}

export function useUpdateAttendanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: AttendanceStatusEnum;
    }) => api.patch(`/api/attendance/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.lists() });
    },
  });
}

export function useCreateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Attendance>) =>
      api.post('/api/attendance', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.lists() });
    },
  });
}
