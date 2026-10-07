import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sidebar-collapsed', isSidebarCollapsed ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }, [isSidebarCollapsed]);

  const sidebarMarginClass = isRTL
    ? isSidebarCollapsed
      ? 'mr-20'
      : 'mr-64'
    : isSidebarCollapsed
      ? 'ml-20'
      : 'ml-64';

  return (
    <div
      className={`min-h-screen bg-[#070B16] text-slate-100 dark relative overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Subtle Ambient Glows */}
      <div className="pointer-events-none fixed top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/[0.04] rounded-full blur-[140px] z-0" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 w-[700px] h-[700px] bg-purple-600/[0.04] rounded-full blur-[160px] z-0" />

      <Sidebar
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />
      <div className={`${sidebarMarginClass} min-h-screen flex flex-col transition-[margin] duration-300 relative z-10`}>
        <Topbar />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
