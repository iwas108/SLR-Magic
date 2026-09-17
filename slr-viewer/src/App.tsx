import React, { useState, useEffect } from 'react';
import { useViewerData } from '@/context/ViewerContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ImportWorkflow from './components/ImportWorkflow';
import ScientificRigorPanel from './components/scientific-rigor/ScientificRigorPanel';
import ScreeningLedgerPanel from './components/screening-ledger/ScreeningLedgerPanel';
import FinalCohortPanel from './components/final-cohort/FinalCohortPanel';
import AccountingPanel from './components/accounting/AccountingPanel';
import FairDataExportPanel from './components/insight-export/FairDataExportPanel';
import ResearchWorkflowPanel from './components/research-workflow/ResearchWorkflowPanel';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import Header from './components/common/Header';
import SnapshotDropzone from './components/import/SnapshotDropzone';

export default function App() {
  const {
    activeSession,
    activeTab,
    switchSession,
    clearActiveSession,
    toast,
    showToast,
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
        {/* Topbar Header */}
        <Header
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onSwitchStudy={() => clearActiveSession()}
        />

        {/* Dynamic View Panels Container */}
        <div className={`flex-1 overflow-auto bg-background/50 ${!activeSession && activeTab !== 'dashboard' ? 'flex items-center justify-center p-4 md:p-6' : activeTab === 'insight-export-cohort' || activeTab === 'insight-export-screening-ledger' ? 'p-0 flex flex-col h-full' : 'p-4 md:p-6'}`}>
          {!activeSession && activeTab !== 'dashboard' ? (
            <SnapshotDropzone onSessionLoaded={(sessionId) => switchSession(sessionId, 'insight-export-rigor')} />
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard onImportClick={() => setIsImportModalOpen(true)} />}

              {activeTab === 'insight-export-workflow' && <ResearchWorkflowPanel />}

              {activeTab === 'insight-export-rigor' && <ScientificRigorPanel />}

              {activeTab === 'insight-export-screening-ledger' && <ScreeningLedgerPanel />}

              {activeTab === 'insight-export-cohort' && <FinalCohortPanel />}

              {activeTab === 'insight-export-accounting' && (
                <AccountingPanel
                  accountingData={activeSession?.rawData?.accounting}
                  projectId={String(activeSession?.rawData?.project?.id || activeSession?.id || '')}
                  showToast={showToast}
                />
              )}

              {activeTab === 'insight-export-fair-data' && <FairDataExportPanel />}
            </>
          )}
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
