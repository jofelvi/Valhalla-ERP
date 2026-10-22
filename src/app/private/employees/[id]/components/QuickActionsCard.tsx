import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClockIcon, CalculatorIcon, EditIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface QuickActionsCardProps {
  employeeId: string;
  onEdit: () => void;
}

export const QuickActionsCard = ({
  employeeId,
  onEdit,
}: QuickActionsCardProps) => {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acciones Rapidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() =>
            router.push(`/private/employees/${employeeId}/attendance`)
          }
        >
          <ClockIcon className="h-4 w-4 mr-2" />
          Ver Asistencias
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() =>
            router.push(`/private/employees/${employeeId}/payroll`)
          }
        >
          <CalculatorIcon className="h-4 w-4 mr-2" />
          Ver Nomina
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onEdit}
        >
          <EditIcon className="h-4 w-4 mr-2" />
          Editar Empleado
        </Button>
      </CardContent>
    </Card>
  );
};
