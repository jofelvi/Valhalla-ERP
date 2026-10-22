import { redirect } from 'next/navigation';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';

// Comisiones se unificó dentro de Nómina. Mantener el link viejo funcionando.
export default function ComisionesRedirect() {
  redirect(PRIVATE_ROUTES.PAYROLL);
}
