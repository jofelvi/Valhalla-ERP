import { Badge } from '@/components/ui/badge';
import { AttendanceStatusEnum } from '@/shared';
import { getStatusConfig } from '../utils';

interface StatusBadgeProps {
  status: AttendanceStatusEnum;
}

/**
 * Badge que muestra el estado de asistencia con color adecuado
 */
export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = getStatusConfig(status);

  return <Badge className={`${config.color} border-0`}>{config.label}</Badge>;
};
