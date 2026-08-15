import React, { useState } from 'react';
import { 
  AlertOctagon, 
  ArrowRight, 
  Copy, 
  Check, 
  Upload, 
  FileCode, 
  ShieldAlert, 
  X 
} from 'lucide-react';

export interface FullscreenErrorModalProps {
  errorInfo?: any;
  onTryAnotherFile?: () => void;
  onClose?: () => void;
  filename?: string;
}

export default function FullscreenErrorModal({
  errorInfo,
  onTryAnotherFile,
  onClose,
  filename = 'dataset.slr-viewer'
}: FullscreenErrorModalProps) {
  const [copied, setCopied] = useState(false);

  const detectedVersion = errorInfo?.detectedVersion || 'Unknown / Legacy';
  const requiredVersion = errorInfo?.requiredVersion || '1.1.0';
  const errorMessage = errorInfo?.error || errorInfo?.message || 'Snapshot schema validation failed.';
  const missingKeys = errorInfo?.missingKeys || [];

  const handleCopyDiagnostics = () => {
    const diagnosticPayload = {
      filename,
      timestamp: new Date().toISOString(),
      detectedVersion,
      requiredVersion,
      errorMessage,
      missingKeys,
      details: errorInfo?.details || {}
    };
    navigator.clipboard.writeText(JSON.stringify(diagnosticPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden relative flex flex-col my-auto animate-in zoom-in-95 duration-200">
        {/* Top Gradient Warning Header */}
        <div className="bg-destructive/10 border-b border-destructive/20 p-6 flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-destructive/15 text-destructive border border-destructive/30 shrink-0 shadow-inner">
            <AlertOctagon className="w-8 h-8 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-destructive text-destructive-foreground">
                Import Blocked
              </span>
              <span className="text-xs font-mono text-muted-foreground truncate" title={filename}>
                {filename}
              </span>
            </div>
            <h2 className="text-xl font-black text-foreground tracking-tight mt-1.5">
              Incompatible Snapshot Schema Version
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              This `.slr-viewer` dataset file uses an outdated or invalid schema structure and cannot be rendered.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Version Comparison Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-secondary/30 border border-border rounded-xl">
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-card/80 border border-border/60">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Detected File Version
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-500 font-mono font-bold text-xs border border-rose-500/20">
                  {detectedVersion}
                </span>
                <span className="text-[10px] text-rose-500 font-semibold">(Unsupported)</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 p-3 rounded-lg bg-card/80 border border-border/60">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Required SLR Viewer Version
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500 font-mono font-bold text-xs border border-emerald-500/20">
                  v{requiredVersion}+
                </span>
                <span className="text-[10px] text-emerald-500 font-semibold">(Active)</span>
              </div>
            </div>
          </div>

          {/* Error Message Snippet */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              Validation Error Details
            </span>
            <div className="p-3.5 bg-secondary/40 border border-border rounded-xl font-mono text-xs text-rose-500 dark:text-rose-400 break-words select-text">
              {errorMessage}
            </div>
            {missingKeys.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400 space-y-1">
                <span className="font-bold">Missing Required Properties:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {missingKeys.map((k: string) => (
                    <span key={k} className="px-1.5 py-0.5 bg-amber-500/20 rounded font-mono text-[10px]">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actionable Re-export Guide */}
          <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <span className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
              <FileCode className="w-4 h-4 text-primary" />
              How to Resolve (3-Step Re-Export)
            </span>
            <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground">
              <li>
                Open the project in <strong className="text-foreground">SLR IDE</strong> desktop application.
              </li>
              <li>
                Navigate to <strong className="text-foreground">Insight & Export ➔ FAIR Data Export</strong>.
              </li>
              <li>
                Click <strong className="text-foreground">Export .slr-viewer File</strong> to generate a fresh v{requiredVersion}+ compliant snapshot.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleCopyDiagnostics}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-lg transition-colors cursor-pointer w-full sm:w-auto justify-center"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Diagnostics' : 'Copy Diagnostics'}
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onTryAnotherFile && (
              <button
                onClick={onTryAnotherFile}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:bg-primary/90 transition-all cursor-pointer w-full sm:w-auto justify-center shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Another File</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
