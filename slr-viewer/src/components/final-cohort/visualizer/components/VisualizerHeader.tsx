import React from 'react';
import { 
  BarChart2, 
  Check, 
  X, 
  AlertTriangle, 
  Maximize2, 
  Minimize2, 
  Eye, 
  EyeOff, 
  PanelRightClose, 
  PanelRightOpen,
  Keyboard
} from 'lucide-react';
import { useVisualizerContext } from '../context/VisualizerContext';

export function VisualizerHeader() {
  const { props, config, workspace } = useVisualizerContext();
  const { papers, totalUnfilteredCount, isFiltered, onClose } = props;
  const { currentStep, setCurrentStep } = config;
  const {
    isFullscreen,
    toggleFullscreen,
    showLivePreview,
    toggleLivePreview,
    isZenMode,
    toggleZenMode,
    showShortcutsModal,
    setShowShortcutsModal
  } = workspace;

  return (
    <div className="h-16 px-6 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0 relative">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
            SLR Cohort Visualizer Wizard
          </h2>
          <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-2">
            <span>Step-by-step scientific figure generation ({papers.length} papers in source table)</span>
            {isFiltered && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Filtered: {papers.length} / {totalUnfilteredCount || papers.length} papers
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stepper Progress Indicator */}
      <div className="flex items-center gap-2 bg-secondary/40 border border-border rounded-xl p-1">
        {[
          { num: 1, title: '1. Select Type' },
          { num: 2, title: '2. Map Data' },
          { num: 3, title: '3. Customize Style' },
          { num: 4, title: '4. Visualize & Export' }
        ].map(step => (
          <button
            key={step.num}
            onClick={() => setCurrentStep(step.num as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              currentStep === step.num
                ? 'bg-primary text-primary-foreground shadow-sm'
                : currentStep > step.num
                ? 'bg-card text-foreground hover:bg-secondary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {currentStep > step.num ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : null}
            {step.title}
          </button>
        ))}
      </div>

      {/* Workspace Action Toolbar */}
      <div className="flex items-center gap-2">
        {/* Step 2 & 3: Live Preview Toggle */}
        {(currentStep === 2 || currentStep === 3) && (
          <button
            type="button"
            onClick={toggleLivePreview}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 ${
              showLivePreview
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-card border-border hover:bg-secondary text-muted-foreground'
            }`}
            title={`Toggle Live Preview split panel (Shortcut: P)`}
          >
            {showLivePreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{showLivePreview ? 'Live Preview' : 'Preview Off'}</span>
          </button>
        )}

        {/* Step 4: Zen / Theater Mode Toggle */}
        {currentStep === 4 && (
          <button
            type="button"
            onClick={toggleZenMode}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 ${
              isZenMode
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-card border-border hover:bg-secondary text-muted-foreground'
            }`}
            title={`Toggle Zen Stage Mode (Shortcut: Z)`}
          >
            {isZenMode ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
            <span className="hidden sm:inline">{isZenMode ? 'Exit Zen' : 'Zen Stage'}</span>
          </button>
        )}

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
        <div className="absolute top-16 right-6 z-50 w-80 bg-card border border-border shadow-2xl rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
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
              <span className="text-muted-foreground">Live Split Preview (Steps 2 & 3)</span>
              <kbd className="px-2 py-0.5 bg-secondary border border-border rounded text-[10px] font-mono font-bold text-foreground">P</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Zen Theater Mode (Step 4)</span>
              <kbd className="px-2 py-0.5 bg-secondary border border-border rounded text-[10px] font-mono font-bold text-foreground">Z</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Jump to Step 1, 2, 3, 4</span>
              <kbd className="px-2 py-0.5 bg-secondary border border-border rounded text-[10px] font-mono font-bold text-foreground">1, 2, 3, 4</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Exit Zoom / Zen / Close</span>
              <kbd className="px-2 py-0.5 bg-secondary border border-border rounded text-[10px] font-mono font-bold text-foreground">Esc</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
