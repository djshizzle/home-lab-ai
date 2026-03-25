import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  Pencil,
} from 'lucide-react';
import { useAppContext } from '@/store';
import { Button } from '@/components/ui/Button';
import type { AppData } from '@/types';

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
  return (
    <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
      <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
        {title}
      </h2>
      {description && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backup Section
// ---------------------------------------------------------------------------

function BackupSection() {
  const { state, dispatch } = useAppContext();

  const jsonInputRef = useRef<HTMLInputElement>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [importPending, setImportPending] = useState<AppData | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Export JSON
  function handleExportJSON() {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, 'supplier-diversity-backup.json');
  }

  // Export Excel (multi-sheet)
  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    // Suppliers sheet
    const supplierRows = state.suppliers.map((s) => ({
      ID: s.id,
      'Company Name': s.companyName,
      'Contact Name': s.contactName,
      Email: s.email,
      Phone: s.phone,
      Address: s.address,
      City: s.city,
      State: s.state,
      ZIP: s.zip,
      Status: s.status,
      Certifications: s.certifications
        .map((c) => {
          const ct = state.certificationTypes.find((t) => t.id === c.certTypeId);
          return ct ? ct.code : c.certTypeId;
        })
        .join(', '),
      'NAICS Codes': s.naicsCodes.join(', '),
      Capabilities: s.capabilities,
      'Created At': s.createdAt,
      'Updated At': s.updatedAt,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(supplierRows),
      'Suppliers',
    );

    // Transactions sheet
    const txRows = state.transactions.map((t) => {
      const supplier = state.suppliers.find((s) => s.id === t.supplierId);
      const project = state.projects.find((p) => p.id === t.projectId);
      return {
        ID: t.id,
        Date: t.date,
        Supplier: supplier?.companyName ?? t.supplierId,
        Project: project?.name ?? t.projectId,
        Amount: t.amount,
        Tier: t.tier,
        Description: t.description,
        Scope: t.scope,
        'Created At': t.createdAt,
        'Updated At': t.updatedAt,
      };
    });
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(txRows),
      'Transactions',
    );

    // Projects sheet
    const projectRows = state.projects.map((p) => ({
      ID: p.id,
      Name: p.name,
      'Contract Number': p.contractNumber,
      'Contract Value': p.contractValue,
      Description: p.description,
      'Start Date': p.startDate,
      'End Date': p.endDate,
      Status: p.status,
      Goals: p.goals.length,
      'Created At': p.createdAt,
      'Updated At': p.updatedAt,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(projectRows),
      'Projects',
    );

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buf], { type: 'application/octet-stream' }),
      'supplier-diversity-backup.xlsx',
    );
  }

  // Import JSON
  function handleJSONFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportPending(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string) as unknown;
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          !('suppliers' in parsed) ||
          !('transactions' in parsed) ||
          !('projects' in parsed)
        ) {
          setImportError('Invalid backup file: missing required fields (suppliers, transactions, projects).');
          return;
        }
        setImportPending(parsed as AppData);
      } catch {
        setImportError('Failed to parse JSON file. Please ensure it is a valid backup.');
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function handleImportConfirm() {
    if (!importPending) return;
    dispatch({ type: 'LOAD_DATA', payload: importPending });
    setImportPending(null);
    setImportSuccess(true);
  }

  function handleImportCancel() {
    setImportPending(null);
    setImportError(null);
  }

  return (
    <Section
      title="Backup"
      description="Export all your data as a JSON or Excel backup, or restore from a previous JSON backup."
    >
      <div className="flex flex-wrap gap-3 mb-4">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<FileJson size={14} />}
          onClick={handleExportJSON}
        >
          Export JSON Backup
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<FileSpreadsheet size={14} />}
          onClick={handleExportExcel}
        >
          Export Excel Backup
        </Button>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Upload size={14} />}
          onClick={() => jsonInputRef.current?.click()}
        >
          Import JSON Backup
        </Button>
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleJSONFileChange}
        />
      </div>

      {/* Import error */}
      {importError && (
        <div
          className="rounded-lg border p-3 text-sm flex items-start gap-2"
          style={{
            borderColor: 'var(--color-danger)',
            backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          {importError}
        </div>
      )}

      {/* Import pending confirmation */}
      {importPending && !importError && (
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{
            borderColor: 'var(--color-warning)',
            backgroundColor: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Confirm Import
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                This will replace ALL current data with the backup file contents. This action cannot be undone.
                The backup contains {(importPending.suppliers ?? []).length} suppliers,{' '}
                {(importPending.transactions ?? []).length} transactions, and{' '}
                {(importPending.projects ?? []).length} projects.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleImportCancel}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" leftIcon={<Download size={14} />} onClick={handleImportConfirm}>
              Confirm Import
            </Button>
          </div>
        </div>
      )}

      {/* Success */}
      {importSuccess && !importPending && (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{
            borderColor: 'var(--color-success)',
            backgroundColor: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
            color: 'var(--color-success)',
          }}
        >
          Data imported successfully.
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Import Templates Section
// ---------------------------------------------------------------------------

function ImportTemplatesSection() {
  const { state, dispatch } = useAppContext();
  const { columnMappings } = state;

  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    // No DELETE_COLUMN_MAPPING action in current reducer — we use LOAD_DATA to remove
    // We filter and replace via LOAD_DATA
    dispatch({
      type: 'LOAD_DATA',
      payload: {
        ...state,
        columnMappings: state.columnMappings.filter((m) => m.id !== id),
      },
    });
    setDeletingId(null);
  }

  return (
    <Section
      title="Import Templates"
      description="Saved column mappings used in the Spend Import page. Manage saved templates here."
    >
      {columnMappings.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No saved column mappings yet. Import templates are created in the Spend Import page.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Name', 'Type', 'Columns Mapped', 'Actions'].map((h) => (
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
              {columnMappings.map((mapping) => (
                <tr key={mapping.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {deletingId === mapping.id ? (
                    <td colSpan={4} className="py-3 px-3">
                      <div
                        className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                        style={{
                          borderColor: 'var(--color-danger)',
                          backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
                        }}
                      >
                        <p className="text-sm flex-1" style={{ color: 'var(--color-text)' }}>
                          Delete template "{mapping.name}"?
                        </p>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setDeletingId(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            leftIcon={<Trash2 size={13} />}
                            onClick={() => handleDelete(mapping.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-text)' }}>
                        {mapping.name}
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>
                        {mapping.sourceType}
                      </td>
                      <td className="py-2 px-3 tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                        {Object.keys(mapping.mappings).length}
                      </td>
                      <td className="py-2 px-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 size={13} />}
                          onClick={() => setDeletingId(mapping.id)}
                          style={{ color: 'var(--color-danger)' }}
                        >
                          Delete
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Goal Templates Section
// ---------------------------------------------------------------------------

function GoalTemplatesSection() {
  const { state, dispatch } = useAppContext();
  const { goalTemplates, certificationTypes } = state;

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  function startEdit(id: string) {
    const template = goalTemplates.find((g) => g.id === id);
    if (!template) return;
    setEditingId(id);
    setEditName(template.name);
    setEditDescription(template.description);
    setDeletingId(null);
  }

  function handleEditSave(id: string) {
    const template = goalTemplates.find((g) => g.id === id);
    if (!template) return;
    dispatch({
      type: 'UPDATE_GOAL_TEMPLATE',
      payload: { ...template, name: editName.trim(), description: editDescription.trim() },
    });
    setEditingId(null);
  }

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_GOAL_TEMPLATE', payload: id });
    setDeletingId(null);
  }

  function formatGoalsSummary(goals: { certTypeId: string; targetPercentage: number | null; targetDollarAmount: number | null; goalType: string }[]): string {
    if (goals.length === 0) return 'No goals';
    return goals
      .map((g) => {
        const ct = certificationTypes.find((c) => c.id === g.certTypeId);
        const code = ct?.code ?? g.certTypeId;
        if (g.goalType === 'percentage' && g.targetPercentage !== null) {
          return `${code}: ${g.targetPercentage}%`;
        }
        if (g.goalType === 'dollar' && g.targetDollarAmount !== null) {
          return `${code}: $${g.targetDollarAmount.toLocaleString()}`;
        }
        return code;
      })
      .join(', ');
  }

  const inputStyle = {
    backgroundColor: 'var(--color-bg-tertiary)',
    color: 'var(--color-text)',
    borderColor: 'var(--color-border)',
  };

  return (
    <Section
      title="Goal Templates"
      description="Saved goal templates that can be applied when creating new projects."
    >
      {goalTemplates.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No goal templates saved yet. Create templates from the Projects page.
        </p>
      ) : (
        <div className="space-y-2">
          {goalTemplates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border p-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {editingId === template.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        Name
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-lg px-3 py-2 text-sm border"
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        Description
                      </label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="rounded-lg px-3 py-2 text-sm border"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleEditSave(template.id)}
                      disabled={!editName.trim()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : deletingId === template.id ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm flex-1" style={{ color: 'var(--color-text)' }}>
                    Delete template "{template.name}"?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDeletingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Trash2 size={13} />}
                      onClick={() => handleDelete(template.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {template.name}
                    </p>
                    {template.description && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {template.description}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatGoalsSummary(template.goals)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Pencil size={13} />}
                      onClick={() => startEdit(template.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 size={13} />}
                      onClick={() => {
                        setDeletingId(template.id);
                        setEditingId(null);
                      }}
                      style={{ color: 'var(--color-danger)' }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Reset Section
// ---------------------------------------------------------------------------

type ResetStep = 'idle' | 'confirm-warning' | 'confirm-type';

function ResetSection() {
  const { dispatch } = useAppContext();
  const [step, setStep] = useState<ResetStep>('idle');
  const [typed, setTyped] = useState('');

  function handleReset() {
    if (typed !== 'RESET') return;
    dispatch({ type: 'RESET_DATA' });
    setStep('idle');
    setTyped('');
  }

  return (
    <Section
      title="Reset All Data"
      description="Permanently delete all suppliers, transactions, projects, and settings. This cannot be undone."
    >
      {step === 'idle' && (
        <Button
          variant="danger"
          size="sm"
          leftIcon={<Trash2 size={14} />}
          onClick={() => setStep('confirm-warning')}
        >
          Reset All Data
        </Button>
      )}

      {step === 'confirm-warning' && (
        <div
          className="rounded-lg border p-4 space-y-4"
          style={{
            borderColor: 'var(--color-danger)',
            backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Warning: This will permanently delete all data
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                All suppliers, transactions, projects, goal templates, and column mappings will be deleted. Certification types will be reset to defaults. This action cannot be undone. Consider exporting a backup first.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep('idle')}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setStep('confirm-type')}
            >
              I Understand, Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm-type' && (
        <div
          className="rounded-lg border p-4 space-y-4"
          style={{
            borderColor: 'var(--color-danger)',
            backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
          }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Type <code className="font-mono px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>RESET</code> to confirm
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type RESET"
            className="rounded-lg px-3 py-2 text-sm border w-full max-w-xs"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
              borderColor: 'var(--color-border)',
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep('idle');
                setTyped('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              disabled={typed !== 'RESET'}
              onClick={handleReset}
            >
              Reset All Data
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DataManagement() {
  return (
    <div className="space-y-6">
      <BackupSection />
      <ImportTemplatesSection />
      <GoalTemplatesSection />
      <ResetSection />
    </div>
  );
}

export default DataManagement;
