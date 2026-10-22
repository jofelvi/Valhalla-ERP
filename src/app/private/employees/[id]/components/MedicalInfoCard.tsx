import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartPulseIcon, AlertTriangleIcon, DropletIcon } from 'lucide-react';
import { Employee } from '@odin6/types';

interface MedicalInfoCardProps {
  employee: Employee;
}

export const MedicalInfoCard = ({ employee }: MedicalInfoCardProps) => {
  const hasMedicalInfo =
    employee.medicalInfo &&
    (employee.medicalInfo.bloodType ||
      employee.medicalInfo.allergies ||
      employee.medicalInfo.conditions ||
      employee.medicalInfo.notes);

  if (!hasMedicalInfo) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulseIcon className="h-5 w-5 text-brand" />
          Informacion Medica
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {employee.medicalInfo?.bloodType && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-danger/10 border border-danger/20">
              <div className="w-10 h-10 rounded-full bg-danger/15 flex items-center justify-center shrink-0">
                <DropletIcon className="h-5 w-5 text-danger" />
              </div>
              <div>
                <p className="text-xs text-danger/70">Grupo Sanguineo</p>
                <p className="text-lg font-bold text-danger">
                  {employee.medicalInfo.bloodType}
                </p>
              </div>
            </div>
          )}

          {employee.medicalInfo?.allergies && (
            <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20">
              <p className="text-xs text-accent/70 flex items-center gap-1">
                <AlertTriangleIcon className="h-3 w-3" />
                Alergias
              </p>
              <p className="text-sm font-medium text-accent mt-0.5">
                {employee.medicalInfo.allergies}
              </p>
            </div>
          )}

          {employee.medicalInfo?.conditions && (
            <div className="p-2.5 rounded-lg bg-elevated/50">
              <p className="text-xs text-brand/70">Condiciones Cronicas</p>
              <p className="text-sm font-medium text-content mt-0.5">
                {employee.medicalInfo.conditions}
              </p>
            </div>
          )}

          {employee.medicalInfo?.notes && (
            <div className="p-2.5 rounded-lg bg-elevated/50">
              <p className="text-xs text-brand/70">Notas Medicas</p>
              <p className="text-sm font-medium text-content mt-0.5">
                {employee.medicalInfo.notes}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
