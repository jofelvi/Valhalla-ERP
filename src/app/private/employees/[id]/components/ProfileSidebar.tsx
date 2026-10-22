import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Employee } from '@odin6/types';
import { formatearUsd } from '@/shared/utils/dinero';
import { formatDate, getInitials } from '../utils/formatters';

interface ProfileSidebarProps {
  employee: Employee;
}

export const ProfileSidebar = ({ employee }: ProfileSidebarProps) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center">
          {employee.photoUrl ? (
            <img
              src={employee.photoUrl}
              alt={`${employee.firstName} ${employee.lastName}`}
              className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border-4 border-white shadow-lg ring-2 ring-brand/20"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-brand/15 flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg ring-2 ring-brand/20">
              <span className="text-3xl font-bold text-dim">
                {getInitials(employee.firstName, employee.lastName)}
              </span>
            </div>
          )}
          <h3 className="font-semibold text-lg text-content">
            {employee.firstName} {employee.lastName}
          </h3>
          <p className="text-dim font-medium">{employee.position}</p>
          <p className="text-sm text-brand/70">{employee.department}</p>
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-brand/70">Estado</span>
            <Badge variant={employee.isActive ? 'success' : 'secondary'}>
              {employee.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-brand/70">Salario</span>
            <span className="font-semibold text-content">
              {formatearUsd(employee.salary)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-brand/70">Ingreso</span>
            <span className="text-sm text-content">
              {formatDate(employee.hireDate)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-brand/70">Registro</span>
            <span className="text-sm text-content">
              {formatDate(employee.createdAt)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
