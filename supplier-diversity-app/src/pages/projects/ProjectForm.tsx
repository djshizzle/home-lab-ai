import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X, Plus, Trash2, BookTemplate } from 'lucide-react';
import { useAppContext } from '@/store';
import { generateId } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { Project, ContractGoal, GoalTemplate } from '@/types';

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  contractNumber: string;
  contractValue: string;
  description: string;
  startDate: string;
  endDate: string;
  status: Project['status'];
}

interface GoalFormRow {
  _key: string; // local key for React list
  certTypeId: string;
  goalType: ContractGoal['goalType'];
  targetPercentage: string;
  targetDollarAmount: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  contractNumber: '',
  contractValue: '',
  description: '',
  startDate: '',
  endDate: '',
  status: 'active',
};

function projectToForm(p: Project): FormState {
  return {
    name: p.name,
    contractNumber: p.contractNumber,
    contractValue: String(p.contractValue),
    description: p.description,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
  };
}

function goalToRow(g: ContractGoal): GoalFormRow {
  return {
    _key: g.id,
    certTypeId: g.certTypeId,
    goalType: g.goalType,
    targetPercentage: g.targetPercentage !== null ? String(g.targetPercentage) : '',
    targetDollarAmount: g.targetDollarAmount !== null ? String(g.targetDollarAmount) : '',
  };
}

function rowToGoal(row: GoalFormRow): ContractGoal {
  return {
    id: row._key,
    certTypeId: row.certTypeId,
    goalType: row.goalType,
    targetPercentage:
      row.goalType !== 'dollar' && row.targetPercentage !== ''
        ? Number(row.targetPercentage)
        : null,
    targetDollarAmount:
      row.goalType !== 'percentage' && row.targetDollarAmount !== ''
        ? Number(row.targetDollarAmount)
        : null,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectForm() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();

  const isEditing = Boolean(projectId);
  const existing = projectId
    ? state.projects.find((p) => p.id === projectId)
    : undefined;

  const [form, setForm] = useState<FormState>(() =>
    existing ? projectToForm(existing) : EMPTY_FORM
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [goals, setGoals] = useState<GoalFormRow[]>(() =>
    existing ? existing.goals.map(goalToRow) : []
  );

  // Save-as-template modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'Project name is required.';
    if (!form.contractNumber.trim()) next.contractNumber = 'Contract number is required.';
    if (
      !form.contractValue ||
      isNaN(Number(form.contractValue)) ||
      Number(form.contractValue) < 0
    )
      next.contractValue = 'Enter a valid contract value.';
    if (!form.startDate) next.startDate = 'Start date is required.';
    if (!form.endDate) next.endDate = 'End date is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const now = new Date().toISOString();
    const project: Project = {
      id: existing?.id ?? generateId(),
      name: form.name.trim(),
      contractNumber: form.contractNumber.trim(),
      contractValue: Number(form.contractValue),
      description: form.description.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
      goals: goals.map(rowToGoal),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    dispatch({
      type: isEditing ? 'UPDATE_PROJECT' : 'ADD_PROJECT',
      payload: project,
    });

    navigate(isEditing ? `/projects/${project.id}` : '/projects');
  };

  // ---------------------------------------------------------------------------
  // Goal management
  // ---------------------------------------------------------------------------

  const addGoalRow = () => {
    const firstCertType = state.certificationTypes[0];
    setGoals((prev) => [
      ...prev,
      {
        _key: generateId(),
        certTypeId: firstCertType?.id ?? '',
        goalType: 'percentage',
        targetPercentage: '',
        targetDollarAmount: '',
      },
    ]);
  };

  const removeGoalRow = (key: string) => {
    setGoals((prev) => prev.filter((g) => g._key !== key));
  };

  const updateGoalRow = <K extends keyof GoalFormRow>(
    key: string,
    field: K,
    value: GoalFormRow[K]
  ) => {
    setGoals((prev) =>
      prev.map((g) => (g._key === key ? { ...g, [field]: value } : g))
    );
  };

  // ---------------------------------------------------------------------------
  // Apply template
  // ---------------------------------------------------------------------------

  const applyTemplate = (templateId: string) => {
    const template: GoalTemplate | undefined = state.goalTemplates.find(
      (t) => t.id === templateId
    );
    if (!template) return;
    setGoals(
      template.goals.map((g) => ({
        _key: generateId(),
        certTypeId: g.certTypeId,
        goalType: g.goalType,
        targetPercentage: g.targetPercentage !== null ? String(g.targetPercentage) : '',
        targetDollarAmount: g.targetDollarAmount !== null ? String(g.targetDollarAmount) : '',
      }))
    );
  };

  // ---------------------------------------------------------------------------
  // Save as template
  // ---------------------------------------------------------------------------

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const template: GoalTemplate = {
      id: generateId(),
      name: templateName.trim(),
      description: templateDescription.trim(),
      goals: goals.map((row) => ({
        certTypeId: row.certTypeId,
        goalType: row.goalType,
        targetPercentage:
          row.goalType !== 'dollar' && row.targetPercentage !== ''
            ? Number(row.targetPercentage)
            : null,
        targetDollarAmount:
          row.goalType !== 'percentage' && row.targetDollarAmount !== ''
            ? Number(row.targetDollarAmount)
            : null,
      })),
    };
    dispatch({ type: 'ADD_GOAL_TEMPLATE', payload: template });
    setShowSaveModal(false);
    setTemplateName('');
    setTemplateDescription('');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
          {isEditing ? 'Edit Project' : 'Add Project'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {/* Basic info card */}
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm flex flex-col gap-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Project Details
          </h2>

          {/* Name */}
          <Field
            id="proj-name"
            label="Project Name"
            required
            error={errors.name}
          >
            <input
              id="proj-name"
              type="text"
              placeholder="e.g. Downtown Tower Phase 1"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm w-full"
              style={{
                borderColor: errors.name ? 'var(--color-danger)' : 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </Field>

          {/* Contract Number + Value side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              id="proj-contract-number"
              label="Contract Number"
              required
              error={errors.contractNumber}
            >
              <input
                id="proj-contract-number"
                type="text"
                placeholder="e.g. CTR-2024-001"
                value={form.contractNumber}
                onChange={(e) => setField('contractNumber', e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm w-full"
                style={{
                  borderColor: errors.contractNumber
                    ? 'var(--color-danger)'
                    : 'var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                }}
              />
            </Field>

            <Field
              id="proj-contract-value"
              label="Contract Value ($)"
              required
              error={errors.contractValue}
            >
              <input
                id="proj-contract-value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.contractValue}
                onChange={(e) => setField('contractValue', e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm w-full"
                style={{
                  borderColor: errors.contractValue
                    ? 'var(--color-danger)'
                    : 'var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                }}
              />
            </Field>
          </div>

          {/* Start + End dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              id="proj-start"
              label="Start Date"
              required
              error={errors.startDate}
            >
              <input
                id="proj-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm w-full"
                style={{
                  borderColor: errors.startDate ? 'var(--color-danger)' : 'var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                }}
              />
            </Field>

            <Field
              id="proj-end"
              label="End Date"
              required
              error={errors.endDate}
            >
              <input
                id="proj-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setField('endDate', e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm w-full"
                style={{
                  borderColor: errors.endDate ? 'var(--color-danger)' : 'var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                }}
              />
            </Field>
          </div>

          {/* Status */}
          <Field id="proj-status" label="Status">
            <select
              id="proj-status"
              value={form.status}
              onChange={(e) => setField('status', e.target.value as Project['status'])}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </Field>

          {/* Description */}
          <Field id="proj-description" label="Description">
            <textarea
              id="proj-description"
              rows={3}
              placeholder="Optional project description..."
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm resize-y w-full"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </Field>
        </div>

        {/* Goals card */}
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Contract Goals
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Set diversity spend targets for this project.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Apply template */}
              {state.goalTemplates.length > 0 && (
                <div className="flex items-center gap-2">
                  <BookTemplate size={14} style={{ color: 'var(--color-text-muted)' }} />
                  <select
                    defaultValue=""
                    onChange={(e) => applyTemplate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border text-sm"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text)',
                    }}
                    aria-label="Apply goal template"
                  >
                    <option value="" disabled>
                      Apply Template
                    </option>
                    {state.goalTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {goals.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSaveModal(true)}
                >
                  Save as Template
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={addGoalRow}
              >
                Add Goal
              </Button>
            </div>
          </div>

          {goals.length === 0 ? (
            <div
              className="flex items-center justify-center py-8 text-sm rounded-lg"
              style={{
                color: 'var(--color-text-muted)',
                backgroundColor: 'var(--color-bg-secondary)',
              }}
            >
              No goals added yet. Click "Add Goal" to define diversity targets.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {goals.map((row) => (
                <div
                  key={row._key}
                  className="rounded-lg border p-4 flex flex-col gap-3"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-bg-secondary)',
                  }}
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    {/* Cert type */}
                    <div className="flex flex-col gap-1 min-w-[160px]">
                      <label
                        className="text-xs font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Certification Type
                      </label>
                      <select
                        value={row.certTypeId}
                        onChange={(e) =>
                          updateGoalRow(row._key, 'certTypeId', e.target.value)
                        }
                        className="px-3 py-1.5 rounded-lg border text-sm"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: 'var(--color-bg)',
                          color: 'var(--color-text)',
                        }}
                      >
                        {state.certificationTypes.map((ct) => (
                          <option key={ct.id} value={ct.id}>
                            {ct.code} — {ct.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Goal type */}
                    <div className="flex flex-col gap-1">
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Goal Type
                      </span>
                      <div className="flex gap-3">
                        {(
                          [
                            { value: 'percentage', label: 'Percentage' },
                            { value: 'dollar', label: 'Dollar Amount' },
                            { value: 'both', label: 'Both' },
                          ] as { value: ContractGoal['goalType']; label: string }[]
                        ).map(({ value, label }) => (
                          <label
                            key={value}
                            className="flex items-center gap-1.5 cursor-pointer text-sm"
                            style={{ color: 'var(--color-text)' }}
                          >
                            <input
                              type="radio"
                              name={`goal-type-${row._key}`}
                              value={value}
                              checked={row.goalType === value}
                              onChange={() => updateGoalRow(row._key, 'goalType', value)}
                              className="accent-[var(--color-primary)]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Remove button */}
                    <div className="ml-auto">
                      <button
                        type="button"
                        onClick={() => removeGoalRow(row._key)}
                        className="p-1.5 rounded-lg"
                        style={{
                          color: 'var(--color-danger)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        aria-label="Remove goal"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Target inputs */}
                  <div className="flex gap-4 flex-wrap">
                    {(row.goalType === 'percentage' || row.goalType === 'both') && (
                      <div className="flex flex-col gap-1">
                        <label
                          className="text-xs font-medium"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Target %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="e.g. 15"
                          value={row.targetPercentage}
                          onChange={(e) =>
                            updateGoalRow(row._key, 'targetPercentage', e.target.value)
                          }
                          className="px-3 py-1.5 rounded-lg border text-sm w-28"
                          style={{
                            borderColor: 'var(--color-border)',
                            backgroundColor: 'var(--color-bg)',
                            color: 'var(--color-text)',
                          }}
                        />
                      </div>
                    )}

                    {(row.goalType === 'dollar' || row.goalType === 'both') && (
                      <div className="flex flex-col gap-1">
                        <label
                          className="text-xs font-medium"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Target $ Amount
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g. 500000"
                          value={row.targetDollarAmount}
                          onChange={(e) =>
                            updateGoalRow(row._key, 'targetDollarAmount', e.target.value)
                          }
                          className="px-3 py-1.5 rounded-lg border text-sm w-36"
                          style={{
                            borderColor: 'var(--color-border)',
                            backgroundColor: 'var(--color-bg)',
                            color: 'var(--color-text)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" leftIcon={<Save size={16} />}>
            {isEditing ? 'Save Changes' : 'Create Project'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            leftIcon={<X size={16} />}
            onClick={() => navigate(isEditing ? `/projects/${projectId}` : '/projects')}
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Save as Template modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save Goal Configuration as Template"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="template-name"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              Template Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="template-name"
              type="text"
              placeholder="e.g. Standard City Contract Goals"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="template-description"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              Description
            </label>
            <input
              id="template-description"
              type="text"
              placeholder="Optional description..."
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowSaveModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
            >
              Save Template
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small Field wrapper for consistent label + error rendering
// ---------------------------------------------------------------------------

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function Field({ id, label, required, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-medium"
        style={{ color: 'var(--color-text)' }}
      >
        {label}
        {required && (
          <span className="ml-1" style={{ color: 'var(--color-danger)' }}>
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

export default ProjectForm;
