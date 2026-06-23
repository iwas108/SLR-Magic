import React from 'react';
import { LayoutDashboard, ExternalLink, RefreshCw, X, Layers } from 'lucide-react';
import InterRaterDashboard from '@/components/InterRaterDashboard';

export default function InterRaterModal({ allProps }: { allProps: any }) {
  const {
    showInterRaterModal, setShowInterRaterModal, projects, activeProjectId, formatBytes,
    showToast, loadCalPapers, loadPapers, setCalActivePool
  } = allProps;

  if (!showInterRaterModal) return null;

  return (
    <>
      {showInterRaterModal && (
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
              activeProject={projects.find((p: any) => p.id === activeProjectId)}
              showToast={showToast}
              loadCalPapers={loadCalPapers}
              setCalActivePool={setCalActivePool}
            />
          </div>
        </div>
      )}

    </>
  );
}
