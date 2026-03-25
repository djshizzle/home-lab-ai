import { type ReactNode, type CSSProperties } from 'react';

type BadgeVariant = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'indigo' | 'orange';

const VARIANT_STYLES: Record<BadgeVariant, CSSProperties> = {
  blue: { backgroundColor: '#dbeafe', color: '#1d4ed8' },
  green: { backgroundColor: '#dcfce7', color: '#15803d' },
  yellow: { backgroundColor: '#fef9c3', color: '#a16207' },
  red: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  purple: { backgroundColor: '#f3e8ff', color: '#7e22ce' },
  gray: { backgroundColor: '#f1f5f9', color: '#475569' },
  indigo: { backgroundColor: '#e0e7ff', color: '#3730a3' },
  orange: { backgroundColor: '#ffedd5', color: '#c2410c' },
};

const DARK_VARIANT_STYLES: Record<BadgeVariant, CSSProperties> = {
  blue: { backgroundColor: '#1e3a5f', color: '#93c5fd' },
  green: { backgroundColor: '#14532d', color: '#86efac' },
  yellow: { backgroundColor: '#422006', color: '#fde68a' },
  red: { backgroundColor: '#450a0a', color: '#fca5a5' },
  purple: { backgroundColor: '#3b0764', color: '#d8b4fe' },
  gray: { backgroundColor: '#334155', color: '#94a3b8' },
  indigo: { backgroundColor: '#1e1b4b', color: '#a5b4fc' },
  orange: { backgroundColor: '#431407', color: '#fdba74' },
};

interface BadgeProps {
  /** Semantic color variant */
  variant?: BadgeVariant;
  /**
   * Legacy prop: accepts a tailwind-style color string like "blue-600".
   * The hue portion is extracted and mapped to a variant.
   */
  color?: string;
  children: ReactNode;
  className?: string;
}

function parseColorToVariant(color: string): BadgeVariant {
  const hue = color.split('-')[0].toLowerCase() as BadgeVariant;
  if (hue in VARIANT_STYLES) return hue;
  return 'gray';
}

export function Badge({ variant, color, children, className = '' }: BadgeProps) {
  const resolvedVariant: BadgeVariant = variant ?? (color ? parseColorToVariant(color) : 'gray');

  // Detect dark mode via class on documentElement
  const isDark = typeof document !== 'undefined'
    && document.documentElement.classList.contains('dark');

  const style = isDark
    ? DARK_VARIANT_STYLES[resolvedVariant]
    : VARIANT_STYLES[resolvedVariant];

  return (
    <span
      className={['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {children}
    </span>
  );
}

export default Badge;
