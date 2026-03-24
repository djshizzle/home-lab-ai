# Supplier Diversity Management App — Requirements Document

**Status:** DRAFT — Pending Review
**Date:** 2026-03-24
**Version:** 0.1

---

## 1. Overview

A web application for managing supplier diversity programs, tracking certified
supplier spend across contract tiers, and generating compliance reports. The app
replaces manual Excel-based tracking with a structured system while maintaining
full Excel import/export compatibility.

**Target user:** Program administrator managing supplier diversity compliance
for contracts that require MBE/WBE/DBE (and other) participation goals.

---

## 2. Core Modules

### 2.1 Supplier Directory

| Feature | Description |
|---------|-------------|
| Supplier profiles | Company name, contact info, address, NAICS codes, capabilities summary |
| Certification tracking | Assign one or more certifications per supplier (MBE, WBE, SBE, etc.) |
| Certification expiration | Expiration date per cert with renewal alerts (30/60/90 day warnings) |
| Supplier status | Active, Pending Review, Inactive, Suspended |
| Document storage | Upload/attach cert copies, W-9s, insurance docs (stored locally or cloud) |
| Notes & history | Timestamped notes log per supplier |
| Search & filter | Filter by cert type, status, NAICS code, keyword |

### 2.2 Spend Tracking

| Feature | Description |
|---------|-------------|
| Transaction logging | Date, supplier, project, amount, scope/description |
| 3-Tier classification | **Tier 1** (direct/prime), **Tier 2** (sub to prime), **Tier 3** (sub to sub) |
| Tier summary per supplier | Total spend broken down by tier on each supplier profile |
| Bulk import | Import transactions from Excel/CSV |
| Edit & delete | Correct or remove logged transactions with audit trail |
| Recurring spend | Optional: flag recurring/scheduled payments |

### 2.3 Project Management

| Feature | Description |
|---------|-------------|
| Project setup | Name, contract value, start/end dates, description |
| Per-project goals | Set target % for each certification type (e.g., 15% MBE, 5% WBE) |
| Goal vs. actual tracking | Live progress bars showing spend-to-date vs. target per cert |
| Multi-project roll-up | Company-wide aggregate view across all active projects |
| Project status | Active, Completed, Archived |

### 2.4 Compliance & Reporting

| Feature | Description |
|---------|-------------|
| Goal tracking dashboard | Target % vs. actual % per cert type, per project and overall |
| Period-based reports | Filter by quarter, year, or custom date range |
| Exportable reports | Generate PDF and Excel reports formatted for agency submission |
| Spend by cert type | Breakdown of dollars and % to each certification category |
| Spend by tier | Tier 1/2/3 distribution charts and tables |
| Spend by project | Per-project spend summaries with goal attainment |
| Top suppliers report | Ranked list by spend volume, filterable by cert and tier |
| Trend analysis | Month-over-month and quarter-over-quarter spend trends |
| Audit trail | Log of all data changes (who, what, when) for compliance |

### 2.5 Custom Certifications (Settings)

| Feature | Description |
|---------|-------------|
| Add certification types | Short code, full label, badge color |
| Edit/remove cert types | Removing a cert type unassigns it from all suppliers (with confirmation) |
| Pre-loaded defaults | MBE, WBE, SBE, VBE, DBE, AABE included out of the box |
| Unlimited custom types | Add LGBTBE, HUBZone, 8(a), SDVOSB, or any custom type needed |

### 2.6 Dashboard

| Widget | Description |
|--------|-------------|
| Spend overview | Total spend, certified spend, and % of total — current period |
| Goal progress | Progress bars per cert type (target vs. actual) |
| Tier breakdown | Pie/donut chart showing Tier 1/2/3 distribution |
| Spend by cert type | Bar chart of dollars per certification category |
| Spend trend | Line chart showing monthly spend over time |
| Top suppliers | Top 5-10 suppliers by spend with cert badges |
| Expiring certifications | Alert list of certs expiring in next 90 days |
| Recent activity | Latest transactions and supplier updates |

---

## 3. Excel Integration

This is a **critical** requirement — the user has an existing Excel database.

| Feature | Description |
|---------|-------------|
| Excel import (suppliers) | Upload `.xlsx`/`.csv` → column mapping wizard → import into supplier directory |
| Excel import (transactions) | Upload spend data from Excel with column mapping |
| Column mapping | User selects which Excel column maps to which app field (saved as template for reuse) |
| Validation on import | Flag missing/invalid data, show preview before committing import |
| Excel export | Export any report, supplier list, or transaction log to `.xlsx` |
| Template download | Provide blank Excel templates matching expected import format |
| Sync workflow | Re-import updated Excel files; match on supplier name or ID to update existing records |

---

## 4. Data Storage

### Option A: Supabase (Recommended)

- PostgreSQL backend with built-in auth, real-time, and file storage
- Free tier sufficient for single-user / small team
- Access from any device, automatic backups
- Row-level security for future multi-user support

### Option B: Local-First with Sync

- IndexedDB for local storage (no 5MB limit like localStorage)
- Optional cloud sync to Supabase or Firebase
- Works offline, syncs when connected

### Option C: localStorage (NOT Recommended)

- 5-10MB limit — will break with real transaction volume
- Browser-specific, no cross-device access
- Cleared by browser cache wipe
- **Only acceptable as a demo/prototype approach**

### Data Management (all options)

| Feature | Description |
|---------|-------------|
| JSON backup/restore | Export full database as JSON; restore from backup file |
| Excel backup | Export all data as a multi-sheet Excel workbook |
| Reset option | "Reset all data" with double-confirmation |

---

## 5. Tech Stack Recommendation

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React + Vite | Fast, component-based, large ecosystem |
| UI framework | Tailwind CSS + shadcn/ui | Clean, professional look with minimal custom CSS |
| Charts | Recharts or Chart.js | Solid charting for dashboards and reports |
| Excel parsing | SheetJS (xlsx) | Industry-standard `.xlsx` read/write in the browser |
| PDF export | jsPDF + jspdf-autotable | Client-side PDF generation for reports |
| Backend/DB | Supabase | Auth, PostgreSQL, file storage, free tier |
| Alternative DB | IndexedDB (Dexie.js) | If fully offline/local-first is preferred |
| Hosting | Vercel or Netlify | Free tier, easy deploy from Git |

---

## 6. Pages / Navigation

```
├── Dashboard          (home — widgets overview)
├── Suppliers
│   ├── Directory      (searchable list, filters)
│   ├── Add/Edit       (supplier form with cert assignment)
│   └── Profile        (detail view with spend summary, docs, notes)
├── Spend Tracking
│   ├── Log Entry      (add transaction form)
│   ├── Transaction List (searchable, filterable table)
│   └── Import         (Excel upload + column mapping)
├── Projects
│   ├── List           (all projects with goal status)
│   └── Detail         (project goals, spend breakdown, progress)
├── Reports
│   ├── Compliance     (goal vs. actual, exportable)
│   ├── Spend Analysis (by tier, cert, project, period)
│   └── Supplier       (top suppliers, cert distribution)
├── Settings
│   ├── Certifications (add/edit/remove cert types)
│   ├── Import Templates (manage saved column mappings)
│   └── Data Management (backup, restore, reset, export)
```

---

## 7. What the Original Build Got Right

- 3-tier spend structure (Tier 1/2/3) — correct model
- Custom certifications with code + label + color — good flexibility
- JSON backup/restore — useful safety net
- Per-supplier spend summary — needed for quick lookups

## 8. What the Original Build is Missing

| Gap | Impact |
|-----|--------|
| No Excel import/export | Can't use existing database — this was a stated requirement |
| localStorage as "permanent" storage | Will lose data; 5MB limit; single browser only |
| No compliance goal tracking | Can't show target vs. actual — the whole point of the tool |
| No cert expiration dates | No renewal warnings; compliance risk |
| No period-based reporting | Can't generate quarterly/annual submissions |
| No project-level goal setup | Can't track per-contract diversity requirements |
| No exportable reports (PDF/Excel) | Reports stay trapped in the browser |
| No supplier status/lifecycle | No way to track pending vs. active vs. inactive |
| No document storage | Cert copies, W-9s have nowhere to go |
| No audit trail | No change history for compliance reviews |

---

## 9. Suggested Build Phases

### Phase 1 — Foundation (MVP)
- Supplier directory with cert tracking and expiration dates
- Excel import with column mapping (suppliers + transactions)
- Spend logging with 3-tier classification
- Basic dashboard (spend overview, tier breakdown, cert distribution)
- Supabase backend or IndexedDB + JSON backup
- Excel + JSON export

### Phase 2 — Compliance & Reporting
- Project setup with per-cert goals
- Goal vs. actual tracking with progress bars
- Period-based reporting (quarterly, annual, custom range)
- PDF + Excel report export
- Cert expiration alerts

### Phase 3 — Polish & Advanced
- Audit trail / change history
- Document storage (cert copies, W-9s)
- Trend charts (month-over-month)
- Multi-project roll-up dashboard
- Saved report templates
- Print-friendly report layouts

---

## 10. Open Questions

1. **Storage preference** — Cloud (Supabase) or local-first (IndexedDB)? Cloud is recommended.
2. **Multi-user** — Is this single-user or will multiple people need access?
3. **Existing Excel structure** — What columns/sheets does the current Excel database have? (Needed for import mapping.)
4. **Agency report formats** — Are there specific report templates required for compliance submissions?
5. **Budget for hosting** — Free tier (Supabase + Vercel) works for small scale. Is that acceptable?
6. **Mobile access** — Does it need to work well on phones/tablets, or desktop only?
7. **Branding** — Any logo, colors, or naming preferences for the app?

---

*This document is a starting point. Review, mark up, and we'll refine before building.*
