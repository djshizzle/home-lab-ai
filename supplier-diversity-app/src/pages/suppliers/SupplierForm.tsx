import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useAppContext } from '@/store';
import { Button } from '@/components/ui/Button';
import { generateId, formatDate } from '@/lib/utils';
import type { Supplier, SupplierCertification, Note } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CertRow {
  certTypeId: string;
  certNumber: string;
  issuedDate: string;
  expirationDate: string;
}

const EMPTY_CERT: CertRow = {
  certTypeId: '',
  certNumber: '',
  issuedDate: '',
  expirationDate: '',
};

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-secondary)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
};

const labelClass = 'block text-xs font-medium mb-1';
const labelStyle: React.CSSProperties = { color: 'var(--color-text-secondary)' };

const fieldClass =
  'w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

// ---------------------------------------------------------------------------
// FieldError — declared outside render to satisfy react-hooks/static-components
// ---------------------------------------------------------------------------

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// SupplierForm
// ---------------------------------------------------------------------------

export function SupplierForm() {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const { supplierId } = useParams<{ supplierId: string }>();

  const isEditing = Boolean(supplierId);
  const existing = useMemo(
    () => (supplierId ? state.suppliers.find((s) => s.id === supplierId) : undefined),
    [supplierId, state.suppliers],
  );

  // ---------------------------------------------------------------------------
  // Core field state
  // ---------------------------------------------------------------------------

  const [companyName, setCompanyName] = useState(existing?.companyName ?? '');
  const [contactName, setContactName] = useState(existing?.contactName ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [supplierState, setSupplierState] = useState(existing?.state ?? '');
  const [zip, setZip] = useState(existing?.zip ?? '');
  const [naicsInput, setNaicsInput] = useState(existing?.naicsCodes.join(', ') ?? '');
  const [capabilities, setCapabilities] = useState(existing?.capabilities ?? '');
  const [status, setStatus] = useState<Supplier['status']>(existing?.status ?? 'pending');

  // ---------------------------------------------------------------------------
  // Certifications state
  // ---------------------------------------------------------------------------

  const [certRows, setCertRows] = useState<CertRow[]>(
    existing?.certifications.length
      ? existing.certifications.map((c) => ({
          certTypeId: c.certTypeId,
          certNumber: c.certNumber,
          issuedDate: c.issuedDate,
          expirationDate: c.expirationDate,
        }))
      : [],
  );

  const addCertRow = () => setCertRows((prev) => [...prev, { ...EMPTY_CERT }]);

  const removeCertRow = (index: number) =>
    setCertRows((prev) => prev.filter((_, i) => i !== index));

  const updateCertRow = (index: number, field: keyof CertRow, value: string) =>
    setCertRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  // ---------------------------------------------------------------------------
  // Notes state
  // ---------------------------------------------------------------------------

  const [existingNotes] = useState<Note[]>(existing?.notes ?? []);
  const [newNoteText, setNewNoteText] = useState('');

  // ---------------------------------------------------------------------------
  // Validation errors
  // ---------------------------------------------------------------------------

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!companyName.trim()) next.companyName = 'Company name is required.';
    if (!contactName.trim()) next.contactName = 'Contact name is required.';
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  function handleSave() {
    if (!validate()) return;

    const naicsCodes = naicsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const certifications: SupplierCertification[] = certRows
      .filter((r) => r.certTypeId)
      .map((r) => ({
        certTypeId: r.certTypeId,
        certNumber: r.certNumber,
        issuedDate: r.issuedDate,
        expirationDate: r.expirationDate,
      }));

    const notesToSave: Note[] = [...existingNotes];
    if (newNoteText.trim()) {
      notesToSave.push({
        id: generateId(),
        text: newNoteText.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    const now = new Date().toISOString();

    if (isEditing && existing) {
      const updated: Supplier = {
        ...existing,
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: supplierState.trim(),
        zip: zip.trim(),
        naicsCodes,
        capabilities: capabilities.trim(),
        status,
        certifications,
        notes: notesToSave,
        updatedAt: now,
      };
      dispatch({ type: 'UPDATE_SUPPLIER', payload: updated });
      navigate(`/suppliers/${existing.id}`);
    } else {
      const supplier: Supplier = {
        id: generateId(),
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: supplierState.trim(),
        zip: zip.trim(),
        naicsCodes,
        capabilities: capabilities.trim(),
        status,
        certifications,
        notes: notesToSave,
        createdAt: now,
        updatedAt: now,
      };
      dispatch({ type: 'ADD_SUPPLIER', payload: supplier });
      navigate('/suppliers');
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
          aria-label="Go back"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          {isEditing ? 'Edit Supplier' : 'Add Supplier'}
        </h1>
      </div>

      {/* Core Information */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Company Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Company Name */}
          <div className="sm:col-span-2">
            <label htmlFor="companyName" className={labelClass} style={labelStyle}>
              Company Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={fieldClass}
              style={inputStyle}
              placeholder="Acme Corp"
            />
            <FieldError message={errors.companyName} />
          </div>

          {/* Contact Name */}
          <div>
            <label htmlFor="contactName" className={labelClass} style={labelStyle}>
              Contact Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="contactName"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className={fieldClass}
              style={inputStyle}
              placeholder="Jane Smith"
            />
            <FieldError message={errors.contactName} />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={labelClass} style={labelStyle}>
              Email <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              style={inputStyle}
              placeholder="jane@acme.com"
            />
            <FieldError message={errors.email} />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className={labelClass} style={labelStyle}>
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={fieldClass}
              style={inputStyle}
              placeholder="(555) 000-0000"
            />
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className={labelClass} style={labelStyle}>
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Supplier['status'])}
              className={fieldClass}
              style={inputStyle}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Address */}
          <div className="sm:col-span-2">
            <label htmlFor="address" className={labelClass} style={labelStyle}>
              Street Address
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={fieldClass}
              style={inputStyle}
              placeholder="123 Main St"
            />
          </div>

          {/* City */}
          <div>
            <label htmlFor="city" className={labelClass} style={labelStyle}>
              City
            </label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={fieldClass}
              style={inputStyle}
              placeholder="Springfield"
            />
          </div>

          {/* State */}
          <div>
            <label htmlFor="supplierState" className={labelClass} style={labelStyle}>
              State
            </label>
            <input
              id="supplierState"
              type="text"
              value={supplierState}
              onChange={(e) => setSupplierState(e.target.value)}
              className={fieldClass}
              style={inputStyle}
              placeholder="IL"
              maxLength={2}
            />
          </div>

          {/* ZIP */}
          <div>
            <label htmlFor="zip" className={labelClass} style={labelStyle}>
              ZIP Code
            </label>
            <input
              id="zip"
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className={fieldClass}
              style={inputStyle}
              placeholder="62701"
            />
          </div>

          {/* NAICS Codes */}
          <div>
            <label htmlFor="naicsCodes" className={labelClass} style={labelStyle}>
              NAICS Codes
            </label>
            <input
              id="naicsCodes"
              type="text"
              value={naicsInput}
              onChange={(e) => setNaicsInput(e.target.value)}
              className={fieldClass}
              style={inputStyle}
              placeholder="541512, 541511"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Comma-separated NAICS codes
            </p>
          </div>

          {/* Capabilities */}
          <div className="sm:col-span-2">
            <label htmlFor="capabilities" className={labelClass} style={labelStyle}>
              Capabilities
            </label>
            <textarea
              id="capabilities"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              rows={3}
              className={fieldClass}
              style={inputStyle}
              placeholder="Describe the supplier's services and capabilities…"
            />
          </div>
        </div>
      </div>

      {/* Certifications */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            Certifications
          </h2>
          <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={addCertRow}>
            Add Certification
          </Button>
        </div>

        {certRows.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            No certifications added yet.
          </p>
        ) : (
          <div className="space-y-4">
            {certRows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-lg"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {/* Cert type */}
                <div>
                  <label
                    htmlFor={`cert-type-${i}`}
                    className={labelClass}
                    style={labelStyle}
                  >
                    Cert Type
                  </label>
                  <select
                    id={`cert-type-${i}`}
                    value={row.certTypeId}
                    onChange={(e) => updateCertRow(i, 'certTypeId', e.target.value)}
                    className={fieldClass}
                    style={inputStyle}
                  >
                    <option value="">Select…</option>
                    {state.certificationTypes.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.code} — {ct.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cert number */}
                <div>
                  <label
                    htmlFor={`cert-num-${i}`}
                    className={labelClass}
                    style={labelStyle}
                  >
                    Cert Number
                  </label>
                  <input
                    id={`cert-num-${i}`}
                    type="text"
                    value={row.certNumber}
                    onChange={(e) => updateCertRow(i, 'certNumber', e.target.value)}
                    className={fieldClass}
                    style={inputStyle}
                    placeholder="CERT-12345"
                  />
                </div>

                {/* Issued date */}
                <div>
                  <label
                    htmlFor={`cert-issued-${i}`}
                    className={labelClass}
                    style={labelStyle}
                  >
                    Issued Date
                  </label>
                  <input
                    id={`cert-issued-${i}`}
                    type="date"
                    value={row.issuedDate}
                    onChange={(e) => updateCertRow(i, 'issuedDate', e.target.value)}
                    className={fieldClass}
                    style={inputStyle}
                  />
                </div>

                {/* Expiration date + remove */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label
                      htmlFor={`cert-exp-${i}`}
                      className={labelClass}
                      style={labelStyle}
                    >
                      Expiration Date
                    </label>
                    <input
                      id={`cert-exp-${i}`}
                      type="date"
                      value={row.expirationDate}
                      onChange={(e) => updateCertRow(i, 'expirationDate', e.target.value)}
                      className={fieldClass}
                      style={inputStyle}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCertRow(i)}
                    className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150 mb-0.5"
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-danger)',
                      cursor: 'pointer',
                    }}
                    aria-label={`Remove certification ${i + 1}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Notes
        </h2>

        {/* Existing notes */}
        {existingNotes.length > 0 && (
          <ul
            className="divide-y mb-4"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {existingNotes.map((note) => (
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

        {/* New note */}
        <div>
          <label htmlFor="newNote" className={labelClass} style={labelStyle}>
            Add a Note
          </label>
          <textarea
            id="newNote"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            rows={3}
            className={fieldClass}
            style={inputStyle}
            placeholder="Type a note about this supplier…"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          {isEditing ? 'Save Changes' : 'Add Supplier'}
        </Button>
      </div>
    </div>
  );
}

export default SupplierForm;
