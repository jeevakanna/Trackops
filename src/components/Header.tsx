import React, { useState, useRef } from 'react';
import { PageId } from '../types';
import { storage } from '../services/storage';

interface HeaderProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const Header: React.FC<HeaderProps> = ({ activePage, onNavigate, onShowToast }) => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadBackup = async () => {
    try {
      const backupJson = await storage.createBackup();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `TrackOps_Backup_${dateStr}.json`;
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onShowToast('Backup Downloaded', `Saved offline archive as ${filename}`, 'success');
    } catch (err) {
      onShowToast('Backup Failed', err instanceof Error ? err.message : 'Could not create backup', 'error');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Restoring will replace all current stall data with the backup file. Are you sure you want to proceed?')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsRestoring(true);
      const text = await file.text();
      await storage.restoreBackup(text);
      onShowToast('Restore Complete', 'All records have been successfully restored from backup', 'success');
      setShowSettingsModal(false);
    } catch (err) {
      onShowToast('Restore Failed', err instanceof Error ? err.message : 'Failed to restore data', 'error');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to completely erase all products, sales, purchases, and finance records? This cannot be undone.')) {
      try {
        await storage.clearAllData();
        onShowToast('Database Cleared', 'All local records have been erased', 'info');
        setShowSettingsModal(false);
      } catch (err) {
        onShowToast('Clear Failed', err instanceof Error ? err.message : 'Could not clear data', 'error');
      }
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 md:left-60 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-md z-40 shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-low">
        <div className="h-16 max-w-7xl mx-auto px-space-md flex items-center justify-between">
          {/* Left Side: Brand on mobile, or context on desktop */}
          <div className="flex items-center gap-space-sm">
            <div className="md:hidden flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-[22px]">storefront</span>
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">TrackOps</span>
            </div>
            <div className="hidden md:flex items-center gap-space-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Currency:</span>
              <span className="px-space-xs py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface font-semibold tracking-wide">
                INR (₹)
              </span>
              <span className="text-on-surface-variant text-xs ml-2">Single-user stall ledger</span>
            </div>
          </div>

          {/* Right Side: Quick Action + Settings + Status */}
          <div className="flex items-center gap-space-sm md:gap-space-md">
            {/* Quick Sale button */}
            {activePage !== 'sales' && (
              <button
                onClick={() => onNavigate('sales')}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                <span>New Sale</span>
              </button>
            )}

            {/* Settings (Backup & Restore) */}
            <button
              onClick={() => setShowSettingsModal(true)}
              title="Data Backup & Settings"
              className="flex items-center gap-1 text-xs font-medium text-on-surface-variant hover:text-on-surface px-2.5 py-1.5 rounded-lg hover:bg-surface-container transition-colors border border-surface-container-low"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
              <span className="hidden sm:inline">Settings</span>
            </button>

            {/* Offline-Ready Badge */}
            <div className="flex items-center gap-space-xs bg-surface-container-low px-space-sm py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant hidden sm:inline">Offline Ready</span>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Modal (Data Safety, Backup & Restore) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowSettingsModal(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-low overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-space-md border-b border-surface-container-low flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-space-xs">
                <div className="w-9 h-9 rounded-lg bg-surface-container text-on-surface flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                </div>
                <div>
                  <h2 className="font-headline-lg text-lg font-bold text-on-surface">Settings & Data Safety</h2>
                  <p className="font-label-sm text-xs text-on-surface-variant">Manage stall data and settings</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-space-md space-y-5">
              {/* Backup Card */}
              <div className="p-4 rounded-xl bg-surface-container-low/50 border border-surface-container-low space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-primary">download</span>
                      Download Data Backup
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Export your entire stall database (inventory, sales, purchases, and finances) into a portable JSON file.
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleDownloadBackup}
                    className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 flex items-center gap-1.5 shadow-xs transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">file_download</span>
                    <span>Download Backup (.json)</span>
                  </button>
                </div>
              </div>

              {/* Restore Card */}
              <div className="p-4 rounded-xl bg-surface-container-low/50 border border-surface-container-low space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-secondary">upload</span>
                      Restore from Backup
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Restore data from a previously exported TrackOps JSON backup. Existing records will be replaced.
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="restoreFileInput"
                  />
                  <label
                    htmlFor="restoreFileInput"
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer border border-surface-container shadow-xs transition-all ${
                      isRestoring
                        ? 'bg-surface-container text-on-surface-variant opacity-60 pointer-events-none'
                        : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">file_upload</span>
                    <span>{isRestoring ? 'Restoring...' : 'Select Backup File (.json)'}</span>
                  </label>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-4 rounded-xl bg-error-container/20 border border-error-container/40 space-y-2">
                <h3 className="font-semibold text-xs text-on-error-container uppercase tracking-wider">
                  Reset Data
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Erase all stored data and start fresh with an empty ledger.
                </p>
                <button
                  onClick={handleClearData}
                  className="px-3 py-1.5 bg-error text-on-error rounded-lg text-xs font-semibold hover:bg-error/90 flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">delete_forever</span>
                  <span>Erase All Stall Data</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-space-md border-t border-surface-container-low bg-surface-container-low/30 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
