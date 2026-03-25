import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useAppContext } from '@/store';
import { generateId } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { Transaction } from '@/types';

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

interface FormState {
  date: string;
  supplierId: string;
  projectId: string;
  amount: string;
  tier: 1 | 2 | 3;
  description: string;
  scope: string;
}

const EMPTY_FORM: FormState = {
  date: '',
  supplierId: '',
  projectId: '',
  amount: '',
  tier: 1,
  description: '',
  scope: '',
};

function transactionToForm(t: Transaction): FormState {
  return {
    date: t.date,
    supplierId: t.supplierId,
    projectId: t.projectId,
    amount: String(t.amount),
    tier: t.tier,
    description: t.description,
    scope: t.scope,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionForm() {
  const { transactionId } = useParams<{ transactionId?: string }>();
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();

  const isEditing = Boolean(transactionId);
  const existing = transactionId
    ? state.transactions.find((t) => t.id === transactionId)
    : undefined;

  const [form, setForm] = useState<FormState>(() =>
    existing ? transactionToForm(existing) : EMPTY_FORM
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Form is pre-populated via lazy initializer; no sync effect needed.

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.date) next.date = 'Date is required.';
    if (!form.supplierId) next.supplierId = 'Supplier is required.';
    if (!form.projectId) next.projectId = 'Project is required.';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      next.amount = 'Enter a valid positive amount.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: existing?.id ?? generateId(),
      date: form.date,
      supplierId: form.supplierId,
      projectId: form.projectId,
      amount: Number(form.amount),
      tier: form.tier,
      description: form.description,
      scope: form.scope,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    dispatch({
      type: isEditing ? 'UPDATE_TRANSACTION' : 'ADD_TRANSACTION',
      payload: transaction,
    });

    navigate('/spend');
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          {isEditing ? 'Edit Transaction' : 'Add Transaction'}
        </h1>
      </div>

      {/* Form card */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {/* Date */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="txn-date"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              Date <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="txn-date"
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: errors.date ? 'var(--color-danger)' : 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
              aria-describedby={errors.date ? 'txn-date-err' : undefined}
            />
            {errors.date && (
              <span
                id="txn-date-err"
                className="text-xs"
                style={{ color: 'var(--color-danger)' }}
              >
                {errors.date}
              </span>
            )}
          </div>

          {/* Supplier */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="txn-supplier"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              Supplier <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select
              id="txn-supplier"
              value={form.supplierId}
              onChange={(e) => set('supplierId', e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: errors.supplierId
                  ? 'var(--color-danger)'
                  : 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
              aria-describedby={errors.supplierId ? 'txn-supplier-err' : undefined}
            >
              <option value="">— Select supplier —</option>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.companyName}
                </option>
              ))}
            </select>
            {errors.supplierId && (
              <span
                id="txn-supplier-err"
                className="text-xs"
                style={{ color: 'var(--color-danger)' }}
              >
                {errors.supplierId}
              </span>
            )}
          </div>

          {/* Project */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="txn-project"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              Project <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select
              id="txn-project"
              value={form.projectId}
              onChange={(e) => set('projectId', e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: errors.projectId
                  ? 'var(--color-danger)'
                  : 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
              aria-describedby={errors.projectId ? 'txn-project-err' : undefined}
            >
              <option value="">— Select project —</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.projectId && (
              <span
                id="txn-project-err"
                className="text-xs"
                style={{ color: 'var(--color-danger)' }}
              >
                {errors.projectId}
              </span>
            )}
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="txn-amount"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              Amount ($) <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="txn-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: errors.amount ? 'var(--color-danger)' : 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
              aria-describedby={errors.amount ? 'txn-amount-err' : undefined}
            />
            {errors.amount && (
              <span
                id="txn-amount-err"
                className="text-xs"
                style={{ color: 'var(--color-danger)' }}
              >
                {errors.amount}
              </span>
            )}
          </div>

          {/* Tier */}
          <div className="flex flex-col gap-2">
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              Tier <span style={{ color: 'var(--color-danger)' }}>*</span>
            </span>
            <div className="flex gap-4">
              {([1, 2, 3] as const).map((tier) => (
                <label
                  key={tier}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                  style={{ color: 'var(--color-text)' }}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={tier}
                    checked={form.tier === tier}
                    onChange={() => set('tier', tier)}
                    className="accent-[var(--color-primary)]"
                  />
                  Tier {tier}
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="txn-description"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              Description
            </label>
            <input
              id="txn-description"
              type="text"
              placeholder="Brief description..."
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Scope */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="txn-scope"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              Scope
            </label>
            <textarea
              id="txn-scope"
              rows={3}
              placeholder="Scope of work..."
              value={form.scope}
              onChange={(e) => set('scope', e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm resize-y"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" leftIcon={<Save size={16} />}>
              {isEditing ? 'Save Changes' : 'Add Transaction'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              leftIcon={<X size={16} />}
              onClick={() => navigate('/spend')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TransactionForm;
