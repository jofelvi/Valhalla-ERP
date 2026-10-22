import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api/apiClient';

interface PublicAccountData {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paidAmount: number;
  pending: number;
  dueDate: string;
  status: string;
}

export function useAccountData(id: string) {
  const [account, setAccount] = useState<PublicAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      setLoading(true);
      const cuenta = await api.get<PublicAccountData>(
        `/api/public/accounts-receivable/${id}`,
      );
      setAccount(cuenta);
      return cuenta;
    } catch (err) {
      setError(
        err instanceof Error && /404|not found/i.test(err.message)
          ? 'No se pudo cargar la cuenta'
          : 'Error de conexion al cargar la cuenta',
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  return { account, loading, error };
}
