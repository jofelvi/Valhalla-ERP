'use client';

import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';

// Pagina de diagnostico: replica el patron minimo de pos/order
// (useSearchParams + useForm con defaultValues) SIN los componentes
// pesados, los watch, los useEffect pesados, ni los hooks de query.
// Objetivo: ver si los <Link> del sidebar navegan desde esta pagina.
// - Si navegan: el bug esta en el codigo especifico de pos/order
//   (watch, useEffect, ProductSelector, OrderSummary, etc.)
// - Si NO navegan: el bug esta en el patron useSearchParams + useForm
//   + algun otro factor global.

export default function TestNavPage() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get('tableId');
  const orderId = searchParams.get('orderId');

  useForm({
    defaultValues: {
      tableId: tableId || null,
      orderId: orderId || null,
      items: [] as unknown[],
      subtotal: 0,
      total: 0,
    },
  });

  return (
    <div className="min-h-screen p-8 bg-page">
      <h1 className="text-2xl font-bold text-content mb-4">Test Nav</h1>
      <div className="space-y-2 text-dim">
        <p>tableId: {tableId ?? '(none)'}</p>
        <p>orderId: {orderId ?? '(none)'}</p>
        <p className="mt-4">
          Desde aqui, intenta click en cualquier link del sidebar.
          <br />
          Si navega: el bug NO es useSearchParams + useForm por si solo.
          <br />
          Si NO navega: confirmamos que el patron es el culpable.
        </p>
      </div>
    </div>
  );
}
