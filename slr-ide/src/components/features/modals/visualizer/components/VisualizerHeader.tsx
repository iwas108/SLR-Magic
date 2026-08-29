import React from 'react';
import { 
  BarChart2, 
  X, 
  AlertTriangle, 
  Maximize2, 
  Minimize2, 
  Sparkles,
  Keyboard,
  PanelRightClose,
  PanelRightOpen,
  Wand2
} from 'lucide-react';
import { useVisualizerContext } from '../context/VisualizerContext';

export function VisualizerHeader() {
  const { props, layout, config, workspace } = useVisualizerContext();
  const { papers, totalUnfilteredCount, isFiltered, onClose, umbrellanizerMap } = props;
  const { layoutMode } = layout;
  const { handleAutoOptimizeActiveSlot, autoOptimizeAllSlots } = config;
  const {
    isFullscreen,
    toggleFullscreen,
    isZenMode,
    toggleZenMode,
    showShortcutsModal,
    setShowShortcutsModal
  } = workspace;

  return (
    <div className="h-14 px-4 sm:px-6 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0 relative z-30">
      {/* Studio Brand & Cohort Badge */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground tracking-tight">
              Scientific Visualization Studio
            </h2>
            <span className="px-2 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-wider">
              Live
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-2">
            <span>Cohort: {papers.length} unique papers</span>
            {isFiltered && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                Filtered from {totalUnfilteredCount || papers.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Global Actions: Auto-Optimize, Zen, Shortcuts, Fullscreen, Close */}
      <div className="flex items-center gap-2">
        {/* Auto Optimize Active Slot */}
        <button
          type="button"
          onClick={() => handleAutoOptimizeActiveSlot(papers, umbrellanizerMap)}
          className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
          title="Auto-detect best chart type, variables, and color palette based on data cardinality"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Auto-Optimize</span>
        </button>

        {layoutMode !== 'single' && (
          <button
            type="button"
            onClick={() => autoOptimizeAllSlots(papers, umbrellanizerMap)}
            className="px-2.5 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground border border-border text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs hidden md:flex"
            title="Auto-optimize all subfigure slots simultaneously"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Optimize All Slots</span>
          </button>
        )}

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Zen / Theater Mode Toggle */}
        <button
          type="button"
          onClick={toggleZenMode}
          className={`p-2 rounded-xl border text-xs font-bold transition-colors ${
            isZenMode
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-card border-border hover:bg-secondary text-muted-foreground hover:text-foreground'
          }`}
          title="Toggle Zen Theater Mode (Shortcut: Z)"
        >
          {isZenMode ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
        </button>

        {/* Keyboard Shortcuts Help Button */}
        <button
          type="button"
          onClick={() => setShowShortcutsModal(prev => !prev)}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors"
          title="Keyboard Shortcuts Cheatsheet (Shortcut: ?)"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Fullscreen Toggle Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors"
          title={isFullscreen ? 'Exit Fullscreen (Shortcut: Shift+F)' : 'Enter Fullscreen (Shortcut: Shift+F)'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors"
          title="Close Visualizer (Shortcut: Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Keyboard Shortcuts Popover Modal */}
      {showShortcutsModal && (
        <div className="absolute top-14 right-6 z-50 w-80 bg-card border border-border shadow-2xl rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-primary" /> Keyboard Ergonomics
            </span>
            <button
              type="button"
              onClick={() => setShowShortcutsModal(false)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="py-2.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Toggle Fullscreen</span>
              <kbd className="px-2 py-0.5 bg-secondary border border-border rounded text-[10px] font-mono font-bold text-foreground">Shift + F</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Zen Theater Mode</span>
              <kbd className="px-2 py-0.5 bg-secondary border border-border rounded text-[10px] font-mono font-bold text-foreground">Z</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Toggle Safe Guides</span>
              <kbd className="px-2 py-0.5 bg-secondary border border-border rounded text-[10px] font-mono font-bold text-foreground">G</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Close Visualizer</span>
              <kbd className="px-2 py-0.5 bg-secondary border border-border rounded text-[10px] font-mono font-bold text-foreground">Esc</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
