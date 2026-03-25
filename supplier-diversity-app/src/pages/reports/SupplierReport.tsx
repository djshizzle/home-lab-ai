import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { FileDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAppContext } from '@/store';
import { formatCurrency, formatPercent, getCertColor } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Transaction, Supplier, CertificationType } from '@/types';

// ---------------------------------------------------------------------------
// Color map
// ---------------------------------------------------------------------------

const TAILWIND_COLOR_MAP: Record<string, string> = {
  'blue-600': '#2563eb',
  'pink-600': '#db2777',
  'green-600': '#16a34a',
  'purple-600': '#9333ea',
  'orange-600': '#ea580c',
  'red-600': '#dc2626',
  'teal-600': '#0d9488',
  'amber-600': '#d97706',
  'indigo-600': '#4f46e5',
  'cyan-600': '#0891b2',
  'gray-400': '#94a3b8',
};

function resolveColor(tailwindColor: string): string {
  return TAILWIND_COLOR_MAP[tailwindColor] ?? '#94a3b8';
}

// ---------------------------------------------------------------------------
// Data computation helpers
// ---------------------------------------------------------------------------

interface SupplierRankRow {
  rank: number;
  supplier: Supplier;
  totalSpend: number;
  pctOfTotal: number;
}

function computeTopSuppliers(
  transactions: Transaction[],
  suppliers: Supplier[],
  limit: number,
): SupplierRankRow[] {
  const totals: Record<string, number> = {};
  for (const t of transactions) {
    totals[t.supplierId] = (totals[t.supplierId] ?? 0) + t.amount;
  }
  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([supplierId, totalSpend], idx) => {
      const supplier = suppliers.find((s) => s.id === supplierId);
      if (!supplier) return null;
      return {
        rank: idx + 1,
        supplier,
        totalSpend,
        pctOfTotal: grandTotal > 0 ? (totalSpend / grandTotal) * 100 : 0,
      };
    })
    .filter((r): r is SupplierRankRow => r !== null);
}

interface CertDistributionRow {
  code: string;
  count: number;
  color: string;
}

function computeCertDistribution(
  suppliers: Supplier[],
  certTypes: CertificationType[],
  certFilter: string,
): CertDistributionRow[] {
  const counts: Record<string, number> = {};
  const filtered = certFilter
    ? suppliers.filter((s) => s.certifications.some((c) => c.certTypeId === certFilter))
    : suppliers;

  for (const s of filtered) {
    for (const cert of s.certifications) {
      counts[cert.certTypeId] = (counts[cert.certTypeId] ?? 0) + 1;
    }
  }

  return certTypes
    .filter((ct) => (counts[ct.id] ?? 0) > 0)
    .map((ct) => ({
      code: ct.code,
      count: counts[ct.id] ?? 0,
      color: resolveColor(ct.color),
    }))
    .sort((a, b) => b.count - a.count);
}

interface ConcentrationRow {
  label: string;
  pct: number;
  amount: number;
}

function computeConcentration(
  transactions: Transaction[],
  suppliers: Supplier[],
): ConcentrationRow[] {
  const totals: Record<string, number> = {};
  for (const t of transactions) {
    totals[t.supplierId] = (totals[t.supplierId] ?? 0) + t.amount;
  }
  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
  if (grandTotal === 0) return [];

  const sorted = Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .filter(([id]) => suppliers.some((s) => s.id === id));

  const groups = [5, 10, 20];
  return groups.map((n) => {
    const slice = sorted.slice(0, n);
    const amount = slice.reduce((s, [, v]) => s + v, 0);
    return { label: `Top ${n}`, pct: (amount / grandTotal) * 100, amount };
  });
}

// ---------------------------------------------------------------------------
// Tooltip for count charts
// ---------------------------------------------------------------------------

interface TooltipPayload {
  value: number;
  name: string;
}

interface CountTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CountTooltip({ active, payload, label }: CountTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-lg border p-3 shadow-md text-xs"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      {label && <p className="font-semibold mb-1">{label}</p>}
      <p>{payload[0].value} supplier{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center py-12 text-sm"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const LIMIT_OPTIONS = [10, 20, 50] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number];

export function SupplierReport() {
  const { state } = useAppContext();
  const { transactions, suppliers, certificationTypes } = state;

  const [certFilter, setCertFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [topLimit, setTopLimit] = useState<LimitOption>(10);

  const filteredTx = useMemo(() => {
    let tx = transactions;
    if (certFilter) {
      const certSupplierIds = new Set(
        suppliers
          .filter((s) => s.certifications.some((c) => c.certTypeId === certFilter))
          .map((s) => s.id),
      );
      tx = tx.filter((t) => certSupplierIds.has(t.supplierId));
    }
    if (tierFilter) {
      tx = tx.filter((t) => String(t.tier) === tierFilter);
    }
    return tx;
  }, [transactions, suppliers, certFilter, tierFilter]);

  const filteredSuppliers = useMemo(() => {
    let s = suppliers;
    if (certFilter) {
      s = s.filter((sup) => sup.certifications.some((c) => c.certTypeId === certFilter));
    }
    return s;
  }, [suppliers, certFilter]);

  const topSuppliers = useMemo(
    () => computeTopSuppliers(filteredTx, filteredSuppliers, topLimit),
    [filteredTx, filteredSuppliers, topLimit],
  );

  const certDistribution = useMemo(
    () => computeCertDistribution(filteredSuppliers, certificationTypes, ''),
    [filteredSuppliers, certificationTypes],
  );

  const concentration = useMemo(
    () => computeConcentration(filteredTx, filteredSuppliers),
    [filteredTx, filteredSuppliers],
  );

  const hasData = filteredTx.length > 0;

  // -------------------------------------------------------------------------
  // Export Excel
  // -------------------------------------------------------------------------

  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    // Top suppliers
    const suppliersSheet = XLSX.utils.aoa_to_sheet([
      ['Rank', 'Company', 'Certifications', 'Total Spend', '% of Total'],
      ...topSuppliers.map((r) => [
        r.rank,
        r.supplier.companyName,
        r.supplier.certifications
          .map((c) => certificationTypes.find((ct) => ct.id === c.certTypeId)?.code ?? c.certTypeId)
          .join(', '),
        r.totalSpend,
        Number(r.pctOfTotal.toFixed(2)),
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, suppliersSheet, 'Top Suppliers');

    // Cert distribution
    const certSheet = XLSX.utils.aoa_to_sheet([
      ['Cert Code', 'Supplier Count'],
      ...certDistribution.map((r) => [r.code, r.count]),
    ]);
    XLSX.utils.book_append_sheet(wb, certSheet, 'Cert Distribution');

    // Concentration
    const concentrationSheet = XLSX.utils.aoa_to_sheet([
      ['Group', 'Total Spend', '% of Total'],
      ...concentration.map((r) => [r.label, r.amount, Number(r.pct.toFixed(2))]),
    ]);
    XLSX.utils.book_append_sheet(wb, concentrationSheet, 'Concentration');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'supplier-report.xlsx');
  }

  const selectStyle = {
    backgroundColor: 'var(--color-bg-tertiary)',
    color: 'var(--color-text)',
    borderColor: 'var(--color-border)',
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Filters
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Cert type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Cert Type
            </label>
            <select
              value={certFilter}
              onChange={(e) => setCertFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm border"
              style={selectStyle}
            >
              <option value="">All Cert Types</option>
              {certificationTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.code} — {ct.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tier */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Tier
            </label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm border"
              style={selectStyle}
            >
              <option value="">All Tiers</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </select>
          </div>

          {/* Top N */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Top N Suppliers
            </label>
            <select
              value={topLimit}
              onChange={(e) => setTopLimit(Number(e.target.value) as LimitOption)}
              className="rounded-lg px-3 py-2 text-sm border"
              style={selectStyle}
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileDown size={14} />}
              onClick={handleExportExcel}
              disabled={!hasData}
            >
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Top Suppliers Table */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Top Suppliers by Spend
        </h2>
        {topSuppliers.length === 0 ? (
          <EmptyState message="No supplier spend data available." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Rank', 'Company', 'Certifications', 'Total Spend', '% of Total'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 px-3 text-xs font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topSuppliers.map((row) => (
                  <tr key={row.supplier.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td
                      className="py-2 px-3 font-semibold text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      #{row.rank}
                    </td>
                    <td
                      className="py-2 px-3 font-medium"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {row.supplier.companyName}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {row.supplier.certifications.length === 0 ? (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        ) : (
                          row.supplier.certifications.map((cert) => {
                            const ct = certificationTypes.find((c) => c.id === cert.certTypeId);
                            if (!ct) return null;
                            return (
                              <Badge
                                key={cert.certTypeId}
                                color={getCertColor(certificationTypes, cert.certTypeId)}
                              >
                                {ct.code}
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td
                      className="py-2 px-3 tabular-nums font-semibold"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {formatCurrency(row.totalSpend)}
                    </td>
                    <td
                      className="py-2 px-3 tabular-nums"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {formatPercent(row.pctOfTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cert Distribution */}
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Cert Distribution
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Number of suppliers per cert type
          </p>
          {certDistribution.length === 0 ? (
            <EmptyState message="No certified suppliers found." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={certDistribution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="code"
                  tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {certDistribution.map((entry) => (
                    <Cell key={entry.code} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Spend Concentration */}
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Spend Concentration
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            % of total spend by top 5 / 10 / 20 suppliers
          </p>
          {concentration.length === 0 ? (
            <EmptyState message="No spend data available." />
          ) : (
            <div className="space-y-4">
              {concentration.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {row.label}
                    </span>
                    <span
                      className="text-sm tabular-nums font-semibold"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {formatPercent(row.pct)} ({formatCurrency(row.amount)})
                    </span>
                  </div>
                  <div
                    className="w-full rounded-full overflow-hidden"
                    style={{ height: '10px', backgroundColor: 'var(--color-bg-tertiary)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(row.pct, 100)}%`,
                        backgroundColor: '#2563eb',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupplierReport;
