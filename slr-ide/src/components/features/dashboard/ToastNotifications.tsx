'use client';

import React from 'react';
import { Check, AlertCircle, AlertTriangle, X } from 'lucide-react';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastNotificationsProps {
  toasts: Toast[];
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
}

export default function ToastNotifications({ toasts, setToasts }: ToastNotificationsProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full select-none pointer-events-none">
      {toasts.map((toast: Toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.4)] border border-border border-l-4 flex gap-3 items-start animate-in slide-in-from-top-5 fade-in duration-300 pointer-events-auto bg-card/95 backdrop-blur-lg text-foreground transition-all duration-300 ${
            toast.type === 'success' ? 'border-l-emerald-500 shadow-emerald-500/5' :
            toast.type === 'error' ? 'border-l-destructive shadow-destructive/5' :
            toast.type === 'warning' ? 'border-l-amber-500 shadow-amber-500/5' :
            'border-l-primary shadow-primary/5'
          }`}
        >
          {toast.type === 'success' && <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-destructive mt-0.5" />}
          {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />}
          {toast.type === 'info' && <AlertCircle className="w-4 h-4 shrink-0 text-primary mt-0.5" />}
          <div className="flex-1 text-xs font-semibold leading-relaxed pr-2 select-text">
            {toast.message}
          </div>
          <button
            onClick={() => setToasts((prev: Toast[]) => prev.filter(t => t.id !== toast.id))}
            className="p-1 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
