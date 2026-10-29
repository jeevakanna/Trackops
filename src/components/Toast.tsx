import React from 'react';
import { ToastMessage } from '../types';

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';
  const isInfo = toast.type === 'info';

  const iconName = isError
    ? 'error'
    : isWarning
    ? 'warning'
    : isInfo
    ? 'info'
    : 'check_circle';

  const borderColor = isError
    ? 'border-error'
    : isWarning
    ? 'border-amber-500'
    : isInfo
    ? 'border-blue-600'
    : 'border-secondary';

  const iconColor = isError
    ? 'text-error'
    : isWarning
    ? 'text-amber-500'
    : isInfo
    ? 'text-blue-600'
    : 'text-secondary';

  return (
    <div
      className={`fixed top-20 right-4 sm:right-6 z-50 flex items-center gap-space-sm bg-surface-container-lowest text-on-surface px-space-md py-space-sm rounded-lg shadow-xl border-l-4 ${borderColor} transition-all duration-300 max-w-sm sm:max-w-md animate-in slide-in-from-top-2`}
    >
      <span className={`material-symbols-outlined ${iconColor} text-[22px] shrink-0`}>
        {iconName}
      </span>
      <div className="flex flex-col flex-1">
        <span className="font-body-md text-sm font-semibold text-on-surface leading-tight">
          {toast.title}
        </span>
        {toast.description && (
          <span className="font-label-sm text-[12px] text-on-surface-variant mt-0.5">
            {toast.description}
          </span>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container transition-colors ml-2"
        aria-label="Close notification"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
};
