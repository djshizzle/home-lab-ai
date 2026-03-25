import { v4 as uuidv4 } from 'uuid';
import type { CertificationType, Project, Supplier, Transaction } from '../types/index.js';

// ---------------------------------------------------------------------------
// Class name helper
// ---------------------------------------------------------------------------

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string): string {
  const parsed = new Date(date);
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateId(): string {
  return uuidv4();
}

// ---------------------------------------------------------------------------
// Goal progress
// ---------------------------------------------------------------------------

export interface GoalProgress {
  actual: number;
  targetPercent: number | null;
  targetDollar: number | null;
  actualPercent: number;
  actualDollar: number;
  status: 'on-track' | 'at-risk' | 'met' | 'no-goal';
}

export function getGoalProgress(
  project: Project,
  certTypeId: string,
  transactions: Transaction[]
): GoalProgress {
  const goal = project.goals.find((g) => g.certTypeId === certTypeId) ?? null;

  // Sum all transaction amounts for this project and cert type
  const actualDollar = transactions
    .filter((t) => t.projectId === project.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const contractValue = project.contractValue > 0 ? project.contractValue : 1;
  const actualPercent = (actualDollar / contractValue) * 100;

  if (!goal) {
    return {
      actual: actualDollar,
      targetPercent: null,
      targetDollar: null,
      actualPercent,
      actualDollar,
      status: 'no-goal',
    };
  }

  let status: GoalProgress['status'] = 'no-goal';

  if (goal.goalType === 'percentage' && goal.targetPercentage !== null) {
    const target = goal.targetPercentage;
    if (actualPercent >= target) {
      status = 'met';
    } else if (actualPercent >= target * 0.75) {
      status = 'at-risk';
    } else {
      status = 'on-track';
    }
  } else if (goal.goalType === 'dollar' && goal.targetDollarAmount !== null) {
    const target = goal.targetDollarAmount;
    if (actualDollar >= target) {
      status = 'met';
    } else if (actualDollar >= target * 0.75) {
      status = 'at-risk';
    } else {
      status = 'on-track';
    }
  } else if (goal.goalType === 'both') {
    const percentMet =
      goal.targetPercentage !== null ? actualPercent >= goal.targetPercentage : true;
    const dollarMet =
      goal.targetDollarAmount !== null ? actualDollar >= goal.targetDollarAmount : true;

    if (percentMet && dollarMet) {
      status = 'met';
    } else {
      const percentThreshold =
        goal.targetPercentage !== null ? actualPercent >= goal.targetPercentage * 0.75 : true;
      const dollarThreshold =
        goal.targetDollarAmount !== null
          ? actualDollar >= goal.targetDollarAmount * 0.75
          : true;
      status = percentThreshold && dollarThreshold ? 'at-risk' : 'on-track';
    }
  }

  return {
    actual: actualDollar,
    targetPercent: goal.targetPercentage,
    targetDollar: goal.targetDollarAmount,
    actualPercent,
    actualDollar,
    status,
  };
}

// ---------------------------------------------------------------------------
// Expiring certifications
// ---------------------------------------------------------------------------

export interface ExpiringCert {
  supplier: Supplier;
  certTypeId: string;
  certNumber: string;
  expirationDate: string;
  daysUntilExpiry: number;
}

export function getExpiringCerts(suppliers: Supplier[], daysAhead: number): ExpiringCert[] {
  const now = Date.now();
  const cutoff = now + daysAhead * 24 * 60 * 60 * 1000;
  const results: ExpiringCert[] = [];

  for (const supplier of suppliers) {
    for (const cert of supplier.certifications) {
      const expiry = new Date(cert.expirationDate).getTime();
      if (expiry >= now && expiry <= cutoff) {
        const daysUntilExpiry = Math.ceil((expiry - now) / (24 * 60 * 60 * 1000));
        results.push({
          supplier,
          certTypeId: cert.certTypeId,
          certNumber: cert.certNumber,
          expirationDate: cert.expirationDate,
          daysUntilExpiry,
        });
      }
    }
  }

  return results.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

// ---------------------------------------------------------------------------
// Cert color lookup
// ---------------------------------------------------------------------------

export function getCertColor(certTypes: CertificationType[], certTypeId: string): string {
  return certTypes.find((c) => c.id === certTypeId)?.color ?? 'gray-400';
}
