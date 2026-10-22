// Configuración de estados de asistencia

import { AttendanceStatusEnum } from '@/shared';

export interface StatusConfig {
  color: string;
  label: string;
}

export const STATUS_CONFIG: Record<AttendanceStatusEnum, StatusConfig> = {
  [AttendanceStatusEnum.PRESENT]: {
    color: 'bg-ok/15 text-ok',
    label: 'Presente',
  },
  [AttendanceStatusEnum.LATE]: {
    color: 'bg-accent/15 text-accent',
    label: 'Tarde',
  },
  [AttendanceStatusEnum.EARLY_DEPARTURE]: {
    color: 'bg-accent/15 text-accent',
    label: 'Salida Temprana',
  },
  [AttendanceStatusEnum.ABSENT]: {
    color: 'bg-danger/10 text-danger',
    label: 'Ausente',
  },
  [AttendanceStatusEnum.HOLIDAY]: {
    color: 'bg-brand/15 text-brand',
    label: 'Feriado',
  },
  [AttendanceStatusEnum.SICK_LEAVE]: {
    color: 'bg-brand/15 text-brand',
    label: 'Reposo Médico',
  },
  [AttendanceStatusEnum.VACATION]: {
    color: 'bg-elevated text-content',
    label: 'Vacaciones',
  },
  [AttendanceStatusEnum.MEDICALREST]: {
    color: 'bg-brand/15 text-brand',
    label: 'Reposo Médico',
  },
};

export const getStatusConfig = (status: AttendanceStatusEnum): StatusConfig => {
  return STATUS_CONFIG[status] || STATUS_CONFIG[AttendanceStatusEnum.PRESENT];
};
