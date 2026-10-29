import React from 'react';
import { PageId } from '../types';

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

interface NavItem {
  id: PageId;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inventory', label: 'Inventory', icon: 'inventory_2' },
  { id: 'sales', label: 'Sales', icon: 'point_of_sale' },
  { id: 'purchases', label: 'Purchases', icon: 'shopping_bag' },
  { id: 'finances', label: 'Finances', icon: 'account_balance_wallet' }
];

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  return (
    <>
      {/* Desktop Sidebar (fixed left-0 top-0 h-full w-60) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-surface-container-lowest z-50 flex-col py-space-lg px-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-surface-container-low">
        {/* Brand */}
        <a
          href="#inventory"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('inventory');
          }}
          className="flex items-center gap-space-xs px-space-sm mb-space-xl cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[22px]">storefront</span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline-lg text-[20px] font-bold text-on-surface tracking-tight">TrackOps</span>
            <span className="text-[11px] text-on-surface-variant font-medium -mt-1">Stall Management</span>
          </div>
        </a>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.id);
                }}
                className={`flex items-center gap-space-sm px-space-sm py-2.5 rounded-lg transition-all min-h-[44px] text-left w-full group cursor-pointer ${
                  isActive
                    ? 'bg-surface-container text-on-surface font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] transition-transform group-hover:scale-105 ${
                    isActive ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="font-body-md text-body-md flex-1">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Stall Status Card */}
        <div className="px-space-sm pt-space-md border-t border-surface-container-low">
          <div className="flex items-center gap-space-xs px-space-sm py-2 bg-surface-container-low rounded-lg">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <div className="flex flex-col">
              <span className="font-label-sm text-[11px] text-on-surface font-semibold">Local Stall PC</span>
              <span className="text-[10px] text-on-surface-variant">Database connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (fixed bottom-0) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_-1px_8px_rgba(0,0,0,0.06)] border-t border-surface-container-low z-50 flex items-center justify-around px-space-xs">
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.id);
              }}
              className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-1 py-1 transition-colors cursor-pointer ${
                isActive ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive ? 'font-bold' : ''}`}>
                {item.icon}
              </span>
              <span className="font-label-sm text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {isActive && <span className="w-1 h-1 rounded-full bg-primary mt-0.5"></span>}
            </a>
          );
        })}
      </nav>
    </>
  );
};
