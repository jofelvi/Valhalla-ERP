import { Table } from '@/modelTypes/table';
import { Order } from '@/modelTypes/order';
import { User } from '@/modelTypes/user';
import TarjetaDeMesa from './TarjetaDeMesa';
import { MapPin } from 'lucide-react';

interface MapaDeMesasProps {
  tables: Array<Table & { currentOrder?: Order | null }>;
  allUsers: User[];
  currentUserRole?: string;
  onTransferTable: (table: Table & { currentOrder?: Order | null }) => void;
  onResetTable?: (table: Table & { currentOrder?: Order | null }) => void;
  onAliasEdit: (order: Order) => void;
  onTableClick: (table: Table & { currentOrder?: Order | null }) => void;
}

export default function MapaDeMesas({
  tables,
  allUsers,
  currentUserRole,
  onTransferTable,
  onResetTable,
  onAliasEdit,
  onTableClick,
}: MapaDeMesasProps) {
  return (
    <div>
      <h2 className="text-lg font-bold text-content mb-3 flex items-center">
        <MapPin className="w-5 h-5 mr-1.5 text-brand" />
        Mesas
      </h2>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
        {tables.map((table) => (
          <TarjetaDeMesa
            key={table.id}
            table={table}
            allUsers={allUsers}
            currentUserRole={currentUserRole}
            onTransfer={() => onTransferTable(table)}
            onReset={onResetTable ? () => onResetTable(table) : undefined}
            onAliasEdit={onAliasEdit}
            onClick={() => onTableClick(table)}
          />
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-elevated border border-line rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-12 h-12 text-dim" />
          </div>
          <h3 className="text-xl font-semibold text-content mb-2">
            No hay mesas configuradas
          </h3>
          <p className="text-dim max-w-md mx-auto">
            No se encontraron mesas en el sistema.
          </p>
        </div>
      )}
    </div>
  );
}
