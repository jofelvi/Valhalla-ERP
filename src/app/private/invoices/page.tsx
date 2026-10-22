'use client';
import { useMemo, useState } from 'react';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import Table from '@/components/shared/Table';
import Loader from '@/components/shared/Loader/Loader';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';
import { Calendar, DollarSign, Eye, FileText } from 'lucide-react';
import { PRIVATE_ROUTES } from '@/shared';
import { useInvoices, useCargarFacturaCompleta } from '@/hooks/useInvoices';
import { Invoice } from '@odin6/types';
import { InvoiceStatusEnum } from '@/shared';
import {
  formatDate,
  getStartOfDay,
  getEndOfDay,
} from '@/shared/utils/dateHelpers';
import PDFDownloadButton from '@/features/invoices/PDFDownloadButton';
import { Panel } from '@/components/shared/panel/Panel';
import { CampoDeBusqueda } from '@/components/shared/busqueda/CampoDeBusqueda';
import { CabeceraDePantalla } from '@/components/shared/cabecera/CabeceraDePantalla';

type DateFilter =
  | 'ALL'
  | 'today'
  | 'yesterday'
  | 'last_week'
  | 'this_month'
  | 'custom';

/**
 * El filtro de fecha traducido a la ventana que se le pide al SERVIDOR.
 *
 * Antes esto se hacía en el navegador sobre las 4.735 facturas que la API
 * mandaba enteras (5,2 MB). Ahora `GET /api/invoices` acepta `from`/`to` y
 * tiene tope, así que el recorte va donde están los datos.
 */
function ventanaPedida(
  filtro: DateFilter,
  desde: string,
  hasta: string,
): { from?: string; to?: string } {
  const ahora = new Date();

  switch (filtro) {
    case 'today':
      return {
        from: getStartOfDay(ahora).toISOString(),
        to: getEndOfDay(ahora).toISOString(),
      };
    case 'yesterday': {
      const ayer = new Date(ahora);
      ayer.setDate(ayer.getDate() - 1);
      return {
        from: getStartOfDay(ayer).toISOString(),
        to: getEndOfDay(ayer).toISOString(),
      };
    }
    case 'last_week': {
      const haceUnaSemana = new Date(ahora);
      haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);
      return {
        from: getStartOfDay(haceUnaSemana).toISOString(),
        to: getEndOfDay(ahora).toISOString(),
      };
    }
    case 'this_month':
      return {
        from: getStartOfDay(
          new Date(ahora.getFullYear(), ahora.getMonth(), 1),
        ).toISOString(),
        to: getEndOfDay(ahora).toISOString(),
      };
    case 'custom':
      // Un rango a medio llenar sigue siendo un rango: se manda el extremo que
      // haya. Si no hay ninguno, no se filtra por fecha.
      return {
        from: desde
          ? getStartOfDay(new Date(desde + 'T00:00:00')).toISOString()
          : undefined,
        to: hasta
          ? getEndOfDay(new Date(hasta + 'T00:00:00')).toISOString()
          : undefined,
      };
    default:
      return {};
  }
}

/** El techo del servidor. Pedir más no sirve de nada: lo recorta igual. */
const TOPE_DE_FACTURAS = 2000;

export default function InvoicesPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusEnum | 'ALL'>(
    'ALL',
  );
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const ventana = useMemo(
    () => ventanaPedida(dateFilter, customDateFrom, customDateTo),
    [dateFilter, customDateFrom, customDateTo],
  );

  // `vista: 'lista'` deja fuera `items` —medido en PRE: 1.339.095 de los
  // 2.372.094 bytes de 2.000 facturas, el 56%—. Esta tabla no lo lee ni una
  // vez; el unico que lo necesita es el PDF, y lo pide al pulsarlo.
  const { data: invoices = [], isLoading } = useInvoices({
    ...ventana,
    limit: String(TOPE_DE_FACTURAS),
    vista: 'lista',
  });

  const cargarFacturaCompleta = useCargarFacturaCompleta();

  // Si llegaron exactamente las del tope, hay más que no se están viendo. El
  // truncamiento silencioso es como se rompen los reportes: se dice.
  const hayMasDeLasQueCaben = invoices.length === TOPE_DE_FACTURAS;

  // Búsqueda por texto: número de factura y nombre de cliente
  const sortedAndSearchedInvoices = useBusqueda(
    [...invoices].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    searchQuery,
    ['invoiceNumber', 'customerName'],
  );

  // La fecha ya la filtró el servidor (ver `ventanaPedida`). Aquí solo queda
  // el estado, que no tiene parámetro en la API.
  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'ALL') return sortedAndSearchedInvoices;
    return sortedAndSearchedInvoices.filter(
      (inv) => inv.status === statusFilter,
    );
  }, [statusFilter, sortedAndSearchedInvoices]);

  const getStatusVariant = (status: InvoiceStatusEnum) => {
    switch (status) {
      case InvoiceStatusEnum.PAID:
        return 'success' as const;
      case InvoiceStatusEnum.PENDING:
        return 'warning' as const;
      case InvoiceStatusEnum.OVERDUE:
        return 'destructive' as const;
      case InvoiceStatusEnum.CANCELLED:
        return 'secondary' as const;
      default:
        return 'default' as const;
    }
  };

  const getStatusLabel = (status: InvoiceStatusEnum) => {
    const labels: Record<string, string> = {
      [InvoiceStatusEnum.PAID]: 'Pagada',
      [InvoiceStatusEnum.PENDING]: 'Pendiente',
      [InvoiceStatusEnum.OVERDUE]: 'Vencida',
      [InvoiceStatusEnum.CANCELLED]: 'Cancelada',
      [InvoiceStatusEnum.PARTIALLY_PAID]: 'Parcial',
    };
    return labels[status] || status;
  };

  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: 'invoiceNumber',
      header: 'Factura',
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-content text-sm">
          #{row.getValue('invoiceNumber')}
        </span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Cliente',
      cell: ({ row }) => (
        <span className="text-sm text-content">
          {row.getValue('customerName') || 'Sin cliente'}
        </span>
      ),
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => (
        <span className="font-semibold text-ok">
          ${((row.getValue('total') as number) || 0).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const s = row.getValue('status') as InvoiceStatusEnum;
        return <Badge variant={getStatusVariant(s)}>{getStatusLabel(s)}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="text-sm text-dim">
          {row.getValue('createdAt')
            ? formatDate(row.getValue('createdAt'))
            : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-dim hover:text-brand"
            onClick={() =>
              router.push(PRIVATE_ROUTES.INVOICES_DETAILS(row.original.id))
            }
          >
            <Eye className="h-4 w-4" />
          </Button>
          <PDFDownloadButton
            invoice={row.original}
            cargarFactura={() => cargarFacturaCompleta(row.original.id)}
            variant="ghost"
            size="sm"
            showPreview={false}
          />
        </div>
      ),
    },
  ];

  const totalInvoices = filteredInvoices.length;
  const paidInvoices = filteredInvoices.filter(
    (i) => i.status === InvoiceStatusEnum.PAID,
  ).length;
  const pendingInvoices = filteredInvoices.filter(
    (i) => i.status === InvoiceStatusEnum.PENDING,
  ).length;
  const overdueInvoices = filteredInvoices.filter(
    (i) => i.status === InvoiceStatusEnum.OVERDUE,
  ).length;
  const totalRevenue = filteredInvoices
    .filter((i) => i.status === InvoiceStatusEnum.PAID)
    .reduce((sum, i) => sum + (i.total || 0), 0);

  if (isLoading) return <Loader fullScreen text="Cargando facturas..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header */}
        <CabeceraDePantalla
          icono={<FileText className="h-4 w-4 text-brand" />}
          titulo="Facturas"
          subtitulo={
            <>
              {totalInvoices} facturas · {paidInvoices} pagadas
            </>
          }
        />

        {/* Filtros */}
        <Panel className="p-3 mb-3">
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <CampoDeBusqueda
                className="flex-1"
                valor={searchQuery}
                onCambio={setSearchQuery}
                placeholder="Buscar por numero o cliente..."
              />
              <div className="flex gap-2 shrink-0">
                <SelectCustom
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(val) =>
                    setStatusFilter(val as InvoiceStatusEnum | 'ALL')
                  }
                  options={[
                    { value: 'ALL', label: 'Todos' },
                    { value: InvoiceStatusEnum.PAID, label: 'Pagadas' },
                    { value: InvoiceStatusEnum.PENDING, label: 'Pendientes' },
                    { value: InvoiceStatusEnum.OVERDUE, label: 'Vencidas' },
                    { value: InvoiceStatusEnum.CANCELLED, label: 'Canceladas' },
                  ]}
                  selectClassName="h-[34px] min-w-[120px]"
                />
                <SelectCustom
                  id="dateFilter"
                  value={dateFilter}
                  onChange={(val) => {
                    setDateFilter(val as DateFilter);
                    if (val !== 'custom') {
                      setCustomDateFrom('');
                      setCustomDateTo('');
                    }
                  }}
                  options={[
                    { value: 'ALL', label: 'Todas las fechas' },
                    { value: 'today', label: 'Hoy' },
                    { value: 'yesterday', label: 'Ayer' },
                    { value: 'last_week', label: 'Ultimos 7 dias' },
                    { value: 'this_month', label: 'Este mes' },
                    { value: 'custom', label: 'Personalizado' },
                  ]}
                  selectClassName="h-[34px] min-w-[140px]"
                />
              </div>
            </div>
            {dateFilter === 'custom' && (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-dim">Desde:</span>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="h-[34px] px-3 text-sm border border-line rounded-xl bg-surface/90 text-content focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
                <span className="text-xs text-dim">Hasta:</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="h-[34px] px-3 text-sm border border-line rounded-xl bg-surface/90 text-content focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>
            )}
            {hayMasDeLasQueCaben && (
              <p className="text-xs text-warn">
                Se están mostrando las{' '}
                {TOPE_DE_FACTURAS.toLocaleString('es-VE')} facturas más
                recientes de este rango. Hay más: acotá la fecha para verlas
                todas.
              </p>
            )}
          </div>
        </Panel>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-3">
          <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-line/50">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-brand/15 rounded-lg flex items-center justify-center">
                <FileText className="h-3.5 w-3.5 text-brand" />
              </div>
              <span className="text-xs text-dim">Total</span>
            </div>
            <p className="text-xl font-bold text-content">{totalInvoices}</p>
          </div>
          <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-ok/30">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-ok/15 rounded-lg flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 text-ok" />
              </div>
              <span className="text-xs text-dim">Pagadas</span>
            </div>
            <p className="text-xl font-bold text-ok">{paidInvoices}</p>
          </div>
          <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-accent/30">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-accent/15 rounded-lg flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-accent" />
              </div>
              <span className="text-xs text-dim">Pendientes</span>
            </div>
            <p className="text-xl font-bold text-accent">{pendingInvoices}</p>
          </div>
          <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-danger/30">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-danger/15 rounded-lg flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-danger" />
              </div>
              <span className="text-xs text-dim">Vencidas</span>
            </div>
            <p className="text-xl font-bold text-danger">{overdueInvoices}</p>
          </div>
          <div className="bg-surface/90 backdrop-blur-sm rounded-xl p-3.5 shadow-sm border border-ok/30">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-ok/15 rounded-lg flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 text-ok" />
              </div>
              <span className="text-xs text-dim">Ingresos</span>
            </div>
            <p className="text-xl font-bold text-ok">
              ${totalRevenue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="hidden md:block">
          <Table data={filteredInvoices} columns={columns} />
        </div>

        {/* Mobile cards */}
        <div className="space-y-2 md:hidden">
          {filteredInvoices.length === 0 ? (
            <div className="bg-surface/90 rounded-xl border border-line/50 shadow-sm text-center py-12">
              <FileText className="h-10 w-10 text-dim mx-auto mb-3" />
              <p className="text-content font-semibold mb-1">Sin facturas</p>
              <p className="text-dim text-sm">
                No se encontraron facturas con estos filtros
              </p>
            </div>
          ) : (
            filteredInvoices.slice(0, 50).map((inv) => (
              <Panel
                key={inv.id}
                className="p-3.5"
                onClick={() =>
                  router.push(PRIVATE_ROUTES.INVOICES_DETAILS(inv.id))
                }
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono font-bold text-content text-sm">
                    #{inv.invoiceNumber}
                  </span>
                  <Badge
                    variant={getStatusVariant(inv.status)}
                    className="text-[10px]"
                  >
                    {getStatusLabel(inv.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-dim">
                    {inv.customerName || 'Sin cliente'}
                  </span>
                  <span className="font-semibold text-ok text-sm">
                    ${(inv.total || 0).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-dim mt-1">
                  {inv.createdAt ? formatDate(inv.createdAt) : '—'}
                </div>
              </Panel>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
