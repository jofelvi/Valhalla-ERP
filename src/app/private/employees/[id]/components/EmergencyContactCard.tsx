import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactIcon } from 'lucide-react';
import { Employee } from '@odin6/types';

interface EmergencyContactCardProps {
  employee: Employee;
}

export const EmergencyContactCard = ({
  employee,
}: EmergencyContactCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ContactIcon className="h-5 w-5 text-brand" />
          Contacto de Emergencia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-2.5 rounded-lg bg-elevated/50">
            <p className="text-xs text-brand/70">Nombre</p>
            <p className="text-sm font-medium text-content">
              {employee.emergencyContact?.name || '—'}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-elevated/50">
            <p className="text-xs text-brand/70">Telefono</p>
            <p className="text-sm font-medium text-content">
              {employee.emergencyContact?.phone || '—'}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-elevated/50">
            <p className="text-xs text-brand/70">Relacion</p>
            <p className="text-sm font-medium text-content">
              {employee.emergencyContact?.relationship || '—'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
