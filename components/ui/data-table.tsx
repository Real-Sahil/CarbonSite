"use client";

import * as React from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  totalCount?: number;
  pageRowCount?: number;
  emptyMessage?: string;
  showColumnVisibility?: boolean;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  // Row selection (controlled externally)
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  getRowId?: (row: TData) => string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  onPreviousPage,
  onNextPage,
  hasPreviousPage = false,
  hasNextPage = false,
  totalCount,
  pageRowCount,
  emptyMessage = "No results.",
  showColumnVisibility = false,
  sorting: externalSorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);
  const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const sorting = externalSorting ?? internalSorting;
  const selection = rowSelection ?? internalRowSelection;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: Boolean(onRowSelectionChange),
    onRowSelectionChange: onRowSelectionChange
      ? (updater) => {
          const next = typeof updater === "function" ? updater(selection) : updater;
          onRowSelectionChange(next);
        }
      : (updater) => {
          const next = typeof updater === "function" ? updater(internalRowSelection) : updater;
          setInternalRowSelection(next);
        },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (onSortingChange) onSortingChange(next);
      else setInternalSorting(next);
    },
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnVisibility, rowSelection: selection },
    manualSorting: Boolean(onSortingChange),
    ...(getRowId ? { getRowId } : {}),
  });

  return (
    <div>
      {showColumnVisibility && (
        <div className="flex justify-end px-4 py-3 border-b border-[#E5E7EB]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-[#E5E7EB] text-[#6B7280] gap-1"
              >
                Columns <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    className="capitalize text-xs"
                    checked={col.getIsVisible()}
                    onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  >
                    {typeof col.columnDef.header === "string"
                      ? col.columnDef.header
                      : col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className="text-xs font-medium text-[#9CA3AF] py-3 first:pl-6 last:pr-6"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="inline-flex items-center gap-1 hover:text-[#374151] transition-colors"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ChevronsUpDown className="h-3 w-3 opacity-50" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="border-b border-[#F3F4F6]">
                  {columns.map((_, j) => (
                    <TableCell key={j} className="py-3.5 first:pl-6 last:pr-6">
                      <div className="h-4 bg-[#F3F4F6] rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-16 text-center text-sm text-[#9CA3AF]"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="py-3.5 first:pl-6 last:pr-6"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(onPreviousPage || onNextPage) && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#E5E7EB]">
          <span className="text-xs text-[#9CA3AF]">
            {totalCount != null
              ? `${pageRowCount ?? data.length} of ${totalCount.toLocaleString("en-GB")} records`
              : `${pageRowCount ?? data.length} records`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 border-[#E5E7EB] text-[#6B7280] disabled:opacity-40"
              onClick={onPreviousPage}
              disabled={!hasPreviousPage}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 border-[#E5E7EB] text-[#6B7280] disabled:opacity-40"
              onClick={onNextPage}
              disabled={!hasNextPage}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
