import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/suppliers': 'Suppliers',
  '/spend': 'Spend Tracking',
  '/projects': 'Projects',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  return ROUTE_TITLES[pathname] ?? 'SupplyDiversity';
}

export function AppLayout() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('sd-dark-mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('sd-dark-mode', String(darkMode));
  }, [darkMode]);

  const handleToggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Sidebar */}
      <Sidebar />

      {/* Main content — offset by sidebar width on desktop */}
      <div
        className="flex flex-col flex-1 min-w-0 lg:ml-64"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <Header
          title={pageTitle}
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />

        <main
          className="flex-1 overflow-auto p-6"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          id="main-content"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
