import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Upload,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { useAppContext } from '@/store';
import { generateId, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Transaction, ColumnMapping } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceType = 'generic' | 'procore-budget' | 'procore-commitment' | 'procore-direct-cost';

interface AppFieldMapping {
  date: string;
  supplier: string;
  project: string;
  amount: string;
  tier: string;
  description: string;
}

const EMPTY_MAPPING: AppFieldMapping = {
  date: '',
  supplier: '',
  project: '',
  amount: '',
  tier: '',
  description: '',
};

interface ParsedRow {
  date: string;
  supplier: string;
  project: string;
  amount: number | null;
  tier: 1 | 2 | 3;
  description: string;
  _errors: string[];
}

// ---------------------------------------------------------------------------
// Procore pre-built mappings
// ---------------------------------------------------------------------------

const PROCORE_MAPPINGS: Record<
  'procore-budget' | 'procore-commitment' | 'procore-direct-cost',
  AppFieldMapping
> = {
  'procore-budget': {
    date: 'Date',
    supplier: 'Vendor',
    project: 'Project',
    amount: 'Amount',
    tier: '',
    description: 'Description',
  },
  'procore-commitment': {
    date: 'Created At',
    supplier: 'Vendor/Company',
    project: 'Project Name',
    amount: 'Grand Total',
    tier: '',
    description: 'Title',
  },
  'procore-direct-cost': {
    date: 'Date',
    supplier: 'Vendor',
    project: 'Project',
    amount: 'Amount',
    tier: '',
    description: 'Description',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTier(raw: string): 1 | 2 | 3 {
  const v = raw?.trim();
  if (v === '2') return 2;
  if (v === '3') return 3;
  return 1;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n) || n < 0) return null;
  return n;
}

function stepLabel(step: number): string {
  switch (step) {
    case 1: return 'Upload File';
    case 2: return 'Map Columns';
    case 3: return 'Preview';
    case 4: return 'Confirm';
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpendImport() {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 state
  const [sourceType, setSourceType] = useState<SourceType>('generic');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [fileError, setFileError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 2 state
  const [mapping, setMapping] = useState<AppFieldMapping>(EMPTY_MAPPING);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Step 3/4 state
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);

  // ---------------------------------------------------------------------------
  // File processing
  // ---------------------------------------------------------------------------

  const processFile = useCallback(
    (file: File) => {
      setFileError('');
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
        setFileError('Only .xlsx, .xls, and .csv files are supported.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
            raw: false,
            defval: '',
          });

          if (jsonData.length === 0) {
            setFileError('The file appears to be empty.');
            return;
          }

          const fileHeaders = Object.keys(jsonData[0]);
          setHeaders(fileHeaders);
          setRawRows(jsonData);
          setFileName(file.name);

          // Apply Procore pre-built mapping if applicable
          if (sourceType !== 'generic') {
            setMapping(PROCORE_MAPPINGS[sourceType as keyof typeof PROCORE_MAPPINGS]);
          } else {
            setMapping(EMPTY_MAPPING);
          }
        } catch {
          setFileError('Failed to parse the file. Please ensure it is a valid Excel or CSV file.');
        }
      };
      reader.readAsBinaryString(file);
    },
    [sourceType]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  const goToStep2 = () => {
    if (!fileName || rawRows.length === 0) {
      setFileError('Please upload a file first.');
      return;
    }
    setStep(2);
  };

  const goToStep3 = () => {
    if (!mapping.date || !mapping.supplier || !mapping.amount) {
      return; // validation shown inline
    }

    const preview = rawRows.map((row): ParsedRow => {
      const errs: string[] = [];
      const dateVal = mapping.date ? row[mapping.date] ?? '' : '';
      const supplierVal = mapping.supplier ? row[mapping.supplier] ?? '' : '';
      const projectVal = mapping.project ? row[mapping.project] ?? '' : '';
      const amountRaw = mapping.amount ? row[mapping.amount] ?? '' : '';
      const tierRaw = mapping.tier ? row[mapping.tier] ?? '' : '';
      const descVal = mapping.description ? row[mapping.description] ?? '' : '';

      if (!dateVal) errs.push('Missing date');
      if (!supplierVal) errs.push('Missing supplier');
      const parsedAmount = parseAmount(amountRaw);
      if (parsedAmount === null) errs.push('Invalid amount');

      return {
        date: dateVal,
        supplier: supplierVal,
        project: projectVal,
        amount: parsedAmount,
        tier: parseTier(tierRaw),
        description: descVal,
        _errors: errs,
      };
    });

    setPreviewRows(preview);
    setStep(3);
  };

  const goToStep4 = () => {
    setStep(4);
  };

  const handleSaveTemplate = () => {
    if (!saveTemplateName.trim()) return;
    const columnMapping: ColumnMapping = {
      id: generateId(),
      name: saveTemplateName.trim(),
      sourceType,
      mappings: { ...mapping },
    };
    dispatch({ type: 'ADD_COLUMN_MAPPING', payload: columnMapping });
    setSaveTemplateName('');
    setShowSaveTemplate(false);
  };

  const handleApplyStoredTemplate = (templateId: string) => {
    const template = state.columnMappings.find((m) => m.id === templateId);
    if (!template) return;
    setMapping({
      date: template.mappings['date'] ?? '',
      supplier: template.mappings['supplier'] ?? '',
      project: template.mappings['project'] ?? '',
      amount: template.mappings['amount'] ?? '',
      tier: template.mappings['tier'] ?? '',
      description: template.mappings['description'] ?? '',
    });
  };

  const handleImport = () => {
    const validRows = previewRows.filter((r) => r._errors.length === 0);
    const now = new Date().toISOString();

    const transactions: Transaction[] = validRows.map((row): Transaction => {
      // Try to match supplier by company name
      const matchedSupplier = state.suppliers.find(
        (s) => s.companyName.toLowerCase() === row.supplier.toLowerCase()
      );
      // Try to match project by name
      const matchedProject = state.projects.find(
        (p) => p.name.toLowerCase() === row.project.toLowerCase()
      );

      return {
        id: generateId(),
        date: row.date,
        supplierId: matchedSupplier?.id ?? row.supplier,
        projectId: matchedProject?.id ?? row.project,
        amount: row.amount ?? 0,
        tier: row.tier,
        description: row.description,
        scope: '',
        createdAt: now,
        updatedAt: now,
      };
    });

    dispatch({ type: 'IMPORT_TRANSACTIONS', payload: transactions });
    navigate('/spend');
  };

  const validRowCount = previewRows.filter((r) => r._errors.length === 0).length;
  const errorRowCount = previewRows.filter((r) => r._errors.length > 0).length;

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderStepIndicator() {
    return (
      <div className="flex items-center gap-2 mb-6">
        {([1, 2, 3, 4] as const).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{
                  backgroundColor:
                    s === step
                      ? 'var(--color-primary)'
                      : s < step
                      ? 'var(--color-success)'
                      : 'var(--color-bg-tertiary)',
                  color:
                    s === step || s < step ? '#fff' : 'var(--color-text-muted)',
                }}
              >
                {s < step ? <CheckCircle2 size={14} /> : s}
              </div>
              <span
                className="text-xs font-medium hidden sm:block"
                style={{
                  color: s === step ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}
              >
                {stepLabel(s)}
              </span>
            </div>
            {idx < 3 && (
              <div
                className="w-8 h-px flex-shrink-0"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderStep1() {
    return (
      <div className="flex flex-col gap-6">
        {/* Source selector */}
        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium"
            style={{ color: 'var(--color-text)' }}
          >
            Data Source
          </label>
          <div className="flex flex-wrap gap-3">
            {(
              [
                { value: 'generic', label: 'Generic Excel / CSV' },
                { value: 'procore-budget', label: 'Procore — Budget Detail' },
                { value: 'procore-commitment', label: 'Procore — Commitments' },
                { value: 'procore-direct-cost', label: 'Procore — Direct Costs' },
              ] as { value: SourceType; label: string }[]
            ).map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-2 cursor-pointer text-sm px-4 py-2 rounded-lg border transition-colors"
                style={{
                  borderColor:
                    sourceType === value ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor:
                    sourceType === value
                      ? 'var(--color-primary)1a'
                      : 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                }}
              >
                <input
                  type="radio"
                  name="sourceType"
                  value={value}
                  checked={sourceType === value}
                  onChange={() => setSourceType(value)}
                  className="accent-[var(--color-primary)]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Procore mapping preview */}
        {sourceType !== 'generic' && (
          <div
            className="rounded-lg border p-4"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Pre-built Procore Mapping
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(
                PROCORE_MAPPINGS[sourceType as keyof typeof PROCORE_MAPPINGS]
              ).map(([appField, excelCol]) => (
                <div key={appField} className="flex items-center gap-1 text-xs">
                  <span
                    className="font-medium capitalize"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {appField}:
                  </span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {excelCol || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors"
          style={{
            borderColor: isDragOver ? 'var(--color-primary)' : 'var(--color-border)',
            backgroundColor: isDragOver
              ? 'var(--color-primary)0d'
              : 'var(--color-bg-secondary)',
          }}
        >
          <Upload
            size={36}
            style={{
              color: isDragOver ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
            aria-hidden="true"
          />
          {fileName ? (
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} style={{ color: 'var(--color-success)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {fileName}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                ({rawRows.length} rows)
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFileName('');
                  setRawRows([]);
                  setHeaders([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="ml-1 rounded-full p-0.5"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                Drop file here or click to browse
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Accepts .xlsx, .xls, .csv
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
          aria-label="File upload"
        />

        {fileError && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
            <AlertCircle size={16} />
            {fileError}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            rightIcon={<ChevronRight size={16} />}
            onClick={goToStep2}
            disabled={!fileName}
          >
            Next: Map Columns
          </Button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const requiredFields: (keyof AppFieldMapping)[] = ['date', 'supplier', 'amount'];

    return (
      <div className="flex flex-col gap-6">
        {/* Stored templates */}
        {state.columnMappings.length > 0 && (
          <div className="flex items-center gap-3">
            <label
              className="text-sm font-medium flex-shrink-0"
              style={{ color: 'var(--color-text)' }}
            >
              Apply Saved Template:
            </label>
            <select
              onChange={(e) => handleApplyStoredTemplate(e.target.value)}
              defaultValue=""
              className="px-3 py-1.5 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text)',
              }}
            >
              <option value="" disabled>
                — Select template —
              </option>
              {state.columnMappings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mapping table */}
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
                <th
                  className="px-4 py-3 text-left font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  App Field
                </th>
                <th
                  className="px-4 py-3 text-left font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Excel / CSV Column
                </th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { key: 'date', label: 'Date', required: true },
                  { key: 'supplier', label: 'Supplier', required: true },
                  { key: 'project', label: 'Project', required: false },
                  { key: 'amount', label: 'Amount', required: true },
                  { key: 'tier', label: 'Tier', required: false },
                  { key: 'description', label: 'Description', required: false },
                ] as { key: keyof AppFieldMapping; label: string; required: boolean }[]
              ).map(({ key, label, required }, idx) => (
                <tr
                  key={key}
                  style={{
                    backgroundColor:
                      idx % 2 === 0 ? 'var(--color-bg)' : 'var(--color-bg-secondary)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                    <span className="font-medium">{label}</span>
                    {required && (
                      <span className="ml-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                        *
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mapping[key]}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border text-sm"
                      style={{
                        borderColor:
                          required && !mapping[key]
                            ? 'var(--color-danger)'
                            : 'var(--color-border)',
                        backgroundColor: 'var(--color-bg-secondary)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <option value="">— Not mapped —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Validation warning */}
        {requiredFields.some((f) => !mapping[f]) && (
          <div
            className="flex items-center gap-2 text-sm rounded-lg px-4 py-3"
            style={{
              backgroundColor: '#fff3cd',
              color: '#856404',
              border: '1px solid #ffc107',
            }}
          >
            <AlertCircle size={16} />
            Map all required fields (Date, Supplier, Amount) before proceeding.
          </div>
        )}

        {/* Save as template */}
        <div>
          {!showSaveTemplate ? (
            <button
              type="button"
              className="text-sm underline"
              style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setShowSaveTemplate(true)}
            >
              Save current mapping as template
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Template name..."
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                className="px-3 py-1.5 rounded-lg border text-sm"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text)',
                }}
              />
              <Button size="sm" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()}>
                Save
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setShowSaveTemplate(false);
                  setSaveTemplateName('');
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            leftIcon={<ChevronLeft size={16} />}
            onClick={() => setStep(1)}
          >
            Back
          </Button>
          <Button
            rightIcon={<ChevronRight size={16} />}
            onClick={goToStep3}
            disabled={requiredFields.some((f) => !mapping[f])}
          >
            Next: Preview
          </Button>
        </div>
      </div>
    );
  }

  function renderStep3() {
    const preview10 = previewRows.slice(0, 10);

    return (
      <div className="flex flex-col gap-6">
        {/* Summary */}
        <div className="flex flex-wrap gap-3">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text)',
            }}
          >
            <FileSpreadsheet size={16} />
            <span>
              <span className="font-semibold">{previewRows.length}</span> total rows
            </span>
          </div>
          {errorRowCount > 0 && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm"
              style={{
                borderColor: '#fca5a5',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
              }}
            >
              <AlertCircle size={16} />
              <span>
                <span className="font-semibold">{errorRowCount}</span> rows with errors (will be skipped)
              </span>
            </div>
          )}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm"
            style={{
              borderColor: '#86efac',
              backgroundColor: '#dcfce7',
              color: '#15803d',
            }}
          >
            <CheckCircle2 size={16} />
            <span>
              <span className="font-semibold">{validRowCount}</span> rows will be imported
            </span>
          </div>
        </div>

        {/* Preview table */}
        <div
          className="rounded-xl border overflow-x-auto"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <table className="w-full text-xs border-collapse" style={{ minWidth: '600px' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {['Date', 'Supplier', 'Project', 'Amount', 'Tier', 'Description', 'Status'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {preview10.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    backgroundColor:
                      row._errors.length > 0
                        ? '#fee2e2'
                        : idx % 2 === 0
                        ? 'var(--color-bg)'
                        : 'var(--color-bg-secondary)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>
                    {row.date || <span style={{ color: 'var(--color-danger)' }}>Missing</span>}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>
                    {row.supplier || <span style={{ color: 'var(--color-danger)' }}>Missing</span>}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>
                    {row.project || '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--color-text)' }}>
                    {row.amount !== null ? (
                      formatCurrency(row.amount)
                    ) : (
                      <span style={{ color: 'var(--color-danger)' }}>Invalid</span>
                    )}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>
                    T{row.tier}
                  </td>
                  <td
                    className="px-3 py-2 max-w-[160px] truncate"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {row.description || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {row._errors.length > 0 ? (
                      <Badge variant="red">{row._errors.join(', ')}</Badge>
                    ) : (
                      <Badge variant="green">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {previewRows.length > 10 && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Showing first 10 of {previewRows.length} rows.
          </p>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            leftIcon={<ChevronLeft size={16} />}
            onClick={() => setStep(2)}
          >
            Back
          </Button>
          <Button
            rightIcon={<ChevronRight size={16} />}
            onClick={goToStep4}
            disabled={validRowCount === 0}
          >
            Next: Confirm
          </Button>
        </div>
      </div>
    );
  }

  function renderStep4() {
    const totalAmount = previewRows
      .filter((r) => r._errors.length === 0)
      .reduce((sum, r) => sum + (r.amount ?? 0), 0);

    return (
      <div className="flex flex-col gap-6">
        <div
          className="rounded-xl border p-6 flex flex-col items-center gap-4 text-center"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <CheckCircle2 size={48} style={{ color: 'var(--color-success)' }} />
          <div>
            <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Ready to Import
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {validRowCount} transaction{validRowCount !== 1 ? 's' : ''} totaling{' '}
              <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </p>
            {errorRowCount > 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-warning)' }}>
                {errorRowCount} row{errorRowCount !== 1 ? 's' : ''} with errors will be skipped.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            leftIcon={<ChevronLeft size={16} />}
            onClick={() => setStep(3)}
          >
            Back
          </Button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => navigate('/spend')}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={validRowCount === 0}>
              Import {validRowCount} Transaction{validRowCount !== 1 ? 's' : ''}
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
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
          Import Spend Data
        </h1>
        <Button variant="secondary" onClick={() => navigate('/spend')}>
          Cancel
        </Button>
      </div>

      {/* Card */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
        {renderStepIndicator()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
}

export default SpendImport;
