import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { FileDown, Printer } from 'lucide-react';
import { useAppContext } from '@/store';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { CertificationType, Project, Transaction } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PeriodType = 'quarter' | 'year' | 'custom';

interface GoalRow {
  certType: CertificationType;
  targetPct: number | null;
  targetDollar: number | null;
  actualDollar: number;
  actualPct: number;
  status: 'Met' | 'Not Met' | 'On Track' | 'No Goal';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function quarterRange(quarter: number, year: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  const start = new Date(year, startMonth, 1).toISOString().slice(0, 10);
  const lastDay = new Date(year, endMonth + 1, 0).getDate();
  const end = new Date(year, endMonth, lastDay).toISOString().slice(0, 10);
  return { start, end };
}

function filterTransactionsByPeriod(
  transactions: Transaction[],
  periodType: PeriodType,
  quarter: number,
  year: number,
  customStart: string,
  customEnd: string,
): Transaction[] {
  let start: string;
  let end: string;

  if (periodType === 'year') {
    start = `${year}-01-01`;
    end = `${year}-12-31`;
  } else if (periodType === 'quarter') {
    ({ start, end } = quarterRange(quarter, year));
  } else {
    start = customStart;
    end = customEnd;
  }

  return transactions.filter((t) => t.date >= start && t.date <= end);
}

function buildGoalRows(
  project: Project,
  certTypes: CertificationType[],
  filteredTx: Transaction[],
): GoalRow[] {
  const projectTx = filteredTx.filter((t) => t.projectId === project.id);
  const contractValue = project.contractValue > 0 ? project.contractValue : 1;

  return certTypes.map((ct) => {
    const goal = project.goals.find((g) => g.certTypeId === ct.id) ?? null;

    // Spend for this cert type: sum transactions from suppliers with this cert
    // We attribute all spend for the project proportionally — since we don't have
    // per-cert transaction fields, we sum all project transactions and compare
    // against the contract value goal. (Actual spend is per project not per cert.)
    const certTx = projectTx;
    const actualDollar = certTx.reduce((s, t) => s + t.amount, 0);
    const actualPct = (actualDollar / contractValue) * 100;

    if (!goal) {
      return { certType: ct, targetPct: null, targetDollar: null, actualDollar, actualPct, status: 'No Goal' as const };
    }

    let status: GoalRow['status'] = 'On Track';
    if (goal.goalType === 'percentage' && goal.targetPercentage !== null) {
      status = actualPct >= goal.targetPercentage ? 'Met' : 'On Track';
    } else if (goal.goalType === 'dollar' && goal.targetDollarAmount !== null) {
      status = actualDollar >= goal.targetDollarAmount ? 'Met' : 'On Track';
    } else if (goal.goalType === 'both') {
      const pctMet = goal.targetPercentage !== null ? actualPct >= goal.targetPercentage : true;
      const dolMet = goal.targetDollarAmount !== null ? actualDollar >= goal.targetDollarAmount : true;
      if (pctMet && dolMet) status = 'Met';
      else if (!pctMet || !dolMet) status = 'Not Met';
    }

    return {
      certType: ct,
      targetPct: goal.targetPercentage,
      targetDollar: goal.targetDollarAmount,
      actualDollar,
      actualPct,
      status,
    };
  }).filter((r) => r.status !== 'No Goal' || r.targetPct !== null || r.targetDollar !== null);
}

function statusBadgeVariant(status: GoalRow['status']): 'green' | 'red' | 'blue' | 'gray' {
  if (status === 'Met') return 'green';
  if (status === 'Not Met') return 'red';
  if (status === 'On Track') return 'blue';
  return 'gray';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ProjectTableProps {
  project: Project;
  rows: GoalRow[];
}

function ProjectTable({ project, rows }: ProjectTableProps) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-6">
      <h3
        className="text-sm font-semibold mb-3"
        style={{ color: 'var(--color-text)' }}
      >
        {project.name}
        <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>
          Contract Value: {formatCurrency(project.contractValue)}
        </span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Cert Type', 'Target %', 'Actual %', 'Target $', 'Actual $', 'Progress', 'Status'].map((h) => (
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
            {rows.map((row) => {
              const progressValue = row.targetPct !== null
                ? Math.min((row.actualPct / row.targetPct) * 100, 100)
                : row.targetDollar !== null
                  ? Math.min((row.actualDollar / row.targetDollar) * 100, 100)
                  : 0;

              return (
                <tr
                  key={row.certType.id}
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <td className="py-2 px-3">
                    <Badge color={row.certType.color}>{row.certType.code}</Badge>
                    <span className="ml-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {row.certType.label}
                    </span>
                  </td>
                  <td className="py-2 px-3 tabular-nums" style={{ color: 'var(--color-text)' }}>
                    {row.targetPct !== null ? formatPercent(row.targetPct) : '—'}
                  </td>
                  <td className="py-2 px-3 tabular-nums" style={{ color: 'var(--color-text)' }}>
                    {formatPercent(row.actualPct)}
                  </td>
                  <td className="py-2 px-3 tabular-nums" style={{ color: 'var(--color-text)' }}>
                    {row.targetDollar !== null ? formatCurrency(row.targetDollar) : '—'}
                  </td>
                  <td className="py-2 px-3 tabular-nums" style={{ color: 'var(--color-text)' }}>
                    {formatCurrency(row.actualDollar)}
                  </td>
                  <td className="py-2 px-3 w-32">
                    <ProgressBar value={progressValue} max={100} />
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ComplianceReport() {
  const { state } = useAppContext();
  const { projects, transactions, certificationTypes } = state;

  const currentYear = new Date().getFullYear();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [periodType, setPeriodType] = useState<PeriodType>('year');
  const [quarter, setQuarter] = useState<number>(1);
  const [year, setYear] = useState<number>(currentYear);
  const [customStart, setCustomStart] = useState<string>(`${currentYear}-01-01`);
  const [customEnd, setCustomEnd] = useState<string>(`${currentYear}-12-31`);

  const printRef = useRef<HTMLDivElement>(null);

  const filteredTx = useMemo(
    () => filterTransactionsByPeriod(transactions, periodType, quarter, year, customStart, customEnd),
    [transactions, periodType, quarter, year, customStart, customEnd],
  );

  const displayProjects = useMemo(
    () => (selectedProjectId === 'all' ? projects : projects.filter((p) => p.id === selectedProjectId)),
    [projects, selectedProjectId],
  );

  const projectRows = useMemo(
    () => displayProjects.map((p) => ({
      project: p,
      rows: buildGoalRows(p, certificationTypes, filteredTx),
    })),
    [displayProjects, certificationTypes, filteredTx],
  );

  // ---------------------------------------------------------------------------
  // Export PDF (print)
  // ---------------------------------------------------------------------------

  function handleExportPDF() {
    window.print();
  }

  // ---------------------------------------------------------------------------
  // Export Excel
  // ---------------------------------------------------------------------------

  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    for (const { project, rows } of projectRows) {
      const sheetData = [
        ['Cert Type', 'Code', 'Target %', 'Actual %', 'Target $', 'Actual $', 'Status'],
        ...rows.map((r) => [
          r.certType.label,
          r.certType.code,
          r.targetPct ?? '',
          Number(r.actualPct.toFixed(2)),
          r.targetDollar ?? '',
          r.actualDollar,
          r.status,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, project.name.slice(0, 31));
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'compliance-report.xlsx');
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm print:hidden">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Filters
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Project selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text)',
                borderColor: 'var(--color-border)',
              }}
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Period type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Period
            </label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="rounded-lg px-3 py-2 text-sm border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text)',
                borderColor: 'var(--color-border)',
              }}
            >
              <option value="year">Year</option>
              <option value="quarter">Quarter</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Year (always visible) */}
          {(periodType === 'year' || periodType === 'quarter') && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-lg px-3 py-2 text-sm border"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {Array.from({ length: 6 }, (_, i) => currentYear - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {/* Quarter */}
          {periodType === 'quarter' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Quarter
              </label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className="rounded-lg px-3 py-2 text-sm border"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>Q{q}</option>
                ))}
              </select>
            </div>
          )}

          {/* Custom range */}
          {periodType === 'custom' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
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
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm border"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-border)',
                  }}
                />
              </div>
            </>
          )}

          {/* Export buttons */}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" leftIcon={<Printer size={14} />} onClick={handleExportPDF}>
              Export PDF
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<FileDown size={14} />} onClick={handleExportExcel}>
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Print header (only visible in print) */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Compliance Report</h1>
        <p className="text-sm text-gray-500">Generated: {new Date().toLocaleDateString()}</p>
      </div>

      {/* Report content */}
      <div ref={printRef}>
        {projectRows.length === 0 ? (
          <div
            className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-12 shadow-sm text-center"
            style={{ color: 'var(--color-text-muted)' }}
          >
            No projects found. Add projects with goals to see compliance data.
          </div>
        ) : (
          projectRows.map(({ project, rows }) => (
            <div
              key={project.id}
              className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm mb-4"
            >
              <ProjectTable project={project} rows={rows} />
              {rows.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  No goals configured for this project.
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Print styles injected inline for simplicity */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #main-content, #main-content * { visibility: visible; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}

export default ComplianceReport;
