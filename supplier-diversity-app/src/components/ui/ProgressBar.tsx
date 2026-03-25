interface ProgressBarProps {
  /** Current value */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /**
   * Bar color. Accepts:
   * - 'auto' (default): green ≥ 66 %, yellow ≥ 33 %, red otherwise
   * - 'green' | 'yellow' | 'red' for explicit semantic color
   * - any valid CSS color string (hex, rgb, var(…), etc.)
   */
  color?: 'auto' | 'green' | 'yellow' | 'red' | string;
  /** Optional label rendered above the bar */
  label?: string;
  /** Show percentage text alongside the bar */
  showPercent?: boolean;
  className?: string;
}

const SEMANTIC_COLORS: Record<'green' | 'yellow' | 'red', string> = {
  green: 'var(--color-success)',
  yellow: 'var(--color-warning)',
  red: 'var(--color-danger)',
};

function resolveColor(color: string, percent: number): string {
  if (color === 'auto') {
    if (percent >= 66) return SEMANTIC_COLORS.green;
    if (percent >= 33) return SEMANTIC_COLORS.yellow;
    return SEMANTIC_COLORS.red;
  }
  if (color in SEMANTIC_COLORS) {
    return SEMANTIC_COLORS[color as keyof typeof SEMANTIC_COLORS];
  }
  // Custom CSS color string passed directly
  return color;
}

export function ProgressBar({
  value,
  max = 100,
  color = 'auto',
  label,
  showPercent = false,
  className = '',
}: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? Math.round((clampedValue / max) * 100) : 0;
  const barColor = resolveColor(color, percent);

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      {/* Label row */}
      {(label || showPercent) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {label}
            </span>
          )}
          {showPercent && (
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--color-text)' }}>
              {percent}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{
          height: '8px',
          backgroundColor: 'var(--color-bg-tertiary)',
        }}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        {/* Fill */}
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${percent}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
