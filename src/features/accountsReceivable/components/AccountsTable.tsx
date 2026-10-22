'use client';

import type { ColumnDef } from '@tanstack/react-table';
import Table from '@/components/shared/Table';
import { AccountReceivable } from '@/modelTypes/accountReceivable';

interface AccountsTableProps {
  data: AccountReceivable[];
  columns: ColumnDef<AccountReceivable>[];
  onRowMouseEnter: (
    e: React.MouseEvent<HTMLElement>,
    account: AccountReceivable,
  ) => void;
  onRowMouseLeave: () => void;
}

export const AccountsTable = ({
  data,
  columns,
  onRowMouseEnter,
  onRowMouseLeave,
}: AccountsTableProps) => {
  return (
    <div className="hidden md:block bg-surface/90 backdrop-blur-sm shadow-xl rounded-2xl border border-line overflow-hidden w-full">
      <Table
        data={data}
        columns={columns}
        pageSize={20}
        headerStyles="bg-elevated/50 border-b border-line shadow-sm whitespace-nowrap"
        rowStyles="px-3 py-2.5 text-sm text-dim"
        onRowMouseEnter={onRowMouseEnter}
        onRowMouseLeave={onRowMouseLeave}
      />
    </div>
  );
};
