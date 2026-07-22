import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';

interface DeleteAllPapersConfirmModalProps {
  deleteAllConfirm: boolean;
  setDeleteAllConfirm: (val: boolean) => void;
  loadPapers: () => void;
  loadProjects: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function DeleteAllPapersConfirmModal({
  deleteAllConfirm,
  setDeleteAllConfirm,
  loadPapers,
  loadProjects,
  showToast
}: DeleteAllPapersConfirmModalProps) {
  const [deleteAllConfirmationText, setDeleteAllConfirmationText] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);

  if (!deleteAllConfirm) return null;

  const handleDeleteAllPapers = async () => {
    if (deleteAllConfirmationText !== 'DELETE ALL') return;
    setDeletingAll(true);
    try {
      const res = await fetch('/api/papers?confirm=DELETE_ALL', {
        method: 'DELETE'
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'All papers deleted successfully', 'success');
        setDeleteAllConfirm(false);
        setDeleteAllConfirmationText('');
        loadPapers();
        loadProjects(); // Reload projects stats
        broadcastSync('SYNC_PAPERS');
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to delete all papers', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete all papers', 'error');
    } finally {
      setDeletingAll(false);
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
            <h3 className="font-bold text-sm text-foreground">Confirm Wipe Database</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete <span className="font-bold text-destructive">ALL papers</span> from the database? This action is irreversible and will wipe the entire project database.
            </p>
            
            <div className="mt-4 p-3 bg-secondary/30 border border-border rounded-lg text-left">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Type <span className="text-destructive font-black">DELETE ALL</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteAllConfirmationText}
                onChange={(e) => setDeleteAllConfirmationText(e.target.value)}
                placeholder="DELETE ALL"
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-destructive/35"
              />
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-border bg-secondary/25 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setDeleteAllConfirm(false);
              setDeleteAllConfirmationText('');
            }}
            className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleteAllConfirmationText !== 'DELETE ALL' || deletingAll}
            onClick={handleDeleteAllPapers}
            className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5"
          >
            {deletingAll && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Confirm Delete All
          </button>
        </div>
      </div>
    </div>
  );
}
