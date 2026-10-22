import { Search } from 'lucide-react';
import { getMethodLabel } from '../utils/verifyPaymentsUtils';

interface VerifyPaymentsFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterWaiter: string;
  onWaiterChange: (waiter: string) => void;
  filterMethod: string;
  onMethodChange: (method: string) => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  waiterOptions: Array<[string, string]>;
  methodOptions: string[];
}

export const VerifyPaymentsFilters = ({
  searchTerm,
  onSearchChange,
  filterWaiter,
  onWaiterChange,
  filterMethod,
  onMethodChange,
  hasActiveFilter,
  onClearFilters,
  waiterOptions,
  methodOptions,
}: VerifyPaymentsFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-surface border border-line rounded-lg">
      <div className="flex items-center gap-1 flex-1 min-w-[180px]">
        <Search className="w-4 h-4 text-dim" />
        <input
          type="text"
          placeholder="Buscar mesa, mesonero u orden..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 px-2 py-1.5 text-sm bg-transparent text-content placeholder:text-dim focus:outline-none"
        />
      </div>
      <select
        value={filterWaiter}
        onChange={(e) => onWaiterChange(e.target.value)}
        className="px-3 py-1.5 text-sm bg-elevated border border-line rounded-lg text-content focus:border-accent focus:outline-none"
      >
        <option value="all">Todos los mesoneros</option>
        {waiterOptions.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={filterMethod}
        onChange={(e) => onMethodChange(e.target.value)}
        className="px-3 py-1.5 text-sm bg-elevated border border-line rounded-lg text-content focus:border-accent focus:outline-none"
      >
        <option value="all">Todos los pagos</option>
        {methodOptions.map((m) => (
          <option key={m} value={m}>
            {getMethodLabel(m)}
          </option>
        ))}
      </select>
      {hasActiveFilter && (
        <button
          type="button"
          onClick={onClearFilters}
          className="px-3 py-1.5 text-xs text-dim hover:text-content underline"
        >
          Limpiar
        </button>
      )}
    </div>
  );
};
