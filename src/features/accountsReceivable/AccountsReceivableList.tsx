'use client';

import { useSession } from 'next-auth/react';
import { UserRoleEnum } from '@odin6/types';
import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { useAccountsSelection } from './hooks/useAccountsSelection';
import { useAccountsMerge } from './hooks/useAccountsMerge';
import { useAccountsDelete } from './hooks/useAccountsDelete';
import { useHoverPreview } from './hooks/useHoverPreview';
import { useTableColumns } from './hooks/useTableColumns';
import { AccountsMobileCard } from './components/AccountsMobileCard';
import { AccountsTable } from './components/AccountsTable';
import { AccountsHoverPreview } from './components/AccountsHoverPreview';
import { AccountsSelectionBar } from './components/AccountsSelectionBar';
import { AccountsMergeModal } from './components/AccountsMergeModal';
import { AccountsDeleteModal } from './components/AccountsDeleteModal';

interface AccountsReceivableListProps {
  accounts: AccountReceivable[];
  tab: string;
}

export default function AccountsReceivableList({
  accounts,
  tab,
}: AccountsReceivableListProps) {
  const { data: session } = useSession();
  // Borrar una cuenta por cobrar es solo del administrador.
  const isSuperAdmin = session?.user?.role === UserRoleEnum.ADMIN;
  const canSelect = tab !== 'history';

  const selection = useAccountsSelection(accounts, canSelect);
  const merge = useAccountsMerge(
    selection.selected,
    selection.selectedAccounts,
  );
  const deleteState = useAccountsDelete();
  const hover = useHoverPreview();

  const columns = useTableColumns({
    canSelect,
    selected: selection.selected,
    selectableIds: selection.selectableIds,
    allSelected: selection.allSelected,
    someSelected: selection.someSelected,
    onToggle: selection.toggle,
    onToggleAll: selection.toggleAll,
    onDelete: deleteState.setDeleteTarget,
    isSuperAdmin,
  });

  return (
    <>
      <div className="relative">
        {/* VISTA MOBILE: Tarjetas */}
        <div className="md:hidden space-y-3 pb-28">
          {accounts.map((receivable) => (
            <AccountsMobileCard
              key={receivable.id}
              receivable={receivable}
              isSelected={selection.selected.has(receivable.id)}
              selectable={canSelect && !receivable.isMerged}
              canSelect={canSelect}
              isSuperAdmin={isSuperAdmin}
              onToggle={selection.toggle}
              onDelete={deleteState.setDeleteTarget}
            />
          ))}
        </div>

        {/* VISTA DESKTOP: Tabla */}
        <AccountsTable
          data={accounts}
          columns={columns}
          onRowMouseEnter={hover.handleRowEnter}
          onRowMouseLeave={hover.handleRowLeave}
        />
      </div>

      {/* Hover Preview */}
      {hover.hoverPreview && (
        <AccountsHoverPreview
          account={hover.hoverPreview.account}
          items={hover.hoverPreview.items}
          totalItems={hover.hoverPreview.totalItems}
          loading={hover.hoverPreview.loading}
          position={hover.tooltipPos}
        />
      )}

      {/* Barra flotante de selección */}
      {selection.selected.size > 0 && (
        <AccountsSelectionBar
          selectedCount={selection.selected.size}
          canMerge={selection.canMerge}
          isMerging={merge.isMerging}
          onMerge={merge.openMergeModal}
          onClear={() => selection.setSelected(new Set())}
        />
      )}

      {/* Modal de Merge */}
      <AccountsMergeModal
        isOpen={merge.showMergeModal}
        selectedCount={selection.selected.size}
        selectedAccounts={merge.selectedAccounts}
        mergeNames={merge.mergeNames}
        mergeTotal={merge.mergeTotal}
        mergeError={merge.mergeError}
        isMerging={merge.isMerging}
        onClose={() => merge.setShowMergeModal(false)}
        onConfirm={merge.confirmMerge}
      />

      {/* Modal de Delete */}
      <AccountsDeleteModal
        deleteTarget={deleteState.deleteTarget}
        deleteAccountMutation={deleteState.deleteAccountMutation}
        onClose={() => deleteState.setDeleteTarget(null)}
        onConfirm={deleteState.handleDeleteConfirm}
      />
    </>
  );
}
