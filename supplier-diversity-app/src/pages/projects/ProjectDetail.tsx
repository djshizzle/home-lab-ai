import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { useAppContext } from '@/store';
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import type { Transaction, ContractGoal } from '@/types';

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

const STATUS_VARIANT = {
  active: 'green',
  completed: 'blue',
  archived: 'gray',
} as const;

const TIER_VARIANT = {
  1: 'blue',
  2: 'green',
  3: 'yellow',
} as const satisfies Record<1 | 2 | 3, 'blue' | 'green' | 'yellow'>;

// ---------------------------------------------------------------------------
// Goal row shape
// ---------------------------------------------------------------------------

interface GoalRow extends Record<string, unknown> {
  id: string;
  certCode: string;
  goalType: string;
  targetPercent: number | null;
  targetDollar: number | null;
  actualSpend: number;
  actualPercent: number;
  progressValue: number;
  status: 'met' | 'at-risk' | 'below';
}

// ---------------------------------------------------------------------------
// Transaction row shape
// ---------------------------------------------------------------------------

interface TxnRow extends Record<string, unknown> {
  id: string;
  date: string;
  supplierName: string;
  tier: 1 | 2 | 3;
  amount: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Supplier breakdown row
// ---------------------------------------------------------------------------

interface SupplierSpendRow extends Record<string, unknown> {
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  txnCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();

  const project = state.projects.find((p) => p.id === projectId);

  // Memoised lookups — must come before any early return
  const supplierMap = useMemo(
    () => new Map(state.suppliers.map((s) => [s.id, s.companyName])),
    [state.suppliers]
  );

  const certTypeMap = useMemo(
    () => new Map(state.certificationTypes.map((c) => [c.id, c])),
    [state.certificationTypes]
  );

  // Project transactions
  const projectTxns = useMemo(
    () =>
      project
        ? state.transactions.filter((t) => t.projectId === project.id)
        : [],
    [state.transactions, project]
  );

  const totalSpend = useMemo(
    () => projectTxns.reduce((sum, t) => sum + t.amount, 0),
    [projectTxns]
  );

  // Goal rows
  const goalRows = useMemo<GoalRow[]>(() => {
    if (!project) return [];
    return project.goals.map((goal: ContractGoal): GoalRow => {
      const certType = certTypeMap.get(goal.certTypeId);
      const certCode = certType?.code ?? goal.certTypeId;

      // Actual spend: sum transactions from suppliers with this cert type
      const actualSpend = projectTxns
        .filter((t) => {
          const supplier = state.suppliers.find((s) => s.id === t.supplierId);
          return supplier?.certifications.some((c) => c.certTypeId === goal.certTypeId) ?? false;
        })
        .reduce((sum, t) => sum + t.amount, 0);

      const contractValue = project.contractValue > 0 ? project.contractValue : 1;
      const actualPercent = (actualSpend / contractValue) * 100;

      // Determine progress value and status
      let progressValue = 0;
      let status: GoalRow['status'] = 'below';

      if (goal.goalType === 'percentage' && goal.targetPercentage !== null) {
        progressValue =
          goal.targetPercentage > 0 ? (actualPercent / goal.targetPercentage) * 100 : 0;
        if (actualPercent >= goal.targetPercentage) status = 'met';
        else if (actualPercent >= goal.targetPercentage * 0.75) status = 'at-risk';
      } else if (goal.goalType === 'dollar' && goal.targetDollarAmount !== null) {
        progressValue =
          goal.targetDollarAmount > 0 ? (actualSpend / goal.targetDollarAmount) * 100 : 0;
        if (actualSpend >= goal.targetDollarAmount) status = 'met';
        else if (actualSpend >= goal.targetDollarAmount * 0.75) status = 'at-risk';
      } else if (goal.goalType === 'both') {
        const percentProgress =
          goal.targetPercentage && goal.targetPercentage > 0
            ? actualPercent / goal.targetPercentage
            : 1;
        const dollarProgress =
          goal.targetDollarAmount && goal.targetDollarAmount > 0
            ? actualSpend / goal.targetDollarAmount
            : 1;
        progressValue = Math.min(percentProgress, dollarProgress) * 100;
        const pMet = goal.targetPercentage !== null ? actualPercent >= goal.targetPercentage : true;
        const dMet =
          goal.targetDollarAmount !== null ? actualSpend >= goal.targetDollarAmount : true;
        if (pMet && dMet) status = 'met';
        else if (progressValue >= 75) status = 'at-risk';
      }

      return {
        id: goal.id,
        certCode,
        goalType: goal.goalType,
        targetPercent: goal.targetPercentage,
        targetDollar: goal.targetDollarAmount,
        actualSpend,
        actualPercent,
        progressValue: Math.min(progressValue, 100),
        status,
      };
    });
  }, [project, projectTxns, certTypeMap, state.suppliers]);

  // Transaction rows
  const txnRows = useMemo<TxnRow[]>(
    () =>
      projectTxns.map((t: Transaction) => ({
        id: t.id,
        date: t.date,
        supplierName: supplierMap.get(t.supplierId) ?? t.supplierId,
        tier: t.tier,
        amount: t.amount,
        description: t.description,
      })),
    [projectTxns, supplierMap]
  );

  // Supplier breakdown
  const supplierBreakdown = useMemo<SupplierSpendRow[]>(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const t of projectTxns) {
      const entry = map.get(t.supplierId) ?? { total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      map.set(t.supplierId, entry);
    }
    return Array.from(map.entries())
      .map(([supplierId, { total, count }]) => ({
        supplierId,
        supplierName: supplierMap.get(supplierId) ?? supplierId,
        totalAmount: total,
        txnCount: count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [projectTxns, supplierMap]);

  // ---------------------------------------------------------------------------
  // Early return after all hooks
  // ---------------------------------------------------------------------------

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-lg font-medium" style={{ color: 'var(--color-text)' }}>
          Project not found.
        </p>
        <Button
          variant="secondary"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/projects')}
        >
          Back to Projects
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  const handleDelete = () => {
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    dispatch({ type: 'DELETE_PROJECT', payload: project.id });
    navigate('/projects');
  };

  // ---------------------------------------------------------------------------
  // Column definitions
  // ---------------------------------------------------------------------------

  const txnColumns: Column<TxnRow>[] = [
    {
      header: 'Date',
      accessor: 'date',
      sortable: true,
      render: (value) => formatDate(String(value)),
    },
    { header: 'Supplier', accessor: 'supplierName', sortable: true },
    {
      header: 'Tier',
      accessor: 'tier',
      sortable: true,
      render: (value) => {
        const tier = value as 1 | 2 | 3;
        return <Badge variant={TIER_VARIANT[tier]}>T{tier}</Badge>;
      },
    },
    {
      header: 'Amount',
      accessor: 'amount',
      sortable: true,
      render: (value) => (
        <span className="tabular-nums font-medium">{formatCurrency(value as number)}</span>
      ),
    },
    { header: 'Description', accessor: 'description', sortable: false },
  ];

  const supplierColumns: Column<SupplierSpendRow>[] = [
    { header: 'Supplier', accessor: 'supplierName', sortable: true },
    {
      header: 'Transactions',
      accessor: 'txnCount',
      sortable: true,
    },
    {
      header: 'Total Spend',
      accessor: 'totalAmount',
      sortable: true,
      render: (value) => (
        <span className="tabular-nums font-semibold">{formatCurrency(value as number)}</span>
      ),
    },
    {
      header: '% of Spend',
      accessor: 'totalAmount',
      sortable: false,
      render: (_value, row) => {
        const pct = totalSpend > 0 ? ((row.totalAmount as number) / totalSpend) * 100 : 0;
        return <span className="tabular-nums text-xs">{formatPercent(pct)}</span>;
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Status variant
  // ---------------------------------------------------------------------------

  const statusVariant = STATUS_VARIANT[project.status];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Back link */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1 text-sm w-fit"
        style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <ArrowLeft size={14} />
        Back to Projects
      </button>

      {/* Header card */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="text-2xl font-semibold"
                style={{ color: 'var(--color-text)' }}
              >
                {project.name}
              </h1>
              <Badge variant={statusVariant}>
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Badge>
            </div>

            {project.contractNumber && (
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Contract #{project.contractNumber}
              </p>
            )}

            <div className="flex flex-wrap gap-6 mt-4 text-sm">
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Contract Value</span>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {formatCurrency(project.contractValue)}
                </p>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Start Date</span>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {project.startDate ? formatDate(project.startDate) : '—'}
                </p>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>End Date</span>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {project.endDate ? formatDate(project.endDate) : '—'}
                </p>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Total Spend</span>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {formatCurrency(totalSpend)}
                </p>
              </div>
            </div>

            {project.description && (
              <p className="text-sm mt-4" style={{ color: 'var(--color-text-secondary)' }}>
                {project.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Edit2 size={14} />}
              onClick={() => navigate(`/projects/${project.id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Contract Goals */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Contract Goals
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Diversity spend targets vs. actuals
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Edit2 size={14} />}
            onClick={() => navigate(`/projects/${project.id}/edit`)}
          >
            Edit Goals
          </Button>
        </div>

        {project.goals.length === 0 ? (
          <div
            className="flex items-center justify-center py-8 text-sm rounded-lg"
            style={{
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            No goals set. Click Edit Goals to add diversity targets.
          </div>
        ) : (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {[
                    'Cert Type',
                    'Type',
                    'Target %',
                    'Target $',
                    'Actual Spend',
                    'Actual %',
                    'Progress',
                    'Status',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {goalRows.map((row, idx) => {
                  const statusVariantGoal =
                    row.status === 'met'
                      ? 'green'
                      : row.status === 'at-risk'
                      ? 'yellow'
                      : 'red';
                  const progressColor =
                    row.status === 'met'
                      ? 'green'
                      : row.status === 'at-risk'
                      ? 'yellow'
                      : 'red';

                  return (
                    <tr
                      key={row.id}
                      style={{
                        backgroundColor:
                          idx % 2 === 0 ? 'var(--color-bg)' : 'var(--color-bg-secondary)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <td
                        className="px-4 py-3 font-semibold"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {row.certCode}
                      </td>
                      <td className="px-4 py-3 capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                        {row.goalType}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--color-text)' }}>
                        {row.targetPercent !== null ? formatPercent(row.targetPercent) : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--color-text)' }}>
                        {row.targetDollar !== null ? formatCurrency(row.targetDollar) : '—'}
                      </td>
                      <td
                        className="px-4 py-3 tabular-nums font-medium"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {formatCurrency(row.actualSpend)}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--color-text)' }}>
                        {formatPercent(row.actualPercent)}
                      </td>
                      <td className="px-4 py-3" style={{ minWidth: '120px' }}>
                        <ProgressBar value={row.progressValue} max={100} color={progressColor} showPercent />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariantGoal}>
                          {row.status === 'met'
                            ? 'Met'
                            : row.status === 'at-risk'
                            ? 'At Risk'
                            : 'Below'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            Transactions
            <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>
              ({txnRows.length})
            </span>
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/spend/new')}
          >
            Add Transaction
          </Button>
        </div>

        <DataTable<TxnRow>
          columns={txnColumns}
          data={txnRows}
          onRowClick={(row) => navigate(`/spend/${row.id}/edit`)}
          emptyMessage="No transactions recorded for this project."
        />
      </div>

      {/* Supplier breakdown */}
      {supplierBreakdown.length > 0 && (
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Supplier Breakdown
          </h2>
          <DataTable<SupplierSpendRow>
            columns={supplierColumns}
            data={supplierBreakdown}
            emptyMessage="No supplier data."
          />
        </div>
      )}
    </div>
  );
}

export default ProjectDetail;
