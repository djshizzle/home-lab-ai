import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  FolderKanban,
  BarChart3,
  Settings,
  Menu,
  X,
  Building2,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Suppliers', to: '/suppliers', icon: Users },
  { label: 'Spend Tracking', to: '/spend', icon: DollarSign },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-4 py-5 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <Building2
          size={24}
          style={{ color: 'var(--color-primary)' }}
          aria-hidden="true"
        />
        <span
          className="text-lg font-semibold tracking-tight"
          style={{ color: 'var(--color-text)' }}
        >
          SupplyDiversity
        </span>
      </div>

      {/* Nav links */}
      <ul className="flex flex-col gap-1 px-3 py-4 flex-1 list-none m-0 p-0 pt-4 px-3">
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'text-white'
                    : 'hover:bg-opacity-10',
                ].join(' ')
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
              })}
              onMouseEnter={(e) => {
                const target = e.currentTarget;
                if (!target.getAttribute('aria-current')) {
                  target.style.backgroundColor = 'var(--color-bg-tertiary)';
                  target.style.color = 'var(--color-text)';
                }
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget;
                if (!target.getAttribute('aria-current')) {
                  target.style.backgroundColor = 'transparent';
                  target.style.color = 'var(--color-text-secondary)';
                }
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger toggle */}
      <button
        className="fixed top-4 left-4 z-50 p-2 rounded-lg lg:hidden"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
        }}
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={[
          'fixed top-0 left-0 z-40 h-full w-64 transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border)',
        }}
        aria-label="Mobile navigation"
      >
        {navContent}
      </aside>

      {/* Desktop fixed sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed top-0 left-0 h-full w-64"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border)',
        }}
        aria-label="Main navigation"
      >
        {navContent}
      </aside>
    </>
  );
}

export default Sidebar;
