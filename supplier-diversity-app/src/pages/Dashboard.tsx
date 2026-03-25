import { useMemo } from 'react';
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
import {
  DollarSign,
  BadgeCheck,
  TrendingUp,
  FolderOpen,
} from 'lucide-react';
import { useAppContext } from '@/store';
import { formatCurrency, formatPercent, formatDate, getExpiringCerts, getCertColor } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Supplier, Transaction, CertificationType } from '@/types/index';

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<number, string> = {
  1: '#2563eb',   // blue
  2: '#10b981',   // emerald
  3: '#f59e0b',   // amber
};

/**
 * Map a Tailwind color string like "blue-600" to a hex value suitable for
 * Recharts (which cannot interpret Tailwind utility classes).
 */
const TAILWIND_COLOR_MAP: Record<string, string> = {
  'blue-600':   '#2563eb',
  'pink-600':   '#db2777',
  'green-600':  '#16a34a',
  'purple-600': '#9333ea',
  'orange-600': '#ea580c',
  'red-600':    '#dc2626',
  'gray-400':   '#94a3b8',
};

function resolveColor(tailwindColor: string): string {
  return TAILWIND_COLOR_MAP[tailwindColor] ?? '#94a3b8';
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor: string;
}

function KpiCard({ label, value, icon, accentColor }: KpiCardProps) {
  return (
    <div
      className="rounded-xl shadow-sm border flex items-center gap-4 p-5"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-lg"
        style={{ backgroundColor: accentColor + '1a' }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p
          className="text-xs font-medium uppercase tracking-wide truncate"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {label}
        </p>
        <p
          className="text-xl font-bold mt-0.5 truncate"
          style={{ color: 'var(--color-text)' }}
        >
          {value}
        </p>
      </div>
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
// Derived data helpers
// ---------------------------------------------------------------------------

function computeTotalSpend(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function computeCertifiedSpend(
  transactions: Transaction[],
  suppliers: Supplier[]
): number {
  const certifiedIds = new Set(
    suppliers
      .filter((s) => s.certifications.length > 0)
      .map((s) => s.id)
  );
  return transactions
    .filter((t) => certifiedIds.has(t.supplierId))
    .reduce((sum, t) => sum + t.amount, 0);
}

interface SpendByCert {
  code: string;
  amount: number;
  color: string;
}

function computeSpendByCertType(
  transactions: Transaction[],
  suppliers: Supplier[],
  certTypes: CertificationType[]
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

interface SupplierRow {
  rank: number;
  supplier: Supplier;
  totalSpend: number;
}

function computeTopSuppliers(
  transactions: Transaction[],
  suppliers: Supplier[],
  limit: number
): SupplierRow[] {
  const totals: Record<string, number> = {};
  for (const t of transactions) {
    totals[t.supplierId] = (totals[t.supplierId] ?? 0) + t.amount;
  }

  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([supplierId, totalSpend], idx) => {
      const supplier = suppliers.find((s) => s.id === supplierId);
      return supplier ? { rank: idx + 1, supplier, totalSpend } : null;
    })
    .filter((row): row is SupplierRow => row !== null);
}

interface MonthlySpend {
  month: string;
  amount: number;
}

function computeMonthlySpend(transactions: Transaction[]): MonthlySpend[] {
  const now = new Date();
  const months: MonthlySpend[] = [];

  // Build ordered list of last 12 month keys (YYYY-MM)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months.push({ month: label, amount: 0, _key: key } as MonthlySpend & { _key: string });
  }

  for (const t of transactions) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = (months as (MonthlySpend & { _key: string })[]).find((m) => m._key === key);
    if (entry) {
      entry.amount += t.amount;
    }
  }

  // Strip internal _key before returning
  return months.map(({ month, amount }) => ({ month, amount }));
}

// ---------------------------------------------------------------------------
// Custom tooltip for currency values
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
          {p.name !== 'amount' && p.name !== 'value' ? `${p.name}: ` : ''}
          {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function Dashboard() {
  const { state } = useAppContext();
  const { suppliers, transactions, projects, certificationTypes } = state;

  const hasTransactions = transactions.length > 0;

  // KPI computations
  const totalSpend = useMemo(() => computeTotalSpend(transactions), [transactions]);
  const certifiedSpend = useMemo(
    () => computeCertifiedSpend(transactions, suppliers),
    [transactions, suppliers]
  );
  const diversityRate = totalSpend > 0 ? (certifiedSpend / totalSpend) * 100 : 0;
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active').length,
    [projects]
  );

  // Chart data
  const spendByCert = useMemo(
    () => computeSpendByCertType(transactions, suppliers, certificationTypes),
    [transactions, suppliers, certificationTypes]
  );
  const tierDistribution = useMemo(
    () => computeTierDistribution(transactions),
    [transactions]
  );
  const topSuppliers = useMemo(
    () => computeTopSuppliers(transactions, suppliers, 5),
    [transactions, suppliers]
  );
  const monthlySpend = useMemo(() => computeMonthlySpend(transactions), [transactions]);

  // Expiring certs (next 90 days)
  const expiringCerts = useMemo(
    () => getExpiringCerts(suppliers, 90),
    [suppliers]
  );

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Row 1 — KPI Cards                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Spend"
          value={formatCurrency(totalSpend)}
          icon={<DollarSign size={22} />}
          accentColor="#2563eb"
        />
        <KpiCard
          label="Certified Spend"
          value={formatCurrency(certifiedSpend)}
          icon={<BadgeCheck size={22} />}
          accentColor="#16a34a"
        />
        <KpiCard
          label="Diversity Rate"
          value={formatPercent(diversityRate)}
          icon={<TrendingUp size={22} />}
          accentColor="#9333ea"
        />
        <KpiCard
          label="Active Projects"
          value={String(activeProjects)}
          icon={<FolderOpen size={22} />}
          accentColor="#f59e0b"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2 — Charts                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Certification Type */}
        <Card title="Spend by Certification Type">
          {!hasTransactions || spendByCert.length === 0 ? (
            <EmptyState message="No transactions yet. Start by importing spend data." />
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

        {/* Tier Distribution */}
        <Card title="Tier Distribution">
          {!hasTransactions || tierDistribution.length === 0 ? (
            <EmptyState message="No transactions yet. Start by importing spend data." />
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
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 3 — Top Suppliers + Expiring Certifications                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers */}
        <Card title="Top Suppliers" subtitle="By total spend">
          {topSuppliers.length === 0 ? (
            <EmptyState message="No supplier spend data yet." />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Rank', 'Company', 'Certifications', 'Total Spend'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topSuppliers.map((row) => (
                    <tr
                      key={row.supplier.id}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                    >
                      <td
                        className="px-5 py-3 font-semibold text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        #{row.rank}
                      </td>
                      <td
                        className="px-5 py-3 font-medium truncate max-w-[140px]"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {row.supplier.companyName}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.supplier.certifications.length === 0 ? (
                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                          ) : (
                            row.supplier.certifications.map((cert) => {
                              const ct = certificationTypes.find(
                                (c) => c.id === cert.certTypeId
                              );
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
                        className="px-5 py-3 font-semibold"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {formatCurrency(row.totalSpend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Expiring Certifications */}
        <Card title="Expiring Certifications" subtitle="Next 90 days">
          {expiringCerts.length === 0 ? (
            <EmptyState message="No certifications expiring in the next 90 days." />
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {expiringCerts.map((ec, idx) => {
                const ct = certificationTypes.find((c) => c.id === ec.certTypeId);
                const urgencyColor =
                  ec.daysUntilExpiry < 30
                    ? 'var(--color-danger)'
                    : ec.daysUntilExpiry < 60
                    ? 'var(--color-warning)'
                    : 'var(--color-text-secondary)';

                return (
                  <li key={idx} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {ec.supplier.companyName}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {ct?.code ?? ec.certTypeId} · Expires {formatDate(ec.expirationDate)}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 text-xs font-semibold whitespace-nowrap"
                      style={{ color: urgencyColor }}
                    >
                      {ec.daysUntilExpiry}d left
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 4 — Spend Trend                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Card title="Spend Trend" subtitle="Last 12 months">
        {!hasTransactions ? (
          <EmptyState message="No transactions yet. Start by importing spend data." />
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
  );
}

export default Dashboard;
