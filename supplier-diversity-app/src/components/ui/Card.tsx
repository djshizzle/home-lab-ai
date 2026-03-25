import { type ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ title, subtitle, action, children, className = '', noPadding = false }: CardProps) {
  const hasHeader = title || subtitle || action;

  return (
    <div
      className={['rounded-xl shadow-sm border', className].filter(Boolean).join(' ')}
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
      }}
    >
      {hasHeader && (
        <div
          className="flex items-start justify-between gap-4 px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="min-w-0">
            {title && (
              <h2
                className="text-base font-semibold leading-tight"
                style={{ color: 'var(--color-text)', margin: 0 }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className="text-xs mt-0.5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  );
}

export default Card;
