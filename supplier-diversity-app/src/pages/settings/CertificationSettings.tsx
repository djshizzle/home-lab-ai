import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useAppContext } from '@/store';
import { generateId } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { CertificationType } from '@/types';

// ---------------------------------------------------------------------------
// Color swatch presets
// ---------------------------------------------------------------------------

const COLOR_PRESETS = [
  'blue-600',
  'pink-600',
  'green-600',
  'purple-600',
  'orange-600',
  'red-600',
  'teal-600',
  'amber-600',
  'indigo-600',
  'cyan-600',
] as const;

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
};

function resolveHex(color: string): string {
  return TAILWIND_COLOR_MAP[color] ?? '#94a3b8';
}

// ---------------------------------------------------------------------------
// Color picker sub-component
// ---------------------------------------------------------------------------

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          title={color}
          className="w-7 h-7 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            backgroundColor: resolveHex(color),
            borderColor: value === color ? 'var(--color-text)' : 'transparent',
            boxShadow: value === color ? '0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-text)' : undefined,
          }}
          aria-label={color}
          aria-pressed={value === color}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline add form
// ---------------------------------------------------------------------------

interface AddFormProps {
  onSubmit: (code: string, label: string, color: string) => void;
  onCancel: () => void;
}

function AddForm({ onSubmit, onCancel }: AddFormProps) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<string>('blue-600');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimCode = code.trim().toUpperCase();
    const trimLabel = label.trim();
    if (!trimCode || !trimLabel) return;
    onSubmit(trimCode, trimLabel, color);
  }

  const inputStyle = {
    backgroundColor: 'var(--color-bg-tertiary)',
    color: 'var(--color-text)',
    borderColor: 'var(--color-border)',
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-4 space-y-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        Add Certification Type
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Code <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. MBE"
            maxLength={20}
            className="rounded-lg px-3 py-2 text-sm border"
            style={inputStyle}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Label <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Minority Business Enterprise"
            className="rounded-lg px-3 py-2 text-sm border"
            style={inputStyle}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Color
        </label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" leftIcon={<Check size={14} />}>
          Add
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inline edit form
// ---------------------------------------------------------------------------

interface EditFormProps {
  certType: CertificationType;
  onSave: (updated: CertificationType) => void;
  onCancel: () => void;
}

function EditForm({ certType, onSave, onCancel }: EditFormProps) {
  const [code, setCode] = useState(certType.code);
  const [label, setLabel] = useState(certType.label);
  const [color, setColor] = useState(certType.color);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimCode = code.trim().toUpperCase();
    const trimLabel = label.trim();
    if (!trimCode || !trimLabel) return;
    onSave({ ...certType, code: trimCode, label: trimLabel, color });
  }

  const inputStyle = {
    backgroundColor: 'var(--color-bg-tertiary)',
    color: 'var(--color-text)',
    borderColor: 'var(--color-border)',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={20}
            className="rounded-lg px-3 py-2 text-sm border"
            style={inputStyle}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm border"
            style={inputStyle}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Color
        </label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" leftIcon={<X size={14} />} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" leftIcon={<Check size={14} />}>
          Save
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CertificationSettings() {
  const { state, dispatch } = useAppContext();
  const { certificationTypes } = state;

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd(code: string, label: string, color: string) {
    const newCert: CertificationType = {
      id: generateId(),
      code,
      label,
      color,
    };
    dispatch({ type: 'ADD_CERT_TYPE', payload: newCert });
    setShowAddForm(false);
  }

  function handleUpdate(updated: CertificationType) {
    dispatch({ type: 'UPDATE_CERT_TYPE', payload: updated });
    setEditingId(null);
  }

  function handleDeleteConfirm(id: string) {
    dispatch({ type: 'DELETE_CERT_TYPE', payload: id });
    setDeletingId(null);
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            Certification Types
          </h2>
          {!showAddForm && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => setShowAddForm(true)}
            >
              Add Certification Type
            </Button>
          )}
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Manage the certification types used across the application. These appear as badges on suppliers and as goal categories on projects.
        </p>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-6">
            <AddForm onSubmit={handleAdd} onCancel={() => setShowAddForm(false)} />
          </div>
        )}

        {/* List */}
        {certificationTypes.length === 0 ? (
          <div
            className="text-center py-10 text-sm rounded-lg border border-dashed"
            style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
          >
            No certification types yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Color', 'Code', 'Label', 'Actions'].map((h) => (
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
                {certificationTypes.map((ct) => (
                  <tr key={ct.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {editingId === ct.id ? (
                      <td colSpan={4} className="py-3 px-3">
                        <EditForm
                          certType={ct}
                          onSave={handleUpdate}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    ) : deletingId === ct.id ? (
                      <td colSpan={4} className="py-3 px-3">
                        <div
                          className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                          style={{
                            borderColor: 'var(--color-danger)',
                            backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
                          }}
                        >
                          <p className="text-sm flex-1" style={{ color: 'var(--color-text)' }}>
                            <strong>Delete "{ct.label}"?</strong> This will remove this cert type from all suppliers. Are you sure?
                          </p>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              leftIcon={<Trash2 size={14} />}
                              onClick={() => handleDeleteConfirm(ct.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="py-3 px-3">
                          <div
                            className="w-5 h-5 rounded-full"
                            style={{ backgroundColor: resolveHex(ct.color) }}
                            title={ct.color}
                          />
                        </td>
                        <td
                          className="py-3 px-3 font-mono font-semibold text-xs"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {ct.code}
                        </td>
                        <td className="py-3 px-3" style={{ color: 'var(--color-text)' }}>
                          {ct.label}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Pencil size={13} />}
                              onClick={() => {
                                setEditingId(ct.id);
                                setDeletingId(null);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Trash2 size={13} />}
                              onClick={() => {
                                setDeletingId(ct.id);
                                setEditingId(null);
                              }}
                              style={{ color: 'var(--color-danger)' }}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CertificationSettings;
