import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';

interface DeletePaperConfirmModalProps {
  deleteConfirm: { isOpen: boolean; paper: any | null };
  setDeleteConfirm: (val: { isOpen: boolean; paper: any | null }) => void;
  paperModal: { isOpen: boolean; mode: string; paper: any | null };
  setPaperModal: (val: { isOpen: boolean; mode: string; paper: any | null }) => void;
  loadPapers: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function DeletePaperConfirmModal({
  deleteConfirm,
  setDeleteConfirm,
  paperModal,
  setPaperModal,
  loadPapers,
  showToast
}: DeletePaperConfirmModalProps) {
  const [deletingPaper, setDeletingPaper] = useState(false);

  if (!deleteConfirm.isOpen || !deleteConfirm.paper) return null;

  const handleDeletePaper = async () => {
    if (!deleteConfirm.paper) return;
    setDeletingPaper(true);
    try {
      const res = await fetch(`/api/papers/${deleteConfirm.paper.Paper_ID}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        showToast('Paper deleted successfully', 'success');
        setDeleteConfirm({ isOpen: false, paper: null });
        if (paperModal.isOpen && paperModal.paper?.Paper_ID === deleteConfirm.paper.Paper_ID) {
          setPaperModal({ isOpen: false, mode: 'view', paper: null });
        }
        loadPapers();
        broadcastSync('SYNC_PAPERS');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to delete paper', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete paper', 'error');
    } finally {
      setDeletingPaper(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-5 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-foreground">Confirm Delete Paper</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete paper <span className="font-bold text-foreground">{deleteConfirm.paper.Paper_ID}</span>: 
              &quot;<span className="italic font-medium">{deleteConfirm.paper.Title}</span>&quot;? This action is irreversible.
            </p>
          </div>
        </div>
        <div className="p-4 border-t border-border bg-secondary/25 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setDeleteConfirm({ isOpen: false, paper: null })}
            className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors"
          >
            Keep Paper
          </button>
          <button
            type="button"
            disabled={deletingPaper}
            onClick={handleDeletePaper}
            className="px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5"
          >
            {deletingPaper && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Yes, Delete Paper
          </button>
        </div>
      </div>
    </div>
  );
}
