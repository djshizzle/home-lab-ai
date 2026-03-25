import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useAppContext } from '@/store';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Supplier, CertificationType } from '@/types';

// ---------------------------------------------------------------------------
// Color helpers — maps Tailwind color strings like "blue-600" to hex
// ---------------------------------------------------------------------------

const TAILWIND_COLOR_MAP: Record<string, string> = {
  'blue-600': '#2563eb',
  'pink-600': '#db2777',
  'green-600': '#16a34a',
  'purple-600': '#9333ea',
  'orange-600': '#ea580c',
  'red-600': '#dc2626',
  'gray-400': '#94a3b8',
};

function resolveColor(tailwindColor: string): string {
  return TAILWIND_COLOR_MAP[tailwindColor] ?? '#94a3b8';
}

// ---------------------------------------------------------------------------
// Status badge variant mapping
// ---------------------------------------------------------------------------

const STATUS_VARIANT = {
  active: 'green',
  pending: 'yellow',
  inactive: 'gray',
  suspended: 'red',
} as const satisfies Record<Supplier['status'], 'green' | 'yellow' | 'gray' | 'red'>;

// ---------------------------------------------------------------------------
// Days until expiry color coding
// ---------------------------------------------------------------------------

function expiryColor(days: number): string {
  if (days < 0) return 'var(--color-danger)';
  if (days < 30) return 'var(--color-danger)';
  if (days < 60) return 'var(--color-warning)';
  return 'var(--color-success)';
}

function daysUntilExpiry(expirationDate: string): number {
  const exp = new Date(expirationDate).getTime();
  const now = Date.now();
  return Math.ceil((exp - now) / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
      <h2
        className="text-base font-semibold mb-4"
        style={{ color: 'var(--color-text)' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info row helper
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <span
        className="text-xs font-medium uppercase tracking-wide w-32 flex-shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      <span className="text-sm mt-0.5 sm:mt-0" style={{ color: 'var(--color-text)' }}>
        {value || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spend summary helpers
// ---------------------------------------------------------------------------

interface SpendByTier {
  tier: 1 | 2 | 3;
  amount: number;
}

interface SpendByProject {
  projectId: string;
  projectName: string;
  amount: number;
}

const TIER_COLORS: Record<1 | 2 | 3, string> = {
  1: '#2563eb',
  2: '#10b981',
  3: '#f59e0b',
};

// ---------------------------------------------------------------------------
// SupplierDetail
// ---------------------------------------------------------------------------

export function SupplierDetail() {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const { supplierId } = useParams<{ supplierId: string }>();

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const supplier = useMemo(
    () => state.suppliers.find((s) => s.id === supplierId),
    [supplierId, state.suppliers],
  );

  // Compute spend data
  const supplierTransactions = useMemo(
    () => state.transactions.filter((t) => t.supplierId === supplierId),
    [supplierId, state.transactions],
  );

  const totalSpend = useMemo(
    () => supplierTransactions.reduce((sum, t) => sum + t.amount, 0),
    [supplierTransactions],
  );

  const spendByTier = useMemo<SpendByTier[]>(() => {
    const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const t of supplierTransactions) {
      totals[t.tier] = (totals[t.tier] ?? 0) + t.amount;
    }
    return ([1, 2, 3] as const)
      .filter((tier) => totals[tier] > 0)
      .map((tier) => ({ tier, amount: totals[tier] }));
  }, [supplierTransactions]);

  const spendByProject = useMemo<SpendByProject[]>(() => {
    const totals: Record<string, number> = {};
    for (const t of supplierTransactions) {
      totals[t.projectId] = (totals[t.projectId] ?? 0) + t.amount;
    }
    return Object.entries(totals)
      .map(([projectId, amount]) => {
        const project = state.projects.find((p) => p.id === projectId);
        return {
          projectId,
          projectName: project?.name ?? projectId,
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [supplierTransactions, state.projects]);

  // ---------------------------------------------------------------------------
  // Not found
  // ---------------------------------------------------------------------------

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
          Supplier not found.
        </p>
        <Button variant="secondary" onClick={() => navigate('/suppliers')}>
          Back to Directory
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  function handleDelete() {
    dispatch({ type: 'DELETE_SUPPLIER', payload: supplier!.id });
    navigate('/suppliers');
  }

  // ---------------------------------------------------------------------------
  // Cert type lookup helpers
  // ---------------------------------------------------------------------------

  function getCertType(certTypeId: string): CertificationType | undefined {
    return state.certificationTypes.find((c) => c.id === certTypeId);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div
        className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/suppliers')}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 flex-shrink-0"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
              aria-label="Back to directory"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h1
                className="text-xl font-bold truncate"
                style={{ color: 'var(--color-text)' }}
              >
                {supplier.companyName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant={STATUS_VARIANT[supplier.status]}>
                  {supplier.status.charAt(0).toUpperCase() + supplier.status.slice(1)}
                </Badge>
                {supplier.certifications.map((cert) => {
                  const ct = getCertType(cert.certTypeId);
                  if (!ct) return null;
                  const hex = resolveColor(ct.color);
                  return (
                    <span
                      key={cert.certTypeId}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: hex + '20', color: hex }}
                    >
                      {ct.code}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Pencil size={14} />}
              onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={() => setShowDeleteModal(true)}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <Section title="Contact Information">
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <InfoRow label="Contact" value={supplier.contactName} />
          <InfoRow label="Email" value={supplier.email} />
          <InfoRow label="Phone" value={supplier.phone} />
          <InfoRow
            label="Address"
            value={
              [supplier.address, supplier.city, supplier.state, supplier.zip]
                .filter(Boolean)
                .join(', ') || undefined
            }
          />
          <InfoRow
            label="NAICS Codes"
            value={
              supplier.naicsCodes.length > 0
                ? supplier.naicsCodes.join(', ')
                : undefined
            }
          />
          <InfoRow
            label="Capabilities"
            value={supplier.capabilities || undefined}
          />
        </div>
      </Section>

      {/* Spend Summary */}
      <Section title="Spend Summary">
        {supplierTransactions.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            No spend transactions recorded for this supplier.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Total */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Total Spend
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(totalSpend)}
              </p>
            </div>

            {/* By Tier */}
            {spendByTier.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  By Tier
                </p>
                <div className="space-y-2">
                  {spendByTier.map(({ tier, amount }) => {
                    const pct = totalSpend > 0 ? (amount / totalSpend) * 100 : 0;
                    const color = TIER_COLORS[tier];
                    return (
                      <div key={tier}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            Tier {tier}
                          </span>
                          <span style={{ color: 'var(--color-text)' }}>
                            {formatCurrency(amount)}{' '}
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              ({pct.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                        <div
                          className="w-full rounded-full h-2"
                          style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                        >
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* By Project */}
            {spendByProject.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  By Project
                </p>
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['Project', 'Amount'].map((h) => (
                          <th
                            key={h}
                            className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                            style={{
                              color: 'var(--color-text-muted)',
                              backgroundColor: 'var(--color-bg-secondary)',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {spendByProject.map(({ projectId, projectName, amount }) => (
                        <tr
                          key={projectId}
                          style={{ borderBottom: '1px solid var(--color-border)' }}
                        >
                          <td
                            className="px-6 py-2"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {projectName}
                          </td>
                          <td
                            className="px-6 py-2 font-medium"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Certifications */}
      <Section title="Certifications">
        {supplier.certifications.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            No certifications on file.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Cert Type', 'Cert Number', 'Issued', 'Expires', 'Days Until Expiry'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{
                          color: 'var(--color-text-muted)',
                          backgroundColor: 'var(--color-bg-secondary)',
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {supplier.certifications.map((cert, i) => {
                  const ct = getCertType(cert.certTypeId);
                  const hex = ct ? resolveColor(ct.color) : '#94a3b8';
                  const days = daysUntilExpiry(cert.expirationDate);
                  const dayColor = expiryColor(days);
                  return (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                    >
                      <td className="px-6 py-3">
                        {ct ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: hex + '20', color: hex }}
                          >
                            {ct.code}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            {cert.certTypeId}
                          </span>
                        )}
                      </td>
                      <td
                        className="px-6 py-3"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {cert.certNumber || (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td
                        className="px-6 py-3 whitespace-nowrap"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {cert.issuedDate ? formatDate(cert.issuedDate) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td
                        className="px-6 py-3 whitespace-nowrap"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {cert.expirationDate ? formatDate(cert.expirationDate) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        {cert.expirationDate ? (
                          <span className="text-xs font-semibold" style={{ color: dayColor }}>
                            {days < 0
                              ? `Expired ${Math.abs(days)}d ago`
                              : `${days}d`}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Notes */}
      <Section title="Notes">
        {supplier.notes.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            No notes yet.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {[...supplier.notes]
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              )
              .map((note) => (
                <li key={note.id} className="py-3">
                  <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                    {note.text}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {formatDate(note.createdAt)}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </Section>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Supplier"
        size="sm"
      >
        <p className="text-sm" style={{ color: 'var(--color-text)' }}>
          Are you sure you want to delete{' '}
          <strong>{supplier.companyName}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete Supplier
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default SupplierDetail;
