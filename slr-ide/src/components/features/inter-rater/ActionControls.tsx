import React from 'react';
import { Upload, Download, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';

interface ActionControlsProps {
  isImporting: boolean;
  isResetting: boolean;
  stats: any;
  importError: string | null;
  activePoolTab: 'pool_a' | 'pool_b' | 'pool_c';
  handleExportBlinded: () => void;
  handleImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleResetCalibration: () => void;
  maskReviewerName: (name: string) => string;
  setImportError: (err: string | null) => void;
}

export default function ActionControls({
  isImporting,
  isResetting,
  stats,
  importError,
  activePoolTab,
  handleExportBlinded,
  handleImportFileChange,
  handleResetCalibration,
  maskReviewerName,
  setImportError
}: ActionControlsProps) {
  return (
    <div className="space-y-6">
      {/* Action Controls Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm select-none">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportBlinded}
            className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            disabled={isImporting}
          >
            <Download className="w-4 h-4" />
            Export Blinded Template (.slr)
          </button>

          <label className={`px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
            {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import Reviewer (.slr)
            <input
              type="file"
              accept=".slr,application/json"
              className="hidden"
              onChange={handleImportFileChange}
              disabled={isImporting}
            />
          </label>

          <button
            onClick={handleResetCalibration}
            className="px-4 py-2 bg-destructive/15 text-destructive hover:bg-destructive/20 border border-destructive/25 text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            disabled={isImporting || isResetting || !stats || !stats.reviewers || stats.reviewers.length === 0}
          >
            {isResetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Reset Calibration
          </button>
        </div>

        {/* Roster list */}
        {stats && stats.reviewers && stats.reviewers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Raters Ingested:</span>
            <div className="flex gap-1.5">
              {stats.reviewers.map((reviewer: string, idx: number) => (
                <span
                  key={reviewer}
                  className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border ${
                    idx === 0
                      ? 'bg-blue-50/50 dark:bg-blue-950/35 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-emerald-50/50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-900 text-emerald-750 dark:text-emerald-300'
                  }`}
                  title={reviewer}
                >
                  {maskReviewerName(reviewer)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error alerting banner */}
      {importError && (
        <div className="bg-destructive/15 border border-destructive/30 rounded-xl p-4 flex gap-3 text-destructive text-sm font-semibold animate-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-destructive-foreground">Import Denied</p>
            <p className="text-xs text-destructive-foreground/80 mt-0.5">{importError}</p>
            <button
              className="mt-2 text-xs font-bold underline cursor-pointer text-destructive-foreground"
              onClick={() => setImportError(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
