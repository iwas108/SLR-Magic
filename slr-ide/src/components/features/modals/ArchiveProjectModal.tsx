import React, { useState } from 'react';
import { Project } from '@/types';
import { 
  Archive, Cloud, Download, Trash2, AlertTriangle, ShieldCheck, 
  FileText, CheckCircle2, Loader2, X, HardDrive, FileArchive 
} from 'lucide-react';

interface ArchiveProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onArchive: (
    projectId: string, 
    options: { destination: 'local' | 'cloud'; keepPdfZip: boolean }
  ) => Promise<boolean>;
}

export default function ArchiveProjectModal({
  isOpen,
  project,
  onClose,
  onArchive
}: ArchiveProjectModalProps) {
  const [destination, setDestination] = useState<'local' | 'cloud'>('local');
  const [keepPdfZip, setKeepPdfZip] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !project) return null;

  const stats = (project as any)?.stats || { total: 0, screened: 0, acquired: 0 };
  const isNameMatched = confirmName.trim().toLowerCase() === project.name.trim().toLowerCase();

  const handleExecute = async () => {
    if (!isNameMatched || isProcessing) return;

    setIsProcessing(true);
    try {
      const success = await onArchive(project.id, {
        destination,
        keepPdfZip
      });
      if (success) {
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Archive & Offboard Project</h3>
              <p className="text-[11px] text-muted-foreground">Export standalone package, optimize system load & purge database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Project Snapshot Card */}
          <div className="bg-secondary/30 border border-border/60 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Target Project</span>
              <span className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">
                {project.id}
              </span>
            </div>
            <h4 className="font-bold text-base text-foreground">{project.name}</h4>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-center">
              <div>
                <div className="text-[9px] text-muted-foreground font-semibold uppercase">Total Papers</div>
                <div className="text-xs font-mono font-bold text-foreground">{stats.total}</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground font-semibold uppercase">Screened</div>
                <div className="text-xs font-mono font-bold text-emerald-500">{stats.screened}</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground font-semibold uppercase">Repo PDFs</div>
                <div className="text-xs font-mono font-bold text-amber-500">{stats.acquired}</div>
              </div>
            </div>
          </div>

          {/* Destination Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
              1. Archive Destination
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDestination('local')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                  destination === 'local'
                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                    : 'border-border/60 bg-card hover:bg-secondary/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Download className="w-4 h-4 text-primary" />
                  Local File (.slr)
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Download package directly to your computer
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDestination('cloud')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                  destination === 'cloud'
                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                    : 'border-border/60 bg-card hover:bg-secondary/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Cloud className="w-4 h-4 text-primary" />
                  Cloud Storage
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Sync to Rclone remote ({project.cloud_provider || 'gdrive'})
                </span>
              </button>
            </div>
          </div>

          {/* Project PDF Retention Option */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
              2. Project Repository PDFs Handling
            </label>
            <div className="bg-card border border-border/80 rounded-xl p-3.5 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepPdfZip}
                  onChange={(e) => setKeepPdfZip(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                />
                <div className="space-y-1">
                  <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <FileArchive className="w-3.5 h-3.5 text-amber-500" />
                    Download Project PDFs as ZIP package
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    If unselected, project repository PDFs will be permanently deleted to save disk space and will not be copied back to raw storage. Pre-existing files in eternal raw/cached library remain safely intact.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Zero-Trace Purge & VACUUM Notice */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px]">
              <span className="font-bold block">Zero-Trace Purge & VACUUM Optimization</span>
              <p className="leading-relaxed opacity-90">
                All 15 database tables for this project will be completely wiped, and SQLite <code className="font-mono px-1 py-0.5 bg-amber-500/10 rounded">VACUUM</code> will be executed to reclaim 100% disk space. You can restore this project at any time using the exported <code className="font-mono">.slr</code> archive.
              </p>
            </div>
          </div>

          {/* Type Confirmation Phrase */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Type project name <span className="font-mono text-foreground font-black">"{project.name}"</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={project.name}
              disabled={isProcessing}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 flex items-center justify-end gap-2.5 bg-secondary/15">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary/60 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecute}
            disabled={!isNameMatched || isProcessing}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
              isNameMatched && !isProcessing
                ? 'bg-amber-600 hover:bg-amber-700 text-white hover:shadow-lg'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Archiving & Purging...
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                Archive & Purge Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
