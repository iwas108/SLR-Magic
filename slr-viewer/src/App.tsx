import React, { useState, useEffect } from 'react';
import { useViewerData } from '@/context/ViewerContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ImportWorkflow from './components/ImportWorkflow';
import ScientificRigorPanel from './components/scientific-rigor/ScientificRigorPanel';
import FinalCohortPanel from './components/final-cohort/FinalCohortPanel';
import AccountingPanel from './components/accounting/AccountingPanel';
import FairDataExportPanel from './components/insight-export/FairDataExportPanel';
import ResearchWorkflowPanel from './components/research-workflow/ResearchWorkflowPanel';
import { Search, Filter, CheckCircle2, AlertCircle, Info, X, BarChart2, Sparkles, Upload } from 'lucide-react';

export default function App() {
  const {
    activeSession,
    activeTab,
    setActiveTab,
    switchSession,
    toast,
    showToast,
    searchTerm,
    setSearchTerm,
    showFilters,
    setShowFilters,
    activeFiltersCount,
    setIsVisualizerOpen,
    setIsLlmContextBuilderOpen,
    isImportModalOpen,
    setIsImportModalOpen
  } = useViewerData();

  const [theme, setTheme] = useState<string>(() => localStorage.getItem('slr_viewer_theme') || 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('slr_viewer_theme', theme);
  }, [theme]);

  const activeProjectName = activeSession?.projectName || 'No Project Selected';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans antialiased">
      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-popover border border-border rounded-xl shadow-2xl text-xs font-bold text-popover-foreground animate-in slide-in-from-bottom-5 duration-200">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-sky-500 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* SLR-IDE Style Collapsible Left Sidebar */}
      <Sidebar
        theme={theme}
        setTheme={setTheme}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      {/* Main Content Workspace Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
        {/* Topbar Header matching SLR-IDE */}
        <header className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="font-bold text-sm tracking-tight capitalize flex items-center gap-2">
                <span>{activeProjectName}</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  • {activeTab.replace('insight-export-', '').replace('-', ' ')}
                </span>
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium">
                Online SLR Presentation & Evaluation Viewer (GitHub Pages)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-lg transition-all border border-border cursor-pointer shrink-0"
              title="Import .slr-viewer snapshot file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Snapshot</span>
            </button>

            {activeTab === 'insight-export-cohort' && (
              <>
                <div className="relative w-64 md:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search final cohort papers, authors, DOIs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-medium"
                  />
                </div>

                <button
                  onClick={() => setIsVisualizerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer shrink-0 hover:scale-105 active:scale-95"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Visualize Cohort</span>
                </button>

                <button
                  onClick={() => setIsLlmContextBuilderOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer shrink-0 hover:scale-105 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>LLM Context Builder</span>
                </button>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    showFilters || activeFiltersCount > 0
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-secondary hover:bg-secondary/80 border-border text-foreground'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[9px] font-black">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </header>

        {/* Dynamic View Panels Container */}
        <div className={`flex-1 overflow-auto bg-background/50 ${activeTab === 'insight-export-cohort' ? 'p-0 flex flex-col h-full' : 'p-4 md:p-6'}`}>
          {activeTab === 'dashboard' && <Dashboard onImportClick={() => setIsImportModalOpen(true)} />}

          {activeTab === 'insight-export-workflow' && <ResearchWorkflowPanel />}

          {activeTab === 'insight-export-rigor' && <ScientificRigorPanel />}

          {activeTab === 'insight-export-cohort' && <FinalCohortPanel />}

          {activeTab === 'insight-export-accounting' && (
            <AccountingPanel
              accountingData={activeSession?.rawData?.accounting}
              projectId={String(activeSession?.rawData?.project?.id || activeSession?.id || '')}
              showToast={showToast}
            />
          )}

          {activeTab === 'insight-export-fair-data' && <FairDataExportPanel />}
        </div>
      </main>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsImportModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <ImportWorkflow
              onImportSuccess={async (sessionId) => {
                setIsImportModalOpen(false);
                if (sessionId) await switchSession(sessionId, 'insight-export-rigor');
              }}
              onCancel={() => setIsImportModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
