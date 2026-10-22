import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api/apiClient';
import { PRIVATE_ROUTES } from '@/shared';
import { InvoiceDetailData } from '../types';

/**
 * Hook para cargar detalles de factura desde la API.
 * Redirige a la lista de facturas si no encuentra la factura.
 */
export const useLoadInvoiceDetails = (invoiceId: string) => {
  const router = useRouter();
  const [invoiceDetails, setInvoiceDetails] =
    useState<InvoiceDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInvoiceDetails = async () => {
      try {
        const details = await api.get<InvoiceDetailData>(
          `/api/invoices/${invoiceId}/details`,
        );
        if (!details) {
          router.push(PRIVATE_ROUTES.INVOICES);
          return;
        }

        setInvoiceDetails(details);
      } catch (error) {
        console.error('Error loading invoice details:', error);
        router.push(PRIVATE_ROUTES.INVOICES);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInvoiceDetails();
  }, [invoiceId, router]);

  return { invoiceDetails, isLoading };
};
