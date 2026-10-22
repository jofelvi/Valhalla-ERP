import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Button } from '@/components/shared/button/Button';
import { User, Hash, Phone, Mail, MapPin, Users } from 'lucide-react';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { Customer } from '@/modelTypes/customer';

interface CustomerInfoCardProps {
  accountReceivable: AccountReceivable;
  customer: Customer | null | undefined;
}

export function CustomerInfoCard({
  accountReceivable,
  customer,
}: CustomerInfoCardProps) {
  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50 hover:shadow-xl hover:-translate-y-0">
      <CardHeader className="border-b border-line/50 pb-4">
        <CardTitle className="text-content flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-brand" />
          Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {/* Customer Avatar & Name */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand/20 rounded-full flex items-center justify-center shadow-lg shadow-brand/20">
            <span className="text-brand font-bold text-lg">
              {accountReceivable.customerName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-content text-lg truncate">
              {accountReceivable.customerName}
            </p>
            {customer?.id && (
              <p className="text-xs text-brand truncate">
                ID: {customer.id.slice(0, 10)}
              </p>
            )}
          </div>
        </div>

        {/* Contact Info */}
        {customer && (
          <div className="space-y-3 pt-2 border-t border-line/50">
            {customer.phone && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-ok/20 rounded-lg flex items-center justify-center shrink-0">
                  <Phone className="h-3.5 w-3.5 text-ok" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-brand">Telefono</p>
                  <p className="text-sm font-medium text-content truncate">
                    {customer.phone}
                  </p>
                </div>
              </div>
            )}

            {customer.email && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="h-3.5 w-3.5 text-brand" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-brand">Email</p>
                  <p className="text-sm font-medium text-content truncate">
                    {customer.email}
                  </p>
                </div>
              </div>
            )}

            {customer.identificationType && customer.identificationId && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center shrink-0">
                  <Hash className="h-3.5 w-3.5 text-brand" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-brand">Identificacion</p>
                  <p className="text-sm font-medium text-content">
                    {customer.identificationType}-{customer.identificationId}
                  </p>
                </div>
              </div>
            )}

            {customer.address && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-brand">Direccion</p>
                  <p className="text-sm font-medium text-content truncate">
                    {customer.address}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-3 border-t border-line/50 space-y-2">
          <Link
            href={`/private/accounts-receivable?customerId=${accountReceivable.customerId}`}
          >
            <Button variant="outline" size="sm" className="w-full">
              <Users className="w-4 h-4 mr-1.5" />
              Ver Todas sus Cuentas
            </Button>
          </Link>
          <Link href={`/private/customers/${accountReceivable.customerId}`}>
            <Button variant="ghost" size="sm" className="w-full">
              <User className="w-4 h-4 mr-1.5" />
              Ver Perfil
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
