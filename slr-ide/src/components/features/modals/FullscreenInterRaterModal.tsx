'use client';

import React from 'react';
import { LayoutDashboard, X } from 'lucide-react';
import InterRaterDashboard from '@/components/InterRaterDashboard';
interface FullscreenInterRaterModalProps {
  showInterRaterModal: boolean;
  setShowInterRaterModal: React.Dispatch<React.SetStateAction<boolean>>;
  loadCalPapers: () => void;
  loadPapers: () => void;
  activeProjectId: string;
  projects: any[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  setCalActivePool: (pool: 'pool_a' | 'pool_b' | 'pool_c') => void;
}

export default function FullscreenInterRaterModal({
  showInterRaterModal,
  setShowInterRaterModal,
  loadCalPapers,
  loadPapers,
  activeProjectId,
  projects,
  showToast,
  setCalActivePool
}: FullscreenInterRaterModalProps) {

  if (!showInterRaterModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-5 h-5 text-primary animate-pulse" />
          <div>
            <h3 className="font-bold text-sm">Inter-Rater Dashboard</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Evaluate consensus, reconcile conflicts, and generate blinded calibration reviews</p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowInterRaterModal(false);
            loadCalPapers();
            loadPapers();
          }}
          className="p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Fullscreen Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <InterRaterDashboard
          activeProjectId={activeProjectId}
          activeProject={projects.find((p: any) => String(p.id) === String(activeProjectId))}
          showToast={showToast}
          loadCalPapers={loadCalPapers}
          setCalActivePool={setCalActivePool}
        />
      </div>
    </div>
  );
}
