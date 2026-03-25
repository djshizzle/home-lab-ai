import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, PackageOpen } from 'lucide-react';
import { useAppContext } from '@/store';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import type { Supplier } from '@/types';

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const STATUS_VARIANT = {
  active: 'green',
  pending: 'yellow',
  inactive: 'gray',
  suspended: 'red',
} as const satisfies Record<Supplier['status'], 'green' | 'yellow' | 'gray' | 'red'>;

// ---------------------------------------------------------------------------
// Types used by DataTable (row must extend Record<string, unknown>)
// ---------------------------------------------------------------------------

type SupplierRow = Supplier & Record<string, unknown>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SupplierList() {
  const { state } = useAppContext();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Supplier['status']>('all');
  const [certFilter, setCertFilter] = useState('');
  const [naicsFilter, setNaicsFilter] = useState('');

  // Build cert type label map
  const certLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ct of state.certificationTypes) {
      map.set(ct.id, ct.code);
    }
    return map;
  }, [state.certificationTypes]);

  const certColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ct of state.certificationTypes) {
      map.set(ct.id, ct.color);
    }
    return map;
  }, [state.certificationTypes]);

  // Filtered suppliers
  const filteredSuppliers = useMemo<SupplierRow[]>(() => {
    const q = search.toLowerCase().trim();

    return state.suppliers
      .filter((s) => {
        // Text search across company name, contact, email
        if (q) {
          const hay = `${s.companyName} ${s.contactName} ${s.email}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        // Status filter
        if (statusFilter !== 'all' && s.status !== statusFilter) return false;

        // Cert type filter
        if (certFilter && !s.certifications.some((c) => c.certTypeId === certFilter)) return false;

        // NAICS filter
        if (naicsFilter.trim()) {
          const naicsQ = naicsFilter.trim().toLowerCase();
          if (!s.naicsCodes.some((code) => code.toLowerCase().includes(naicsQ))) return false;
        }

        return true;
      })
      .map((s) => ({ ...s } as SupplierRow));
  }, [state.suppliers, search, statusFilter, certFilter, naicsFilter]);

  // Table columns
  const columns: Column<SupplierRow>[] = [
    {
      header: 'Company Name',
      accessor: 'companyName',
      sortable: true,
    },
    {
      header: 'Contact',
      accessor: 'contactName',
      sortable: true,
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (_value, row) => {
        const status = row.status as Supplier['status'];
        return (
          <Badge variant={STATUS_VARIANT[status]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      header: 'Certifications',
      accessor: 'certifications',
      sortable: false,
      render: (_value, row) => {
        const certs = row.certifications as Supplier['certifications'];
        if (certs.length === 0) {
          return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {certs.map((cert, i) => {
              const label = certLabelMap.get(cert.certTypeId) ?? cert.certTypeId;
              const color = certColorMap.get(cert.certTypeId);
              return (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={
                    color
                      ? { backgroundColor: color + '20', color: color }
                      : { backgroundColor: '#f1f5f9', color: '#475569' }
                  }
                >
                  {label}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      header: 'City / State',
      accessor: 'city',
      sortable: true,
      render: (_value, row) => {
        const city = row.city as string;
        const st = row.state as string;
        if (!city && !st) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        return (
          <span>
            {[city, st].filter(Boolean).join(', ')}
          </span>
        );
      },
    },
    {
      header: 'Phone',
      accessor: 'phone',
      sortable: false,
      render: (_value, row) => {
        const phone = row.phone as string;
        return phone ? (
          <span>{phone}</span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        );
      },
    },
  ];

  const handleRowClick = (row: SupplierRow) => {
    navigate(`/suppliers/${row.id}`);
  };

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (state.suppliers.length === 0) {
    return (
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            Supplier Directory
          </h1>
          <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/suppliers/new')}>
            Add Supplier
          </Button>
        </div>

        {/* Empty state */}
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <PackageOpen size={48} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
            <div className="text-center">
              <p className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
                No suppliers yet
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Add your first supplier or import a list to get started.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/suppliers/new')}>
                Add Supplier
              </Button>
              <Button variant="secondary" onClick={() => navigate('/settings')}>
                Import Suppliers
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          Supplier Directory
          <span
            className="ml-2 text-sm font-normal"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ({filteredSuppliers.length} of {state.suppliers.length})
          </span>
        </h1>
        <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/suppliers/new')}>
          Add Supplier
        </Button>
      </div>

      {/* Filters card */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="supplier-search"
              className="block text-xs font-medium mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Search
            </label>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-muted)' }}
                aria-hidden="true"
              />
              <input
                id="supplier-search"
                type="text"
                placeholder="Company, contact, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="min-w-[140px]">
            <label
              htmlFor="status-filter"
              className="block text-xs font-medium mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | Supplier['status'])}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Certification type filter */}
          <div className="min-w-[160px]">
            <label
              htmlFor="cert-filter"
              className="block text-xs font-medium mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Certification Type
            </label>
            <select
              id="cert-filter"
              value={certFilter}
              onChange={(e) => setCertFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              <option value="">All Types</option>
              {state.certificationTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.code} — {ct.label}
                </option>
              ))}
            </select>
          </div>

          {/* NAICS filter */}
          <div className="min-w-[140px]">
            <label
              htmlFor="naics-filter"
              className="block text-xs font-medium mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              NAICS Code
            </label>
            <input
              id="naics-filter"
              type="text"
              placeholder="e.g. 541512"
              value={naicsFilter}
              onChange={(e) => setNaicsFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
        <DataTable<SupplierRow>
          columns={columns}
          data={filteredSuppliers}
          onRowClick={handleRowClick}
          emptyMessage="No suppliers match the current filters."
        />
      </div>
    </div>
  );
}

export default SupplierList;
