import React, { useState, useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { Paper, Project } from '@/types';
import ManualScreeningStatsHeader from './ManualScreeningStatsHeader';
import ManualScreeningList from './ManualScreeningList';
import ManualScreeningDetailView from './ManualScreeningDetailView';

interface ManualScreeningViewProps {
  projectsHook: {
    projects: Project[];
    activeProjectId: string;
  };
  manualScreeningHook: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function ManualScreeningView({
  projectsHook,
  manualScreeningHook,
  showToast
}: ManualScreeningViewProps) {
  const { projects, activeProjectId } = projectsHook;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    screeningPapers,
    screeningLoading,
    screeningTotal,
    screeningPage,
    setScreeningPage,
    screeningTotalPages,
    screeningSearch,
    setScreeningSearch,
    screeningSearchMode,
    setScreeningSearchMode,
    screeningStageFilter,
    setScreeningStageFilter,
    screeningDecisionFilter,
    setScreeningDecisionFilter,
    pdfFilter,
    setPdfFilter,
    sourceFilter,
    setSourceFilter,
    doiStatusFilter,
    setDoiStatusFilter,
    pdfLinkFilter,
    setPdfLinkFilter,
    pipelineStageFilter,
    setPipelineStageFilter,
    pipelineStatusFilter,
    setPipelineStatusFilter,
    ecTriggerFilter,
    setEcTriggerFilter,
    ecTriggers,
    loadingEcTriggers,
    clearAllFilters,
    screeningStats,
    loadScreeningStats,
    screeningSortBy,
    setScreeningSortBy,
    screeningSortOrder,
    setScreeningSortOrder,
    screeningSearchTime,
    screeningSelectedPaper,
    setScreeningSelectedPaper,
    manualDecision,
    setManualDecision,
    manualEcTrigger,
    setManualEcTrigger,
    manualRationale,
    setManualRationale,
    manualStage,
    setManualStage,
    manualQaScores,
    setManualQaScores,
    manualExtractedData,
    setManualExtractedData,
    screeningSaving,
    screeningError,
    triggerSemanticSearch,
    saveManualDecision,
    clearManualDecision
  } = manualScreeningHook;

  const handleFullscreenToggle = () => {
    setIsFullscreen(prev => !prev);
  };

  const renderContent = () => (
    <div className="flex-1 flex overflow-hidden bg-background">
      <ManualScreeningList
        screeningSearch={screeningSearch}
        setScreeningSearch={setScreeningSearch}
        screeningSearchMode={screeningSearchMode}
        setScreeningSearchMode={setScreeningSearchMode}
        screeningStageFilter={screeningStageFilter}
        setScreeningStageFilter={setScreeningStageFilter}
        screeningDecisionFilter={screeningDecisionFilter}
        setScreeningDecisionFilter={setScreeningDecisionFilter}
        pdfFilter={pdfFilter}
        setPdfFilter={setPdfFilter}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        doiStatusFilter={doiStatusFilter}
        setDoiStatusFilter={setDoiStatusFilter}
        pdfLinkFilter={pdfLinkFilter}
        setPdfLinkFilter={setPdfLinkFilter}
        pipelineStageFilter={pipelineStageFilter}
        setPipelineStageFilter={setPipelineStageFilter}
        pipelineStatusFilter={pipelineStatusFilter}
        setPipelineStatusFilter={setPipelineStatusFilter}
        ecTriggerFilter={ecTriggerFilter}
        setEcTriggerFilter={setEcTriggerFilter}
        ecTriggers={ecTriggers}
        loadingEcTriggers={loadingEcTriggers}
        clearAllFilters={clearAllFilters}
        screeningSortBy={screeningSortBy}
        setScreeningSortBy={setScreeningSortBy}
        screeningSortOrder={screeningSortOrder}
        setScreeningSortOrder={setScreeningSortOrder}
        screeningLoading={screeningLoading}
        screeningPapers={screeningPapers}
        screeningSelectedPaper={screeningSelectedPaper}
        setScreeningSelectedPaper={setScreeningSelectedPaper}
        screeningTotalPapers={screeningTotal}
        screeningPage={screeningPage}
        setScreeningPage={setScreeningPage}
        screeningTotalPages={screeningTotalPages}
        screeningSearchTime={screeningSearchTime}
        triggerSemanticSearch={triggerSemanticSearch}
        isMinimized={!!screeningSelectedPaper}
      />
      {screeningSelectedPaper && (
        <ManualScreeningDetailView
          projects={projects}
          activeProjectId={activeProjectId}
          selectedPaper={screeningSelectedPaper}
          onClose={() => setScreeningSelectedPaper(null)}
          manualDecision={manualDecision}
          setManualDecision={setManualDecision}
          manualEcTrigger={manualEcTrigger}
          setManualEcTrigger={setManualEcTrigger}
          manualRationale={manualRationale}
          setManualRationale={setManualRationale}
          manualStage={manualStage}
          setManualStage={setManualStage}
          manualQaScores={manualQaScores}
          setManualQaScores={setManualQaScores}
          manualExtractedData={manualExtractedData}
          setManualExtractedData={setManualExtractedData}
          screeningSaving={screeningSaving}
          screeningError={screeningError}
          onSave={saveManualDecision}
          onClear={clearManualDecision}
        />
      )}
    </div>
  );

  // Fullscreen modal layout wrapper
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
        <div className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <h3 className="font-bold text-sm">Manual Screening Pipeline Workspace</h3>
              <p className="text-[10px] text-muted-foreground font-medium">Evaluate systematically indexed documents stage-by-stage</p>
            </div>
          </div>

          <ManualScreeningStatsHeader
            stats={screeningStats}
            isFullscreen={isFullscreen}
            onFullscreenToggle={handleFullscreenToggle}
          />

          <button
            onClick={handleFullscreenToggle}
            className="p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {renderContent()}
      </div>
    );
  }

  // Standard Inline Tab Layout
  return (
    <div className="h-full flex flex-col bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border/50 bg-secondary/30 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-sm">Manual Screening Pipeline Dashboard</h3>
          <ManualScreeningStatsHeader
            stats={screeningStats}
            isFullscreen={isFullscreen}
            onFullscreenToggle={handleFullscreenToggle}
          />
        </div>
      </div>
      
      {renderContent()}
    </div>
  );
}
