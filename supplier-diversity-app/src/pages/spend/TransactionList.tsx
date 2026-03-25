import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { useAppContext } from '@/store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import type { Transaction } from '@/types';

// ---------------------------------------------------------------------------
// Tier badge
// ---------------------------------------------------------------------------

const TIER_VARIANT = {
  1: 'blue',
  2: 'green',
  3: 'yellow',
} as const satisfies Record<1 | 2 | 3, 'blue' | 'green' | 'yellow'>;

// ---------------------------------------------------------------------------
// Row shape for DataTable
// ---------------------------------------------------------------------------

interface TransactionRow extends Record<string, unknown> {
  id: string;
  date: string;
  supplierName: string;
  projectName: string;
  tier: 1 | 2 | 3;
  amount: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionList() {
  const { state } = useAppContext();
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | '1' | '2' | '3'>('all');
  const [searchText, setSearchText] = useState('');

  const supplierMap = useMemo(
    () => new Map(state.suppliers.map((s) => [s.id, s.companyName])),
    [state.suppliers]
  );

  const projectMap = useMemo(
    () => new Map(state.projects.map((p) => [p.id, p.name])),
    [state.projects]
  );

  const filteredRows = useMemo<TransactionRow[]>(() => {
    return state.transactions
      .filter((t: Transaction) => {
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        if (supplierId && t.supplierId !== supplierId) return false;
        if (projectId && t.projectId !== projectId) return false;
        if (tierFilter !== 'all' && String(t.tier) !== tierFilter) return false;
        if (
          searchText &&
          !t.description.toLowerCase().includes(searchText.toLowerCase())
        )
          return false;
        return true;
      })
      .map((t: Transaction) => ({
        id: t.id,
        date: t.date,
        supplierName: supplierMap.get(t.supplierId) ?? t.supplierId,
        projectName: projectMap.get(t.projectId) ?? t.projectId,
        tier: t.tier,
        amount: t.amount,
        description: t.description,
      }));
  }, [
    state.transactions,
    dateFrom,
    dateTo,
    supplierId,
    projectId,
    tierFilter,
    searchText,
    supplierMap,
    projectMap,
  ]);

  const totalAmount = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.amount, 0),
    [filteredRows]
  );

  const columns: Column<TransactionRow>[] = [
    {
      header: 'Date',
      accessor: 'date',
      sortable: true,
      render: (value) => formatDate(String(value)),
    },
    {
      header: 'Supplier',
      accessor: 'supplierName',
      sortable: true,
    },
    {
      header: 'Project',
      accessor: 'projectName',
      sortable: true,
    },
    {
      header: 'Tier',
      accessor: 'tier',
      sortable: true,
      render: (value) => {
        const tier = value as 1 | 2 | 3;
        return (
          <Badge variant={TIER_VARIANT[tier]}>T{tier}</Badge>
        );
      },
    },
    {
      header: 'Amount',
      accessor: 'amount',
      sortable: true,
      render: (value) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(value as number)}
        </span>
      ),
    },
    {
      header: 'Description',
      accessor: 'description',
      sortable: false,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          Transactions
        </h1>
        <Button
          leftIcon={<Plus size={16} />}
          onClick={() => navigate('/spend/new')}
        >
          Add Transaction
        </Button>
      </div>

      {/* Filter bar */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Supplier filter */}
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Supplier
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            >
              <option value="">All Suppliers</option>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Project filter */}
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            >
              <option value="">All Projects</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tier filter */}
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Filter size={12} className="inline mr-1" aria-hidden="true" />
              Tier
            </label>
            <select
              value={tierFilter}
              onChange={(e) =>
                setTierFilter(e.target.value as 'all' | '1' | '2' | '3')
              }
              className="px-3 py-1.5 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            >
              <option value="all">All Tiers</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1 flex-1 min-w-48">
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Search size={12} className="inline mr-1" aria-hidden="true" />
              Search Description
            </label>
            <input
              type="text"
              placeholder="Search description..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable<TransactionRow>
        columns={columns}
        data={filteredRows}
        onRowClick={(row) => navigate(`/spend/${row.id}/edit`)}
        emptyMessage="No transactions match the current filters."
      />

      {/* Summary row */}
      <div
        className="flex items-center justify-end px-4 py-3 rounded-xl border"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg)',
        }}
      >
        <span
          className="text-sm font-medium mr-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {filteredRows.length} transaction{filteredRows.length !== 1 ? 's' : ''}
        </span>
        <span
          className="text-base font-semibold tabular-nums"
          style={{ color: 'var(--color-text)' }}
        >
          Total: {formatCurrency(totalAmount)}
        </span>
      </div>
    </div>
  );
}

export default TransactionList;
