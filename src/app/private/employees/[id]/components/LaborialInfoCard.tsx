import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BriefcaseIcon, DollarSignIcon } from 'lucide-react';
import { Employee } from '@odin6/types';
import { formatearUsd } from '@/shared/utils/dinero';
import { formatDate } from '../utils/formatters';

interface LaborialInfoCardProps {
  employee: Employee;
}

export const LaborialInfoCard = ({ employee }: LaborialInfoCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BriefcaseIcon className="h-5 w-5 text-brand" />
          Informacion Laboral
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-2.5 rounded-lg bg-elevated/50">
            <p className="text-xs text-brand/70">Cargo</p>
            <p className="text-sm font-medium text-content">
              {employee.position}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-elevated/50">
            <p className="text-xs text-brand/70">Departamento</p>
            <p className="text-sm font-medium text-content">
              {employee.department}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-elevated/50">
            <p className="text-xs text-brand/70">Fecha de Contratacion</p>
            <p className="text-sm font-medium text-content">
              {formatDate(employee.hireDate)}
            </p>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gradient-to-r from-page to-elevated">
            <DollarSignIcon className="h-4 w-4 text-brand" />
            <div>
              <p className="text-xs text-brand/70">Salario</p>
              <p className="text-sm font-semibold text-content">
                {formatearUsd(employee.salary)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
