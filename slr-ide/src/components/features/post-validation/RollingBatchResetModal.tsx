import React, { useState } from 'react';
import { X, RotateCcw, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';

interface RollingBatchResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetActive: () => Promise<void>;
  onResetAll: () => Promise<void>;
  currentBatchNumber: number | null;
  completedBatchesCount: number;
}

export default function RollingBatchResetModal({
  isOpen,
  onClose,
  onResetActive,
  onResetAll,
  currentBatchNumber,
  completedBatchesCount
}: RollingBatchResetModalProps) {
  const [loadingMode, setLoadingMode] = useState<'active' | 'all' | null>(null);

  if (!isOpen) return null;

  const handleActiveReset = async () => {
    setLoadingMode('active');
    try {
      await onResetActive();
      onClose();
    } finally {
      setLoadingMode(null);
    }
  };

  const handleAllReset = async () => {
    setLoadingMode('all');
    try {
      await onResetAll();
      onClose();
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground">Reset Rolling Batch Engine</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select reset scope for current project rolling audit pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={!!loadingMode}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Reset operations delete stored reviewer decisions and audit ledger entries. This action cannot be undone.
          </p>
        </div>

        {/* Reset Options Cards */}
        <div className="space-y-3">
          
          {/* Option 1: Reset Active Batch */}
          <div className={`p-4 border rounded-xl transition-all ${
            currentBatchNumber 
              ? 'border-border hover:border-amber-500/50 bg-muted/20 hover:bg-amber-500/5' 
              : 'border-border/40 opacity-50 bg-muted/10 cursor-not-allowed'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  <h4 className="font-bold text-xs text-foreground">Option 1: Reset Active Batch Only</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Cancels current {currentBatchNumber ? `Batch #${currentBatchNumber}` : 'in-progress batch'}, discarding reviewer uploads so a fresh batch of papers can be initialized. Historical completed batches remain intact.
                </p>
              </div>

              <button
                onClick={handleActiveReset}
                disabled={!currentBatchNumber || !!loadingMode}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-bold rounded-lg shadow transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingMode === 'active' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Reset Active
              </button>
            </div>
          </div>

          {/* Option 2: Reset All Batches */}
          <div className="p-4 border border-destructive/30 hover:border-destructive/60 bg-destructive/5 rounded-xl transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <h4 className="font-bold text-xs text-destructive">Option 2: Reset Entire Audit Pipeline</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Purges all {completedBatchesCount} completed & active rolling batches for this project, resetting the sequential validation engine back to 0 batches.
                </p>
              </div>

              <button
                onClick={handleAllReset}
                disabled={!!loadingMode}
                className="px-3.5 py-2 bg-destructive hover:bg-destructive/90 active:bg-destructive/80 text-destructive-foreground text-xs font-bold rounded-lg shadow transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingMode === 'all' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Purge All
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border/50">
          <button
            onClick={onClose}
            disabled={!!loadingMode}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
