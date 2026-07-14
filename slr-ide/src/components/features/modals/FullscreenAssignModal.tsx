'use client';

import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import PoolStatsHeader from './fullscreen-assign/PoolStatsHeader';
import PaperSelectionList from './fullscreen-assign/PaperSelectionList';
import AssignDetailView from './fullscreen-assign/AssignDetailView';
interface FullscreenAssignModalProps {
  projectsHook: {
    projects: any[];
    activeProjectId: string;
  };
  papersHook: {
    loadPapers: () => void;
  };
  calibrationHook: {
    showAssignModal: boolean;
    setShowAssignModal: React.Dispatch<React.SetStateAction<boolean>>;
    loadCalPapers: () => void;
    assignSearch: string;
    setAssignSearch: (v: string) => void;
    assignPoolFilter: string;
    setAssignPoolFilter: (v: string) => void;
    assignLoading: boolean;
    assignPapers: any[];
    setAssignPapers: React.Dispatch<React.SetStateAction<any[]>>;
    assignSelectedPaper: any;
    setAssignSelectedPaper: React.Dispatch<React.SetStateAction<any>>;
    assignTotalPapers: number;
    assignPage: number;
    setAssignPage: React.Dispatch<React.SetStateAction<number>>;
    assignTotalPages: number;
    assignIsRunning: boolean;
    assignLogs: any[];
    setAssignLogs: React.Dispatch<React.SetStateAction<any[]>>;
    assignProgress: number;
    setAssignProgress: React.Dispatch<React.SetStateAction<number>>;
    assignStatusText: string;
    setAssignStatusText: (v: string) => void;
    activeAssignDropdown: any;
    setActiveAssignDropdown: React.Dispatch<React.SetStateAction<any>>;
    handleAssignPool: (paperId: string, pool: string | null, tag?: string | null) => Promise<void>;
    runSinglePaperPipeline: (paperId: string) => Promise<void>;
    assignWaitingLogin: boolean;
    setAssignWaitingLogin: React.Dispatch<React.SetStateAction<boolean>>;
    singlePipelineAbortControllerRef: React.MutableRefObject<AbortController | null>;
    assignSearchMode: 'keyword' | 'semantic';
    setAssignSearchMode: React.Dispatch<React.SetStateAction<'keyword' | 'semantic'>>;
    vectorIndexStatus: { indexed: boolean; pdf_count: number; paper_count: number } | null;
    loadVectorStatus: () => Promise<void>;
    assignSortBy: string;
    setAssignSortBy: React.Dispatch<React.SetStateAction<string>>;
    assignSortOrder: 'ASC' | 'DESC';
    setAssignSortOrder: React.Dispatch<React.SetStateAction<'ASC' | 'DESC'>>;
    assignSearchTime: number | null;
    triggerSemanticSearch: () => void;
    assignExcludeReviews: boolean;
    setAssignExcludeReviews: React.Dispatch<React.SetStateAction<boolean>>;
    assignPublisherFilter: string;
    setAssignPublisherFilter: React.Dispatch<React.SetStateAction<string>>;
    assignStageFilter: string;
    setAssignStageFilter: React.Dispatch<React.SetStateAction<string>>;
    assignDecisionFilter: string;
    setAssignDecisionFilter: React.Dispatch<React.SetStateAction<string>>;
    uniquePublishers: string[];
    uniqueManualStages: string[];
    uniqueManualDecisions: string[];
  };
  pipelineHook: {
    logEndRef: React.RefObject<HTMLDivElement | null>;
  };
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function FullscreenAssignModal({
  projectsHook,
  papersHook,
  calibrationHook,
  pipelineHook,
  showToast
}: FullscreenAssignModalProps) {
  const { projects, activeProjectId } = projectsHook;
  const { loadPapers } = papersHook;
  const { logEndRef } = pipelineHook;
  const {
    showAssignModal,
    setShowAssignModal,
    loadCalPapers,
    assignSearch,
    setAssignSearch,
    assignPoolFilter,
    setAssignPoolFilter,
    assignLoading,
    assignPapers,
    setAssignPapers,
    assignSelectedPaper,
    setAssignSelectedPaper,
    assignTotalPapers,
    assignPage,
    setAssignPage,
    assignTotalPages,
    assignIsRunning,
    assignLogs,
    setAssignLogs,
    assignProgress,
    setAssignProgress,
    assignStatusText,
    setAssignStatusText,
    activeAssignDropdown,
    setActiveAssignDropdown,
    handleAssignPool,
    runSinglePaperPipeline,
    assignWaitingLogin,
    setAssignWaitingLogin,
    singlePipelineAbortControllerRef,
    assignSearchMode,
    setAssignSearchMode,
    vectorIndexStatus,
    loadVectorStatus,
    assignSortBy,
    setAssignSortBy,
    assignSortOrder,
    setAssignSortOrder,
    assignSearchTime,
    triggerSemanticSearch,
    assignExcludeReviews,
    setAssignExcludeReviews,
    assignPublisherFilter,
    setAssignPublisherFilter,
    assignStageFilter,
    setAssignStageFilter,
    assignDecisionFilter,
    setAssignDecisionFilter,
    uniquePublishers,
    uniqueManualStages,
    uniqueManualDecisions
  } = calibrationHook;

  const cloudProvider = projects.find((p: any) => String(p.id) === String(activeProjectId))?.cloud_provider || 'gdrive';
  const cloudName = cloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive';

  if (!showAssignModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-primary animate-pulse" />
          <div>
            <h3 className="font-bold text-sm">Assign Papers to Calibration Pools</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Select and partition literature references into independent calibration sets</p>
          </div>
        </div>

        <PoolStatsHeader projects={projects} activeProjectId={activeProjectId} />

        <button
          onClick={() => {
            setShowAssignModal(false);
            loadCalPapers();
            loadPapers();
          }}
          className="p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Fullscreen Body split into left list and right details */}
      <div className="flex-1 flex overflow-hidden bg-background">
        <PaperSelectionList
          assignSearch={assignSearch}
          setAssignSearch={setAssignSearch}
          assignPoolFilter={assignPoolFilter}
          setAssignPoolFilter={setAssignPoolFilter}
          assignLoading={assignLoading}
          assignPapers={assignPapers}
          assignSelectedPaper={assignSelectedPaper}
          setAssignSelectedPaper={setAssignSelectedPaper}
          assignIsRunning={assignIsRunning}
          setAssignLogs={setAssignLogs}
          setAssignProgress={setAssignProgress}
          setAssignStatusText={setAssignStatusText}
          assignTotalPapers={assignTotalPapers}
          assignPage={assignPage}
          setAssignPage={setAssignPage}
          assignTotalPages={assignTotalPages}
          showToast={showToast}
          assignSearchMode={assignSearchMode}
          setAssignSearchMode={setAssignSearchMode}
          vectorIndexStatus={vectorIndexStatus}
          loadVectorStatus={loadVectorStatus}
          isMinimized={!!assignSelectedPaper}
          assignSortBy={assignSortBy}
          setAssignSortBy={setAssignSortBy}
          assignSortOrder={assignSortOrder}
          setAssignSortOrder={setAssignSortOrder}
          assignSearchTime={assignSearchTime}
          triggerSemanticSearch={triggerSemanticSearch}
          assignExcludeReviews={assignExcludeReviews}
          setAssignExcludeReviews={setAssignExcludeReviews}
          assignPublisherFilter={assignPublisherFilter}
          setAssignPublisherFilter={setAssignPublisherFilter}
          assignStageFilter={assignStageFilter}
          setAssignStageFilter={setAssignStageFilter}
          assignDecisionFilter={assignDecisionFilter}
          setAssignDecisionFilter={setAssignDecisionFilter}
          uniquePublishers={uniquePublishers}
          uniqueManualStages={uniqueManualStages}
          uniqueManualDecisions={uniqueManualDecisions}
        />
        {assignSelectedPaper && (
          <AssignDetailView
            projects={projects}
            activeProjectId={activeProjectId}
            assignSelectedPaper={assignSelectedPaper}
            setAssignSelectedPaper={setAssignSelectedPaper}
            setAssignPapers={setAssignPapers}
            assignIsRunning={assignIsRunning}
            assignLogs={assignLogs}
            setAssignLogs={setAssignLogs}
            assignProgress={assignProgress}
            setAssignProgress={setAssignProgress}
            assignStatusText={assignStatusText}
            setAssignStatusText={setAssignStatusText}
            activeAssignDropdown={activeAssignDropdown}
            setActiveAssignDropdown={setActiveAssignDropdown}
            handleAssignPool={handleAssignPool}
            cloudName={cloudName}
            runSinglePaperPipeline={runSinglePaperPipeline}
            assignWaitingLogin={assignWaitingLogin}
            setAssignWaitingLogin={setAssignWaitingLogin}
            singlePipelineAbortControllerRef={singlePipelineAbortControllerRef}
            logEndRef={logEndRef}
            onClose={() => setAssignSelectedPaper(null)}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}
