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

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

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

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack returns functions the React Compiler cannot memoise; it skips this component, which behaves the same without it
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
        <div className="flex justify-end px-4 py-3 border-b border-[#E3E8EE]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-[#E3E8EE] text-[#5B6A78] gap-1"
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
              <TableRow key={hg.id} className="bg-[#F9FAFC] border-b border-[#E3E8EE]">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className="text-xs font-medium text-[#5B6A78] py-3 first:pl-6 last:pr-6"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="inline-flex items-center gap-1 hover:text-[#41505F] transition-colors"
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
              range(8).map((row) => (
                <TableRow key={row} className="border-b border-[#E3E8EE]">
                  {range(columns.length).map((col) => (
                    <TableCell key={col} className="py-3.5 first:pl-6 last:pr-6">
                      <div className="h-4 bg-[#F9FAFC] rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-16 text-center text-sm text-[#5B6A78]"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-[#E3E8EE] hover:bg-[#F9FAFC] transition-colors"
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 border-t border-[#E3E8EE]">
          <span className="text-xs text-[#5B6A78]">
            {totalCount != null
              ? `${pageRowCount ?? data.length} of ${totalCount.toLocaleString("en-GB")} records`
              : `${pageRowCount ?? data.length} records`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 border-[#E3E8EE] text-[#5B6A78] disabled:opacity-40"
              onClick={onPreviousPage}
              disabled={!hasPreviousPage}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 border-[#E3E8EE] text-[#5B6A78] disabled:opacity-40"
              onClick={onNextPage}
              disabled={!hasNextPage}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
