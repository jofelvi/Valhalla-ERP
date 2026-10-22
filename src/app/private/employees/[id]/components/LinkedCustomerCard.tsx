import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LinkIcon, UserSearchIcon } from 'lucide-react';
import { useCustomer } from '@/hooks/useCustomers';

interface LinkedCustomerCardProps {
  customerId: string | undefined;
  onOpenLinkModal: () => void;
}

const CustomerLinkedName = ({ customerId }: { customerId: string }) => {
  // Pide LA ficha, no las 2.955. Antes esta tarjeta —que muestra un nombre—
  // se bajaba 1,16 MB para hacer un `.find()` en el navegador.
  const { data: customer } = useCustomer(customerId);
  return (
    <p className="text-sm font-medium text-ok">
      {customer ? customer.name : customerId}
    </p>
  );
};

export const LinkedCustomerCard = ({
  customerId,
  onOpenLinkModal,
}: LinkedCustomerCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-brand" />
          Cuenta de Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {customerId ? (
          <div className="p-2.5 rounded-lg bg-ok/10 border border-ok/20">
            <p className="text-xs text-ok/70">Cliente vinculado</p>
            <CustomerLinkedName customerId={customerId} />
          </div>
        ) : (
          <p className="text-xs text-dim">Sin cuenta vinculada</p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={onOpenLinkModal}
        >
          <UserSearchIcon className="h-4 w-4 mr-2" />
          {customerId ? 'Cambiar cliente' : 'Vincular cliente'}
        </Button>
      </CardContent>
    </Card>
  );
};
