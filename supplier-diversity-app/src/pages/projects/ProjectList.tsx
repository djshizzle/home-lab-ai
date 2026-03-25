import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen } from 'lucide-react';
import { useAppContext } from '@/store';
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Project } from '@/types';

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

const STATUS_VARIANT = {
  active: 'green',
  completed: 'blue',
  archived: 'gray',
} as const satisfies Record<Project['status'], 'green' | 'blue' | 'gray'>;

// ---------------------------------------------------------------------------
// Derived diversity %
// ---------------------------------------------------------------------------

function computeDiversityPercent(
  projectId: string,
  contractValue: number,
  transactions: { projectId: string; amount: number }[]
): number {
  if (contractValue <= 0) return 0;
  const total = transactions
    .filter((t) => t.projectId === projectId)
    .reduce((sum, t) => sum + t.amount, 0);
  return (total / contractValue) * 100;
}

// ---------------------------------------------------------------------------
// Project Card
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  project: Project;
  diversityPercent: number;
  onClick: () => void;
}

function ProjectCard({ project, diversityPercent, onClick }: ProjectCardProps) {
  const variant = STATUS_VARIANT[project.status];

  const progressColor =
    diversityPercent >= 100 ? 'green' : diversityPercent >= 75 ? 'yellow' : 'red';

  return (
    <div
      className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm cursor-pointer transition-shadow hover:shadow-md flex flex-col gap-4"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      aria-label={`View project ${project.name}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            className="text-base font-semibold leading-tight truncate"
            style={{ color: 'var(--color-text)' }}
          >
            {project.name}
          </h2>
          {project.contractNumber && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Contract #{project.contractNumber}
            </p>
          )}
        </div>
        <Badge variant={variant}>
          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
        </Badge>
      </div>

      {/* Contract value */}
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--color-text-secondary)' }}>Contract Value</span>
        <span className="font-semibold tabular-nums" style={{ color: 'var(--color-text)' }}>
          {formatCurrency(project.contractValue)}
        </span>
      </div>

      {/* Dates */}
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: 'var(--color-text-muted)' }}>
          {project.startDate ? formatDate(project.startDate) : '—'}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>→</span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {project.endDate ? formatDate(project.endDate) : '—'}
        </span>
      </div>

      {/* Diversity progress */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Diversity Spend
          </span>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: 'var(--color-text)' }}
          >
            {formatPercent(Math.min(diversityPercent, 100))}
          </span>
        </div>
        <ProgressBar value={diversityPercent} max={100} color={progressColor} />
      </div>

      {/* Goals count */}
      {project.goals.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {project.goals.length} contract goal{project.goals.length !== 1 ? 's' : ''} set
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectList() {
  const { state } = useAppContext();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<'all' | Project['status']>('all');

  const filteredProjects = useMemo<Project[]>(() => {
    if (statusFilter === 'all') return state.projects;
    return state.projects.filter((p) => p.status === statusFilter);
  }, [state.projects, statusFilter]);

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (state.projects.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
            Projects
          </h1>
          <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/projects/new')}>
            Add Project
          </Button>
        </div>

        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <FolderOpen size={48} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
            <div className="text-center">
              <p className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
                No projects yet
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Create your first project to start tracking diversity spend.
              </p>
            </div>
            <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/projects/new')}>
              Add Project
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
          Projects
          <span
            className="ml-2 text-sm font-normal"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ({filteredProjects.length} of {state.projects.length})
          </span>
        </h1>
        <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/projects/new')}>
          Add Project
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'active', 'completed', 'archived'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
            style={{
              borderColor:
                statusFilter === s ? 'var(--color-primary)' : 'var(--color-border)',
              backgroundColor:
                statusFilter === s
                  ? 'var(--color-primary)'
                  : 'var(--color-bg-secondary)',
              color: statusFilter === s ? '#fff' : 'var(--color-text)',
              cursor: 'pointer',
            }}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Project grid */}
      {filteredProjects.length === 0 ? (
        <div
          className="flex items-center justify-center py-12 rounded-xl border text-sm"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-muted)',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          No projects match the selected status filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              diversityPercent={computeDiversityPercent(
                project.id,
                project.contractValue,
                state.transactions
              )}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectList;
