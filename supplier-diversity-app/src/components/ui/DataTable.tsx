import { useState, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor: keyof T | string;
  render?: (value: unknown, row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

type SortDir = 'asc' | 'desc' | null;

function getNestedValue<T extends Record<string, unknown>>(obj: T, accessor: string): unknown {
  return accessor.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function sortData<T extends Record<string, unknown>>(
  data: T[],
  accessor: string,
  dir: SortDir,
): T[] {
  if (!dir) return data;
  return [...data].sort((a, b) => {
    const aVal = getNestedValue(a, accessor);
    const bVal = getNestedValue(b, accessor);

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    const cmp = aVal < bVal ? -1 : 1;
    return dir === 'asc' ? cmp : -cmp;
  });
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available.',
  className = '',
}: DataTableProps<T>) {
  const [sortAccessor, setSortAccessor] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (accessor: string) => {
    if (sortAccessor !== accessor) {
      setSortAccessor(accessor);
      setSortDir('asc');
    } else {
      setSortDir((prev) => {
        if (prev === 'asc') return 'desc';
        if (prev === 'desc') {
          setSortAccessor(null);
          return null;
        }
        return 'asc';
      });
    }
  };

  const sortedData =
    sortAccessor && sortDir ? sortData(data, sortAccessor, sortDir) : data;

  return (
    <div
      className={['w-full overflow-x-auto rounded-xl border', className].filter(Boolean).join(' ')}
      style={{ borderColor: 'var(--color-border)' }}
    >
      <table className="w-full border-collapse text-sm" style={{ minWidth: '600px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            {columns.map((col) => {
              const acc = String(col.accessor);
              const isSorted = sortAccessor === acc;
              const isSortable = col.sortable !== false;

              return (
                <th
                  key={acc}
                  onClick={isSortable ? () => handleSort(acc) : undefined}
                  className={[
                    'px-4 py-3 text-left font-semibold select-none whitespace-nowrap',
                    isSortable ? 'cursor-pointer' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-secondary)',
                    width: col.width,
                  }}
                  aria-sort={
                    isSorted
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {isSortable && (
                      <span
                        className="inline-flex"
                        style={{ color: isSorted ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                        aria-hidden="true"
                      >
                        {isSorted && sortDir === 'asc' ? (
                          <ChevronUp size={14} />
                        ) : isSorted && sortDir === 'desc' ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronsUpDown size={14} />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : ''}
                style={{
                  backgroundColor:
                    rowIndex % 2 === 0 ? 'var(--color-bg)' : 'var(--color-bg-secondary)',
                  borderBottom: '1px solid var(--color-border)',
                  transition: 'background-color 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      'var(--color-bg-tertiary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (onRowClick) {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      rowIndex % 2 === 0
                        ? 'var(--color-bg)'
                        : 'var(--color-bg-secondary)';
                  }
                }}
              >
                {columns.map((col) => {
                  const acc = String(col.accessor);
                  const rawValue = getNestedValue(row, acc);
                  const cellContent = col.render ? col.render(rawValue, row) : String(rawValue ?? '');

                  return (
                    <td
                      key={acc}
                      className="px-4 py-3"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
