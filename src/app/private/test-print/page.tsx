'use client';

import { useState, useEffect } from 'react';
import { useNegocio, useNombreApp } from '@/shared/config';
import {
  Printer,
  ChefHat,
  Wine,
  Receipt,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

const PRINT_SERVICE_URL = 'http://127.0.0.1:6441';

interface PrinterStatus {
  receipt: string;
  kitchen: string;
  bar: string;
}

interface TestResult {
  label: string;
  success: boolean;
  message: string;
}

export default function TestPrintPage() {
  const negocio = useNegocio();
  const nombre = useNombreApp();
  const [serviceStatus, setServiceStatus] = useState<
    'checking' | 'online' | 'offline'
  >('checking');
  const [printers, setPrinters] = useState<PrinterStatus | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    checkService();
  }, []);

  async function checkService() {
    setServiceStatus('checking');
    try {
      const res = await fetch(`${PRINT_SERVICE_URL}/status`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as { printers: PrinterStatus };
        setPrinters(data.printers);
        setServiceStatus('online');
      } else {
        setServiceStatus('offline');
      }
    } catch {
      setServiceStatus('offline');
    }
  }

  function addResult(result: TestResult) {
    setResults((prev) => [result, ...prev]);
  }

  async function testComanda() {
    setLoading('comanda');
    try {
      const payload = {
        orderNumber: 'TEST-' + Date.now().toString().slice(-4),
        date: new Date().toLocaleDateString('es-VE'),
        time: new Date().toLocaleTimeString('es-VE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        table: 'Mesa 5',
        orderType: 'En mesa',
        items: [
          {
            quantity: 2,
            name: 'Pizza Margherita',
            notes: 'Sin picante',
            station: 'KITCHEN',
          },
          {
            quantity: 1,
            name: 'Hamburguesa BBQ',
            notes: null,
            station: 'KITCHEN',
          },
          {
            quantity: 3,
            name: 'Tobo de Cerveza',
            notes: 'Bien fria',
            station: 'BAR',
          },
          { quantity: 2, name: 'Refresco Cola', notes: null, station: 'BAR' },
        ],
      };

      const res = await fetch(`${PRINT_SERVICE_URL}/print-comanda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      const data = (await res.json()) as {
        message: string;
        kitchenItems: number;
        barItems: number;
      };
      if (res.ok) {
        addResult({
          label: 'Comanda (cocina + barra)',
          success: true,
          message: `${data.message} | Cocina: ${data.kitchenItems} items, Barra: ${data.barItems} items`,
        });
      } else {
        addResult({
          label: 'Comanda',
          success: false,
          message: JSON.stringify(data),
        });
      }
    } catch (err) {
      addResult({ label: 'Comanda', success: false, message: String(err) });
    } finally {
      setLoading(null);
    }
  }

  async function testReceipt() {
    setLoading('receipt');
    try {
      const payload = {
        businessName: negocio.tradeName,
        businessSubtitle: 'Restaurante & Bar',
        address: negocio.address,
        phone: negocio.phone,
        rif: negocio.taxId,
        orderNumber: 'TEST-' + Date.now().toString().slice(-4),
        date: new Date().toLocaleDateString('es-VE'),
        time: new Date().toLocaleTimeString('es-VE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        table: 'Mesa 5',
        orderType: 'En mesa',
        items: [
          {
            quantity: 2,
            name: 'Pizza Margherita',
            unitPrice: 12.0,
            total: 24.0,
          },
          { quantity: 1, name: 'Hamburguesa BBQ', unitPrice: 8.5, total: 8.5 },
          { quantity: 3, name: 'Tobo de Cerveza', unitPrice: 5.0, total: 15.0 },
        ],
        subtotal: 47.5,
        tax: 0,
        total: 47.5,
        currency: 'USD',
        payments: [
          { method: 'CASH_USD', methodLabel: 'Efectivo USD', amount: 47.5 },
        ],
        footerMessage: 'Gracias por su preferencia!',
        footerBrand: `${nombre} POS`,
      };

      const res = await fetch(`${PRINT_SERVICE_URL}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      const data = (await res.json()) as { message: string };
      if (res.ok) {
        addResult({ label: 'Factura', success: true, message: data.message });
      } else {
        addResult({
          label: 'Factura',
          success: false,
          message: JSON.stringify(data),
        });
      }
    } catch (err) {
      addResult({ label: 'Factura', success: false, message: String(err) });
    } finally {
      setLoading(null);
    }
  }

  async function testAll() {
    await testComanda();
    await testReceipt();
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-content flex items-center gap-2">
          <Printer className="w-7 h-7 text-brand" />
          Test de Impresión
        </h1>
        <p className="text-dim text-sm mt-1">
          Prueba la conexión con el servidor de impresión local (127.0.0.1:6441)
        </p>
      </div>

      {/* Estado del servicio */}
      <div
        className={`rounded-xl border p-4 mb-6 flex items-center justify-between ${
          serviceStatus === 'online'
            ? 'bg-ok/10 border-ok/30'
            : serviceStatus === 'offline'
              ? 'bg-danger/10 border-danger/30'
              : 'bg-elevated border-line'
        }`}
      >
        <div className="flex items-center gap-3">
          {serviceStatus === 'online' && <Wifi className="w-5 h-5 text-ok" />}
          {serviceStatus === 'offline' && (
            <WifiOff className="w-5 h-5 text-danger" />
          )}
          {serviceStatus === 'checking' && (
            <Loader2 className="w-5 h-5 text-dim animate-spin" />
          )}
          <div>
            <p className="font-semibold text-sm">
              {serviceStatus === 'online' && 'Servicio activo'}
              {serviceStatus === 'offline' &&
                'Servicio no disponible — ejecuta start.bat'}
              {serviceStatus === 'checking' && 'Verificando...'}
            </p>
            {printers && (
              <p className="text-xs text-dim mt-0.5">
                Factura: <span className="font-mono">{printers.receipt}</span> ·
                Cocina: <span className="font-mono">{printers.kitchen}</span> ·
                Barra: <span className="font-mono">{printers.bar}</span>
              </p>
            )}
          </div>
        </div>
        <button
          onClick={checkService}
          className="text-xs text-dim hover:text-dim underline"
        >
          Verificar de nuevo
        </button>
      </div>

      {/* Botones de prueba */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        {/* Comanda completa */}
        <button
          onClick={testComanda}
          disabled={serviceStatus !== 'online' || loading !== null}
          className="flex items-center gap-4 p-5 rounded-xl border-2 border-accent/30 bg-accent/10 hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-left"
        >
          <div className="flex gap-2">
            <ChefHat className="w-8 h-8 text-accent" />
            <Wine className="w-8 h-8 text-accent" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-content">Comanda: Cocina + Barra</p>
            <p className="text-sm text-brand">
              2x Pizza, 1x Hamburguesa →{' '}
              <span className="font-mono text-accent">POS-COCINA</span>
              <br />
              3x Cerveza, 2x Refresco →{' '}
              <span className="font-mono text-accent">
                {printers?.bar ?? 'BAR'}
              </span>
            </p>
          </div>
          {loading === 'comanda' && (
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
          )}
        </button>

        {/* Factura */}
        <button
          onClick={testReceipt}
          disabled={serviceStatus !== 'online' || loading !== null}
          className="flex items-center gap-4 p-5 rounded-xl border-2 border-brand/30 bg-brand/10 hover:bg-brand/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-left"
        >
          <Receipt className="w-8 h-8 text-brand" />
          <div className="flex-1">
            <p className="font-bold text-content">Factura de prueba</p>
            <p className="text-sm text-brand">
              Total: $47.50 →{' '}
              <span className="font-mono text-brand-light">
                {printers?.receipt ?? 'RECEIPT'}
              </span>
            </p>
          </div>
          {loading === 'receipt' && (
            <Loader2 className="w-5 h-5 animate-spin text-brand" />
          )}
        </button>

        {/* Todo junto */}
        <button
          onClick={testAll}
          disabled={serviceStatus !== 'online' || loading !== null}
          className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-line bg-elevated hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-dim"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          Imprimir todo a la vez
        </button>
      </div>

      {/* Log de resultados */}
      {results.length > 0 && (
        <div className="rounded-xl border border-line overflow-hidden">
          <div className="bg-elevated px-4 py-2 text-sm font-semibold text-dim">
            Resultados
          </div>
          <div className="divide-y divide-line">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                {r.success ? (
                  <CheckCircle className="w-5 h-5 text-ok flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-sm text-content">{r.label}</p>
                  <p className="text-xs text-dim mt-0.5">{r.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
