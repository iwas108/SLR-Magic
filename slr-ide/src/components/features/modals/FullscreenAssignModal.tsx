'use client';

import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import PoolStatsHeader from './fullscreen-assign/PoolStatsHeader';
import PaperSelectionList from './fullscreen-assign/PaperSelectionList';
import AssignDetailView from './fullscreen-assign/AssignDetailView';
interface FullscreenAssignModalProps {
  showAssignModal: boolean;
  setShowAssignModal: React.Dispatch<React.SetStateAction<boolean>>;
  loadCalPapers: () => void;
  loadPapers: () => void;
  projects: any[];
  activeProjectId: string;
  
  // Paper Selection List props
  assignSearch: string;
  setAssignSearch: (v: string) => void;
  assignPoolFilter: string;
  setAssignPoolFilter: (v: string) => void;
  assignLoading: boolean;
  assignPapers: any[];
  assignSelectedPaper: any;
  setAssignSelectedPaper: React.Dispatch<React.SetStateAction<any>>;
  assignTotalPapers: number;
  assignPage: number;
  setAssignPage: React.Dispatch<React.SetStateAction<number>>;
  assignTotalPages: number;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

  // Assign Detail View props
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
  cloudName: string;
  runSinglePaperPipeline: (paperId: string) => Promise<void>;
  assignWaitingLogin: boolean;
  setAssignWaitingLogin: React.Dispatch<React.SetStateAction<boolean>>;
  singlePipelineAbortControllerRef: React.MutableRefObject<AbortController | null>;
  logEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function FullscreenAssignModal({
  showAssignModal,
  setShowAssignModal,
  loadCalPapers,
  loadPapers,
  projects,
  activeProjectId,
  assignSearch,
  setAssignSearch,
  assignPoolFilter,
  setAssignPoolFilter,
  assignLoading,
  assignPapers,
  assignSelectedPaper,
  setAssignSelectedPaper,
  assignTotalPapers,
  assignPage,
  setAssignPage,
  assignTotalPages,
  showToast,
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
  cloudName,
  runSinglePaperPipeline,
  assignWaitingLogin,
  setAssignWaitingLogin,
  singlePipelineAbortControllerRef,
  logEndRef
}: FullscreenAssignModalProps) {

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
      <div className="flex-1 flex overflow-hidden">
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
        />
        <AssignDetailView
          projects={projects}
          activeProjectId={activeProjectId}
          assignSelectedPaper={assignSelectedPaper}
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
        />
      </div>
    </div>
  );
}
