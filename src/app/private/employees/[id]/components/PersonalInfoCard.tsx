import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MailIcon, PhoneIcon, MapPinIcon, UserIcon } from 'lucide-react';
import { Employee } from '@odin6/types';

interface PersonalInfoCardProps {
  employee: Employee;
}

export const PersonalInfoCard = ({ employee }: PersonalInfoCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-brand" />
          Informacion Personal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-content">
            {employee.firstName} {employee.lastName}
          </h2>
          <Badge variant={employee.isActive ? 'success' : 'secondary'}>
            {employee.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-elevated/50">
            <MailIcon className="h-4 w-4 text-brand shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-brand/70">Email</p>
              <p className="text-sm font-medium text-content truncate">
                {employee.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-elevated/50">
            <PhoneIcon className="h-4 w-4 text-brand shrink-0" />
            <div>
              <p className="text-xs text-brand/70">Telefono</p>
              <p className="text-sm font-medium text-content">
                {employee.phone}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-elevated/50 md:col-span-2">
            <MapPinIcon className="h-4 w-4 text-brand mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-brand/70">Direccion</p>
              <p className="text-sm font-medium text-content">
                {employee.address}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
