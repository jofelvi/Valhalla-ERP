'use client';
import { Mail, MapPin, Phone, User } from 'lucide-react';
import { Invoice } from '@odin6/types';
import { Customer } from '@odin6/types';
import { User as UserModel } from '@odin6/types';

interface CustomerInfoSectionProps {
  invoice: Invoice;
  customer: Customer | null | undefined;
  user: UserModel | null | undefined;
}

export const CustomerInfoSection: React.FC<CustomerInfoSectionProps> = ({
  invoice,
  customer,
  user,
}) => {
  return (
    <div className="bg-gradient-to-br from-page to-elevated p-6 rounded-xl border border-line">
      <h3 className="text-lg font-semibold text-content mb-4">
        Información del Cliente
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand to-brand/80 rounded-lg flex items-center justify-center">
            <User className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand mb-1">
              Nombre del Cliente
            </p>
            <p className="font-semibold text-content text-lg">
              {invoice.customerName ||
                customer?.name ||
                'Cliente no especificado'}
            </p>
            {invoice.customerRif && (
              <p className="text-sm font-medium text-dim mt-1">
                RIF: {invoice.customerRif}
              </p>
            )}
            {customer?.id && (
              <p className="text-xs text-brand mt-1">
                ID: {customer.id.slice(0, 8)}
              </p>
            )}
            {user && (
              <p className="text-xs text-brand mt-1">
                Atendido por: {user.name}
              </p>
            )}
          </div>
        </div>

        {customer?.email && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand to-brand/70 rounded-lg flex items-center justify-center">
              <Mail className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand mb-1">Email</p>
              <p className="font-semibold text-content">{customer.email}</p>
            </div>
          </div>
        )}

        {customer?.phone && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-ok to-ok/80 rounded-lg flex items-center justify-center">
              <Phone className="h-5 w-5 text-ok" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand mb-1">Teléfono</p>
              <p className="font-semibold text-content">{customer.phone}</p>
            </div>
          </div>
        )}

        {customer?.address && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-accent to-brand rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-on-brand" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand mb-1">Dirección</p>
              <p className="font-semibold text-content">{customer.address}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
