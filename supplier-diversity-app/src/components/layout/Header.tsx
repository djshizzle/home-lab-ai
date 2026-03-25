import { Sun, Moon, ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Header({ title, breadcrumbs, darkMode, onToggleDarkMode }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        minHeight: '64px',
      }}
    >
      {/* Left: title + breadcrumbs */}
      <div className="flex flex-col gap-0.5 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1 list-none m-0 p-0">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight
                      size={12}
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-hidden="true"
                    />
                  )}
                  {crumb.href ? (
                    <a
                      href={crumb.href}
                      className="text-xs font-medium hover:underline"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1
          className="text-xl font-semibold leading-tight truncate"
          style={{ color: 'var(--color-text)', margin: 0 }}
        >
          {title}
        </h1>
      </div>

      {/* Right: dark mode toggle */}
      <button
        onClick={onToggleDarkMode}
        className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150 flex-shrink-0"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {darkMode ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      </button>
    </header>
  );
}

export default Header;
