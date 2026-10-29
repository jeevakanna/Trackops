import React, { useState, useEffect } from 'react';
import { PageId, ToastMessage } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { InventoryPage } from './pages/InventoryPage';
import { SalesPage } from './pages/SalesPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { FinancesPage } from './pages/FinancesPage';

const VALID_PAGES: PageId[] = ['inventory', 'sales', 'purchases', 'finances'];

function getPageFromHash(): PageId {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  return VALID_PAGES.includes(hash as PageId) ? (hash as PageId) : 'inventory';
}

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageId>(getPageFromHash);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Sync with browser URL hash
  useEffect(() => {
    // Redirect direct path or hash /reports or invalid to #inventory
    if (window.location.pathname.includes('/reports')) {
      window.history.replaceState(null, '', '/#inventory');
    }

    const rawHash = window.location.hash.replace('#', '').toLowerCase();
    if (!VALID_PAGES.includes(rawHash as PageId)) {
      window.location.replace('#inventory');
    }

    const handleHashChange = () => {
      const page = getPageFromHash();
      setActivePage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const showToast = (
    title: string,
    description?: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'success'
  ) => {
    setToast({
      id: `${Date.now()}`,
      title,
      description,
      type
    });

    setTimeout(() => {
      setToast((prev) => (prev?.title === title ? null : prev));
    }, 4000);
  };

  const handleNavigate = (page: PageId) => {
    window.location.hash = page;
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen">
      {/* Navigation Sidebar (Desktop Sidebar + Mobile Bottom Navigation) */}
      <Sidebar activePage={activePage} onNavigate={handleNavigate} />

      {/* Main Layout Area */}
      <div className="md:pl-60">
        {/* Top Header */}
        <Header activePage={activePage} onNavigate={handleNavigate} onShowToast={showToast} />

        {/* Dynamic Viewport */}
        <main className="w-full pt-20 px-space-md max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
          {activePage === 'inventory' && (
            <InventoryPage onShowToast={showToast} />
          )}
          {activePage === 'sales' && (
            <SalesPage onShowToast={showToast} />
          )}
          {activePage === 'purchases' && (
            <PurchasesPage onShowToast={showToast} />
          )}
          {activePage === 'finances' && (
            <FinancesPage onShowToast={showToast} />
          )}
        </main>
      </div>

      {/* Global Toast Notification */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};

export default App;
