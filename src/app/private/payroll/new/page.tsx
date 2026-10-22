'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from 'lucide-react';
import PayrollForm from '@/features/payroll/PayrollForm';
import { PRIVATE_ROUTES } from '@/shared';

export default function NewPayrollPage() {
  const router = useRouter();

  // Al guardar mandaba a `/private/payroll/<id>`, una ruta que no existe:
  // el unico detalle de nomina es `/private/payroll/mesonero/<employeeId>`.
  // Quien registraba una nomina caia en un 404 con el trabajo ya guardado.
  const handleSuccess = () => {
    router.push(PRIVATE_ROUTES.PAYROLL);
  };

  const handleCancel = () => {
    router.push(PRIVATE_ROUTES.PAYROLL);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => router.push(PRIVATE_ROUTES.PAYROLL)}
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nueva Nómina</h1>
          <p className="text-dim">
            Calcula y registra una nueva nómina de empleado
          </p>
        </div>
      </div>

      <PayrollForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}
