'use client';
import React, { useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { MdKeyboardArrowDown, MdKeyboardArrowUp } from 'react-icons/md';
import { cn } from '@/shared/utils/utils';

interface TableProps<T extends object> {
  data: T[];
  columns: ColumnDef<T>[];
  pageSize?: number;
  headerStyles?: string;
  bodyStyles?: string;
  rowStyles?: string;
  onRowMouseEnter?: (e: React.MouseEvent<HTMLTableRowElement>, row: T) => void;
  onRowMouseLeave?: () => void;
}

const Table = <T extends object>({
  data,
  columns,
  pageSize = 20,
  headerStyles = 'bg-surface border-b border-line sticky top-0 z-10',
  bodyStyles = 'bg-surface',
  rowStyles,
  onRowMouseEnter,
  onRowMouseLeave,
}: TableProps<T>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const mergeClassNameRowStyles = cn(
    'px-6 py-4 text-sm text-dim whitespace-nowrap',
    rowStyles,
  );
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize,
        pageIndex: 0,
      },
    },
  });

  return (
    <div className="w-full bg-surface border border-line rounded-xl shadow-sm overflow-x-auto">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden rounded-xl">
          <table className="min-w-full">
            <thead className={headerStyles}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => (
                    <th
                      key={header.id}
                      className="px-6 py-3.5 text-sm font-semibold text-content cursor-pointer"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div
                        className={`flex items-center ${
                          index === headerGroup.headers.length - 1
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() && (
                          <span className="ml-2 relative">
                            {header.column.getIsSorted() === 'desc' ? (
                              <MdKeyboardArrowDown className="h-4 w-4" />
                            ) : (
                              <MdKeyboardArrowUp className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className={`${bodyStyles} `}>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-0 hover:bg-elevated/50 transition-colors"
                  onMouseEnter={
                    onRowMouseEnter
                      ? (e) => onRowMouseEnter(e, row.original)
                      : undefined
                  }
                  onMouseLeave={onRowMouseLeave}
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <td key={cell.id} className={mergeClassNameRowStyles}>
                      <div
                        className={`flex ${
                          index === row.getVisibleCells().length - 1
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginación */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between border-t border-line px-6 py-3">
              <span className="text-sm text-dim">
                Página {table.getState().pagination.pageIndex + 1} de{' '}
                {table.getPageCount()} ({data.length} registros)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => table.firstPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="px-2 py-1 text-sm rounded border border-line disabled:opacity-40 disabled:cursor-not-allowed hover:bg-elevated"
                >
                  {'«'}
                </button>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="px-3 py-1 text-sm rounded border border-line disabled:opacity-40 disabled:cursor-not-allowed hover:bg-elevated"
                >
                  Anterior
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="px-3 py-1 text-sm rounded border border-line disabled:opacity-40 disabled:cursor-not-allowed hover:bg-elevated"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => table.lastPage()}
                  disabled={!table.getCanNextPage()}
                  className="px-2 py-1 text-sm rounded border border-line disabled:opacity-40 disabled:cursor-not-allowed hover:bg-elevated"
                >
                  {'»'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Table;
