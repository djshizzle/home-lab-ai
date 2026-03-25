import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { FileDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAppContext } from '@/store';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { Transaction, Supplier, CertificationType, Project } from '@/types';

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

const TIER_COLORS: Record<number, string> = {
  1: '#2563eb',
  2: '#10b981',
  3: '#f59e0b',
};

function resolveColor(tailwindColor: string): string {
  return TAILWIND_COLOR_MAP[tailwindColor] ?? '#94a3b8';
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipPayload {
  value: number;
  name: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CurrencyTooltip({ active, payload, label }: ChartTooltipProps) {
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
      {payload.map((p) => (
        <p key={p.name}>
          {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data computation helpers
// ---------------------------------------------------------------------------

interface SpendByCert {
  code: string;
  amount: number;
  color: string;
}

function computeSpendByCertType(
  transactions: Transaction[],
  suppliers: Supplier[],
  certTypes: CertificationType[],
): SpendByCert[] {
  const totals: Record<string, number> = {};
  for (const t of transactions) {
    const supplier = suppliers.find((s) => s.id === t.supplierId);
    if (!supplier) continue;
    for (const cert of supplier.certifications) {
      totals[cert.certTypeId] = (totals[cert.certTypeId] ?? 0) + t.amount;
    }
  }
  return certTypes
    .filter((ct) => (totals[ct.id] ?? 0) > 0)
    .map((ct) => ({
      code: ct.code,
      amount: totals[ct.id] ?? 0,
      color: resolveColor(ct.color),
    }))
    .sort((a, b) => b.amount - a.amount);
}

interface TierSlice {
  name: string;
  value: number;
  color: string;
}

function computeTierDistribution(transactions: Transaction[]): TierSlice[] {
  const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const t of transactions) {
    totals[t.tier] = (totals[t.tier] ?? 0) + t.amount;
  }
  return ([1, 2, 3] as const)
    .filter((tier) => totals[tier] > 0)
    .map((tier) => ({
      name: `Tier ${tier}`,
      value: totals[tier],
      color: TIER_COLORS[tier],
    }));
}

interface SpendByProject {
  name: string;
  amount: number;
}

function computeSpendByProject(
  transactions: Transaction[],
  projects: Project[],
): SpendByProject[] {
  const totals: Record<string, number> = {};
  for (const t of transactions) {
    totals[t.projectId] = (totals[t.projectId] ?? 0) + t.amount;
  }
  return projects
    .filter((p) => (totals[p.id] ?? 0) > 0)
    .map((p) => ({
      name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
      amount: totals[p.id] ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
}

interface MonthlySpend {
  month: string;
  amount: number;
}

function computeMonthlySpend(transactions: Transaction[]): MonthlySpend[] {
  const now = new Date();
  const months: (MonthlySpend & { _key: string })[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months.push({ month: label, amount: 0, _key: key });
  }

  for (const t of transactions) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = months.find((m) => m._key === key);
    if (entry) entry.amount += t.amount;
  }

  return months.map(({ month, amount }) => ({ month, amount }));
}

// ---------------------------------------------------------------------------
// Summary table row
// ---------------------------------------------------------------------------

interface SummaryRow {
  label: string;
  amount: number;
  pct: number;
}

function buildSummaryRows(
  transactions: Transaction[],
  suppliers: Supplier[],
  certTypes: CertificationType[],
): SummaryRow[] {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const certTotals: Record<string, number> = {};

  for (const t of transactions) {
    const supplier = suppliers.find((s) => s.id === t.supplierId);
    if (!supplier) continue;
    for (const cert of supplier.certifications) {
      certTotals[cert.certTypeId] = (certTotals[cert.certTypeId] ?? 0) + t.amount;
    }
  }

  return certTypes
    .filter((ct) => (certTotals[ct.id] ?? 0) > 0)
    .map((ct) => ({
      label: `${ct.code} — ${ct.label}`,
      amount: certTotals[ct.id] ?? 0,
      pct: total > 0 ? ((certTotals[ct.id] ?? 0) / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
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

export function SpendAnalysis() {
  const { state } = useAppContext();
  const { transactions, suppliers, certificationTypes, projects } = state;

  const currentYear = new Date().getFullYear();

  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);

  const filteredTx = useMemo(
    () => transactions.filter((t) => t.date >= startDate && t.date <= endDate),
    [transactions, startDate, endDate],
  );

  const spendByCert = useMemo(
    () => computeSpendByCertType(filteredTx, suppliers, certificationTypes),
    [filteredTx, suppliers, certificationTypes],
  );

  const tierDistribution = useMemo(
    () => computeTierDistribution(filteredTx),
    [filteredTx],
  );

  const spendByProject = useMemo(
    () => computeSpendByProject(filteredTx, projects),
    [filteredTx, projects],
  );

  const monthlySpend = useMemo(
    () => computeMonthlySpend(filteredTx),
    [filteredTx],
  );

  const summaryRows = useMemo(
    () => buildSummaryRows(filteredTx, suppliers, certificationTypes),
    [filteredTx, suppliers, certificationTypes],
  );

  const totalSpend = filteredTx.reduce((s, t) => s + t.amount, 0);

  // -------------------------------------------------------------------------
  // Export Excel
  // -------------------------------------------------------------------------

  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Cert Type', 'Amount', '% of Total'],
      ...summaryRows.map((r) => [r.label, r.amount, Number(r.pct.toFixed(2))]),
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Spend by cert
    const certSheet = XLSX.utils.aoa_to_sheet([
      ['Code', 'Amount'],
      ...spendByCert.map((r) => [r.code, r.amount]),
    ]);
    XLSX.utils.book_append_sheet(wb, certSheet, 'By Cert Type');

    // Spend by tier
    const tierSheet = XLSX.utils.aoa_to_sheet([
      ['Tier', 'Amount'],
      ...tierDistribution.map((r) => [r.name, r.value]),
    ]);
    XLSX.utils.book_append_sheet(wb, tierSheet, 'By Tier');

    // Spend by project
    const projectSheet = XLSX.utils.aoa_to_sheet([
      ['Project', 'Amount'],
      ...spendByProject.map((r) => [r.name, r.amount]),
    ]);
    XLSX.utils.book_append_sheet(wb, projectSheet, 'By Project');

    // Monthly trend
    const monthlySheet = XLSX.utils.aoa_to_sheet([
      ['Month', 'Amount'],
      ...monthlySpend.map((r) => [r.month, r.amount]),
    ]);
    XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly Trend');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'spend-analysis.xlsx');
  }

  const hasData = filteredTx.length > 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Filters
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text)',
                borderColor: 'var(--color-border)',
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text)',
                borderColor: 'var(--color-border)',
              }}
            />
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

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Cert Type — Bar */}
        <Card title="Spend by Cert Type">
          {!hasData || spendByCert.length === 0 ? (
            <EmptyState message="No spend data for this period." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={spendByCert} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="code"
                  tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {spendByCert.map((entry) => (
                    <Cell key={entry.code} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Spend by Tier — Pie */}
        <Card title="Spend by Tier">
          {!hasData || tierDistribution.length === 0 ? (
            <EmptyState message="No spend data for this period." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={tierDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {tierDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Spend']}
                  contentStyle={{
                    backgroundColor: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={10}
                  formatter={(value) => (
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Spend by Project — Horizontal Bar */}
        <Card title="Spend by Project" subtitle="Top 10 projects">
          {!hasData || spendByProject.length === 0 ? (
            <EmptyState message="No project spend data for this period." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, spendByProject.length * 36)}>
              <BarChart
                data={spendByProject}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="amount" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Monthly Trend — Line */}
        <Card title="Monthly Trend" subtitle="Based on filtered transactions">
          {!hasData ? (
            <EmptyState message="No spend data for this period." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlySpend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563eb' }}
                  activeDot={{ r: 5 }}
                  name="Spend"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Summary Table */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Summary
        </h2>
        {summaryRows.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No certified spend data for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Certification Type', 'Total Spend', '% of Period Spend'].map((h) => (
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
                {summaryRows.map((row) => (
                  <tr key={row.label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text)' }}>
                      {row.label}
                    </td>
                    <td className="py-2 px-3 tabular-nums" style={{ color: 'var(--color-text)' }}>
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="py-2 px-3 tabular-nums" style={{ color: 'var(--color-text)' }}>
                      {formatPercent(row.pct)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td
                    className="py-2 px-3 font-semibold"
                    style={{ color: 'var(--color-text)' }}
                  >
                    Total Period Spend
                  </td>
                  <td
                    className="py-2 px-3 tabular-nums font-semibold"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatCurrency(totalSpend)}
                  </td>
                  <td className="py-2 px-3" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default SpendAnalysis;
