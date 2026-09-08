import React, { useEffect } from 'react';
import { Sparkles, X, Layers, HelpCircle } from 'lucide-react';
import { CustomGroupingManager } from './CustomGroupingManager';

export interface CustomGroupingModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSlotIndex?: number;
}

export function CustomGroupingModal({ isOpen, onClose, targetSlotIndex }: CustomGroupingModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl max-h-[90vh] bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h4 className="text-base font-black text-foreground flex items-center gap-2">
                Universal Custom Grouping & Thematic Stratification Layer
              </h4>
              <p className="text-xs text-muted-foreground">
                Group, cluster, or bundle rare categories from any cohort variable into named academic dimensions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-bold text-foreground transition-all flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Modal Body with Custom Grouping Manager */}
        <div className="flex-1 overflow-y-auto pr-1">
          <CustomGroupingManager onClose={onClose} targetSlotIndex={targetSlotIndex} />
        </div>
      </div>
    </div>
  );
}
