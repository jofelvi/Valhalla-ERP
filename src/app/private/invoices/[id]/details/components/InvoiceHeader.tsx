'use client';
import Link from 'next/link';
import { ArrowLeft, Eye, Printer } from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared';
import { Invoice } from '@odin6/types';
import { Customer } from '@odin6/types';
import PDFDownloadButton from '@/features/invoices/PDFDownloadButton';

interface InvoiceHeaderProps {
  invoice: Invoice;
  customer: Customer | null | undefined;
  isReprinting: boolean;
  onReprint: () => void;
}

export const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({
  invoice,
  customer,
  isReprinting,
  onReprint,
}) => {
  return (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-brand to-brand/80 bg-clip-text text-transparent">
          Detalle de Factura
        </h1>
        <p className="text-brand/80 mt-1">
          Factura #{invoice.invoiceNumber || invoice.id}
        </p>
      </div>
      <div className="flex space-x-3">
        <Button
          variant="outline"
          onClick={onReprint}
          disabled={isReprinting}
          className="border-accent text-accent hover:bg-accent/10"
        >
          <Printer className="w-4 h-4 mr-2" />
          {isReprinting ? 'Imprimiendo...' : 'Reimprimir Factura'}
        </Button>
        <PDFDownloadButton invoice={invoice} customer={customer} />
        <Button variant="outline" onClick={() => window.print()}>
          <Eye className="w-4 h-4 mr-2" />
          Vista Previa
        </Button>
        <Link href={PRIVATE_ROUTES.INVOICES}>
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
      </div>
    </div>
  );
};
