import React from 'react';
import { FolderPlus, Lock, FileUp, Sparkles } from 'lucide-react';

interface ProjectLockScreenModalProps {
  isOpen: boolean;
  onOpenCreateProject: () => void;
  onOpenImportSLR?: () => void;
  onOpenImportArchive?: () => void;
}

export default function ProjectLockScreenModal({
  isOpen,
  onOpenCreateProject,
  onOpenImportSLR,
  onOpenImportArchive
}: ProjectLockScreenModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-8 shadow-2xl backdrop-blur-xl transition-all">
        {/* Top Decorative Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <div className="flex flex-col items-center text-center">
          {/* Icon Badge with Soft Glow */}
          <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 shadow-inner">
            <Lock className="h-8 w-8 text-indigo-400" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-white shadow-md">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          </div>

          <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            No Active SLR Project Context
          </h2>

          <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed max-w-md font-medium">
            SLR Magic enforces strict FAIR data isolation. To begin ingesting references, executing AI screening pipelines, or performing calibration reviews, you must first create or restore an active literature review project.
          </p>

          <div className="mt-7 w-full flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onOpenCreateProject}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <FolderPlus className="w-4 h-4" />
              Create Project
            </button>

            {onOpenImportArchive && (
              <button
                onClick={onOpenImportArchive}
                className="w-full sm:w-auto px-4 py-2.5 bg-secondary/80 hover:bg-secondary text-foreground border border-border/80 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileUp className="w-4 h-4 text-primary" />
                Import Archive (.slr)
              </button>
            )}

            {onOpenImportSLR && (
              <button
                onClick={onOpenImportSLR}
                className="w-full sm:w-auto px-4 py-2.5 bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                CSV Ingestion
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
