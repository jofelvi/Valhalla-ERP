import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardIcon } from 'lucide-react';
import { Employee } from '@odin6/types';

interface ObservationsCardProps {
  employee: Employee;
}

export const ObservationsCard = ({ employee }: ObservationsCardProps) => {
  if (!employee.observations) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardIcon className="h-5 w-5 text-brand" />
          Observaciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-3 rounded-lg bg-elevated/50">
          <p className="text-sm text-content whitespace-pre-wrap leading-relaxed">
            {employee.observations}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
