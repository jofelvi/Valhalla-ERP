import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogOutIcon } from 'lucide-react';
import { UseAuthCheckoutReturn } from '../hooks';

interface AuthStepProps {
  auth: UseAuthCheckoutReturn;
  loading: boolean;
  onAuthenticate: () => Promise<void>;
}

/**
 * Step de autenticación - empleado ingresa su ID y PIN
 */
export const AuthStep = ({ auth, loading, onAuthenticate }: AuthStepProps) => {
  const router = useRouter();

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-accent/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <LogOutIcon className="h-8 w-8 text-accent" />
        </div>
        <CardTitle className="text-2xl">Registro de Salida</CardTitle>
        <p className="text-dim">Verifica tu identidad para registrar salida</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="employeeId">ID de Empleado</Label>
          <Input
            id="employeeId"
            type="text"
            placeholder="Ingresa tu ID"
            value={auth.employeeId}
            onChange={(e) => auth.setEmployeeId(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="pin">PIN de Seguridad</Label>
          <Input
            id="pin"
            type="password"
            placeholder="Ingresa tu PIN"
            value={auth.pin}
            onChange={(e) => auth.setPin(e.target.value)}
            className="mt-1"
          />
        </div>

        <Button onClick={onAuthenticate} disabled={loading} className="w-full">
          {loading ? 'Verificando...' : 'Verificar Identidad'}
        </Button>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => router.push('/private/employees')}
            className="text-sm"
          >
            Volver al Panel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
