'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/button/Button';
import { Printer } from 'lucide-react';
import { printPrecuenta } from '@/features/pos/services/thermalPrintService';
import { useDatosDeImpresion } from '@/features/pos/hooks/useDatosDeImpresion';
import { Order } from '@/modelTypes/order';

interface PrintPrecuentaButtonProps {
  order: Order;
  customerName?: string;
}

export default function PrintPrecuentaButton({
  order,
  customerName,
}: PrintPrecuentaButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const datos = useDatosDeImpresion();

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const result = await printPrecuenta(order, {
        waiterName: customerName,
        datos,
      });
      if (!result.success) {
        alert(result.error || 'Error al imprimir');
      }
    } catch {
      alert('No se pudo conectar al servicio de impresion');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      disabled={isPrinting}
    >
      <Printer
        className={`w-4 h-4 mr-1.5 ${isPrinting ? 'animate-spin' : ''}`}
      />
      {isPrinting ? 'Imprimiendo...' : 'Precuenta'}
    </Button>
  );
}
