import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';

interface DeleteProjectConfirmModalProps {
  deleteProjectConfirm: { isOpen: boolean; projectId: string; projectName: string } | null;
  setDeleteProjectConfirm: (val: any | null) => void;
  loadProjects: () => Promise<any>;
  loadPapers: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function DeleteProjectConfirmModal({
  deleteProjectConfirm,
  setDeleteProjectConfirm,
  loadProjects,
  loadPapers,
  showToast
}: DeleteProjectConfirmModalProps) {
  const [deleteProjectConfirmationText, setDeleteProjectConfirmationText] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);

  if (!deleteProjectConfirm?.isOpen) return null;

  const handleDeleteProject = async () => {
    if (!deleteProjectConfirm) return;
    if (deleteProjectConfirmationText !== 'DELETE PROJECT') return;
    
    setDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${deleteProjectConfirm.projectId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Project deleted successfully', 'success');
        setDeleteProjectConfirm(null);
        setDeleteProjectConfirmationText('');
        await loadProjects();
        loadPapers();
        broadcastSync('SYNC_PROJECTS');
        broadcastSync('SYNC_PAPERS');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to delete project', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete project', 'error');
    } finally {
      setDeletingProject(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-5 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2 text-center w-full">
            <h3 className="font-bold text-sm text-foreground">Confirm Wipe Project</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete project <span className="font-bold text-foreground">&quot;{deleteProjectConfirm.projectName}&quot;</span>? This will rescue project PDF assets, but completely delete the project database entry, its papers, decisions, and commitment logs.
            </p>
            
            <div className="mt-4 p-3 bg-secondary/30 border border-border rounded-lg text-left">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Type <span className="text-destructive font-black">DELETE PROJECT</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteProjectConfirmationText}
                onChange={(e) => setDeleteProjectConfirmationText(e.target.value)}
                placeholder="DELETE PROJECT"
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-destructive/35"
              />
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-border bg-secondary/25 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setDeleteProjectConfirm(null);
              setDeleteProjectConfirmationText('');
            }}
            className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleteProjectConfirmationText !== 'DELETE PROJECT' || deletingProject}
            onClick={handleDeleteProject}
            className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5"
          >
            {deletingProject && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Confirm Delete Project
          </button>
        </div>
      </div>
    </div>
  );
}
