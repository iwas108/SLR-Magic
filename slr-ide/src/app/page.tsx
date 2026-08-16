'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, ChevronUp, ChevronDown, BarChart2, Sparkles } from 'lucide-react';

import Sidebar from '@/components/Sidebar';
import DashboardView from '../components/features/DashboardView';
import PreCalibrationView from '../components/features/PreCalibrationView';
import IngestionHubView from '../components/features/IngestionHubView';
import PaperDatabaseView from '../components/features/PaperDatabaseView';
import PipelineExecutionView from '../components/features/PipelineExecutionView';
import PostValidationView from '../components/features/PostValidationView';
import FullscreenAssignModal from '../components/features/modals/FullscreenAssignModal';
import FullscreenInterRaterModal from '../components/features/modals/FullscreenInterRaterModal';
import ProjectLockScreenModal from '../components/features/modals/ProjectLockScreenModal';
import InsightExportView from '../components/features/InsightExportView';
import MinimizedPipelineBanner from '../components/features/dashboard/MinimizedPipelineBanner';
import ToastNotifications from '../components/features/dashboard/ToastNotifications';
import GlobalModals from '../components/features/GlobalModals';

import { useAppSync } from '@/hooks/useAppSync';
import { useProjects } from '@/hooks/useProjects';
import { usePapers } from '@/hooks/usePapers';
import { usePipeline } from '@/hooks/usePipeline';
import { useCalibration } from '@/hooks/useCalibration';
import { useManualScreening } from '@/hooks/useManualScreening';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cohortSearchTerm, setCohortSearchTerm] = useState('');
  const [cohortShowFilters, setCohortShowFilters] = useState(false);
  const [cohortActiveFiltersCount, setCohortActiveFiltersCount] = useState(0);
  const [showInterRaterModal, setShowInterRaterModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }[]>([]);

  // Paper Selection & LLM Run parameters
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [preSelectedPaperIds, setPreSelectedPaperIds] = useState<string[]>([]);
  const [initialSettingsTab, setInitialSettingsTab] = useState<'rclone' | 'scraper'>('rclone');

  // Project Modals & Operations States
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showLockScreenImportModal, setShowLockScreenImportModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivingProject, setArchivingProject] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ isOpen: boolean; projectId: string; projectName: string } | null>(null);
  const [deleteProjectConfirmationText, setDeleteProjectConfirmationText] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [compressOnSync, setCompressOnSync] = useState(false);

  // Cohort Table Visualizer state
  const [isCohortVisualizerOpen, setIsCohortVisualizerOpen] = useState(false);
  const [isCohortLlmContextBuilderOpen, setIsCohortLlmContextBuilderOpen] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  // Instantiating hook: Projects
  const projectsHook = useProjects(showToast);
  const {
    projects,
    activeProjectId,
    activeProject,
    loadProjects,
    createProject,
    updateProject
  } = projectsHook;

  // Instantiating hook: Papers
  const papersHook = usePapers(showToast, loadProjects);
  const { loadPapers, handleSort, loadDuplicatesCount } = papersHook;

  // Instantiating hook: Sequential execution pipeline
  const pipelineHook = usePipeline({
    loadPapers,
    loadProjects,
    showToast,
    compressOnSync
  });

  // Instantiating hook: Calibration & Assignments
  const calibrationHook = useCalibration({
    papers: papersHook.papers,
    loadPapers,
    loadProjects,
    showToast,
    activeTab,
    activeProjectId
  });

  // Instantiating hook: Manual Screening
  const manualScreeningHook = useManualScreening(showToast, activeProjectId);

  // Register multi-tab synchronization BroadcastChannel handler
  useAppSync({
    loadProjects,
    loadPapers,
    loadCalPapers: calibrationHook.loadCalPapers,
    loadAssignPapers: calibrationHook.loadAssignPapers,
    loadDuplicatesCount,
    checkBatchStatus: pipelineHook.checkBatchStatus,
    loadScreeningPapers: manualScreeningHook.loadScreeningPapers
  });

  // Mutable ref for SSE callbacks to prevent stale closures and connection leaks (Rule 3.3)
  const sseCallbacksRef = useRef({
    loadPapers,
    loadProjects,
    loadCalPapers: calibrationHook.loadCalPapers,
    loadAssignPapers: calibrationHook.loadAssignPapers,
    loadScreeningPapers: manualScreeningHook.loadScreeningPapers
  });

  useEffect(() => {
    sseCallbacksRef.current = {
      loadPapers,
      loadProjects,
      loadCalPapers: calibrationHook.loadCalPapers,
      loadAssignPapers: calibrationHook.loadAssignPapers,
      loadScreeningPapers: manualScreeningHook.loadScreeningPapers
    };
  });

  // Global SSE Event Listener for Server-to-Client synchronization
  useEffect(() => {
    let active = true;
    let reconnectTimeout: NodeJS.Timeout;
    const abortController = new AbortController();

    const connect = async () => {
      try {
        const res = await fetch('/api/events', { signal: abortController.signal });
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (active) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.type === 'SYNC_PAPERS') {
                const cb = sseCallbacksRef.current;
                cb.loadPapers();
                cb.loadProjects();
                cb.loadCalPapers();
                cb.loadAssignPapers();
                cb.loadScreeningPapers();
              }
            } catch (e) {}
          }
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        if (active) reconnectTimeout = setTimeout(connect, 3000);
      }
    };
    connect();
    return () => {
      active = false;
      abortController.abort();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  const applyTheme = useCallback((t: string) => {
    const root = document.documentElement;
    if (t === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.className = systemDark ? 'dark' : 'light';
    } else {
      root.className = t;
    }
  }, []);

  // Theme application logic
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    applyTheme(savedTheme);
    loadProjects();
  }, [loadProjects, applyTheme]);

  // Clear selection on project or active view tab change
  useEffect(() => {
    setSelectedPaperIds(new Set());
    if (!activeTab.startsWith('pipeline-') && activeTab !== 'full-execution') {
      setPreSelectedPaperIds([]);
    }
  }, [activeProjectId, activeTab]);

  const handleRunLLMOnSelected = useCallback((paperIds: string[]) => {
    setPreSelectedPaperIds(paperIds);
    setActiveTab('pipeline-llm-operations');
  }, []);

  const handleThemeChange = useCallback((newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  const [projectSettingsInitialTab, setProjectSettingsInitialTab] = useState<'metadata' | 'calibration' | 'sync' | 'llm'>('metadata');

  // Project Settings Modal Open Controller
  const openProjectSettings = useCallback((proj: any, tab: 'metadata' | 'calibration' | 'sync' | 'llm' = 'metadata') => {
    setEditingProject(proj);
    setProjectSettingsInitialTab(tab);
    setShowEditProjectModal(true);
  }, []);

  // Listen for open-project-settings global event
  useEffect(() => {
    const handleOpenSettings = (e: any) => {
      const targetProj = e.detail?.project || activeProject;
      const targetTab = e.detail?.tab || e.detail?.initialTab || 'calibration';
      if (targetProj) {
        openProjectSettings(targetProj, targetTab);
      }
    };
    window.addEventListener('open-project-settings', handleOpenSettings as EventListener);
    return () => {
      window.removeEventListener('open-project-settings', handleOpenSettings as EventListener);
    };
  }, [activeProject, openProjectSettings]);

  const lastLoadedProjectRef = useRef<any>(null);

  // Multi-Tab Synchronization: Automatically update the active form data if modified in another tab
  useEffect(() => {
    if (editingProject && showEditProjectModal) {
      const updatedProj = projects.find((p: any) => String(p.id) === String(editingProject.id));
      if (updatedProj) {
        const isNewProject = !lastLoadedProjectRef.current || String(lastLoadedProjectRef.current.id) !== String(updatedProj.id);
        const dbChanged = lastLoadedProjectRef.current && JSON.stringify(lastLoadedProjectRef.current) !== JSON.stringify(updatedProj);
        lastLoadedProjectRef.current = updatedProj;

        if ((isNewProject || dbChanged) && JSON.stringify(updatedProj) !== JSON.stringify(editingProject)) {
          setEditingProject(updatedProj);
          if (dbChanged && !isNewProject) {
            showToast('Project settings were updated in another session. Form data refreshed.', 'info');
          }
        }
      }
    } else {
      lastLoadedProjectRef.current = null;
    }
  }, [projects, editingProject, showEditProjectModal, showToast]);

  // Create Project handler
  const handleCreateProject = useCallback(async (projectData: any) => {
    setSavingProject(true);
    const success = await createProject(projectData);
    setSavingProject(false);
    return success;
  }, [createProject]);

  // Update Project handler
  const handleSaveProject = useCallback(async (projectId: string, projectData: any) => {
    setSavingProject(true);
    const success = await updateProject(projectId, projectData);
    setSavingProject(false);
    return success;
  }, [updateProject]);

  // Direct blinded .slr export trigger
  const handleExportCalPoolA = useCallback(() => {
    window.open(`/api/export/inter-rater?pool=${calibrationHook.calActivePool}`, '_blank');
    showToast(`Exporting ${calibrationHook.calActivePool.replace('_', ' ').toUpperCase()} blinded review file (.slr)...`, 'info');
  }, [calibrationHook.calActivePool, showToast]);

  // Table Column sorting icons helper functions
  const renderSortIcon = (field: string) => {
    if (papersHook.sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 shrink-0" />;
    }
    return papersHook.sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-primary shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary shrink-0" />
    );
  };

  const formatBytes = (bytes: number, decimals: number = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        setTheme={handleThemeChange}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-sm tracking-tight capitalize">
              {projects.find(p => String(p.id) === String(activeProjectId))?.name || 'Default Project'} • {activeTab.replace('-', ' ')}
            </h2>
            <p className="text-[10px] text-muted-foreground font-medium">Stage 1: Reference Ingestion & matching workflows</p>
          </div>

          {activeTab === 'insight-export-cohort' && (
            <div className="flex items-center gap-2 max-w-xl">
              <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground/70 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search cohort by ID, Title, Authors, or Abstract..."
                  value={cohortSearchTerm}
                  onChange={(e) => setCohortSearchTerm(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary placeholder-muted-foreground/60 transition-colors font-medium"
                />
              </div>

              <button
                onClick={() => setIsCohortVisualizerOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer hover:scale-105 active:scale-95"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Visualize Cohort
              </button>

              <button
                onClick={() => setIsCohortLlmContextBuilderOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer hover:scale-105 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                LLM Context Builder
              </button>

              <button
                onClick={() => setCohortShowFilters(!cohortShowFilters)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 ${
                  cohortShowFilters || cohortActiveFiltersCount > 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Advanced Filters
                {cohortActiveFiltersCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-background/25 text-[10px] font-bold">
                    {cohortActiveFiltersCount}
                  </span>
                )}
                {cohortShowFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          )}
        </header>

        <div className={`flex-1 overflow-hidden relative ${activeTab === 'insight-export-cohort' ? 'p-0' : 'p-6'}`}>
          {activeTab === 'dashboard' ? (
            <DashboardView
              showToast={showToast}
              showCreateProjectModal={showCreateProjectModal}
              setShowCreateProjectModal={setShowCreateProjectModal}
              showEditProjectModal={showEditProjectModal}
              setShowEditProjectModal={setShowEditProjectModal}
              openProjectSettings={openProjectSettings}
              savingProject={savingProject}
              deletingProject={deletingProject}
              deleteProjectConfirm={deleteProjectConfirm}
              setDeleteProjectConfirm={setDeleteProjectConfirm}
              deleteProjectConfirmationText={deleteProjectConfirmationText}
              setDeleteProjectConfirmationText={setDeleteProjectConfirmationText}
              editingProject={editingProject}
              projectSettingsInitialTab={projectSettingsInitialTab}
              setActiveTab={setActiveTab}
              setShowImportModal={setShowImportModal}
              onOpenArchive={(proj: any) => {
                setArchivingProject(proj);
                setShowArchiveModal(true);
              }}
              projectsHook={{
                ...projectsHook,
                createProject: handleCreateProject,
                updateProject: handleSaveProject
              }}
            />
          ) : (activeTab === 'pre-calibration-statistics' || activeTab === 'pre-calibration-papers') ? (
            <PreCalibrationView
              activeSection={activeTab === 'pre-calibration-statistics' ? 'statistics' : 'papers'}
              showToast={showToast}
              projectsHook={projectsHook}
              papersHook={papersHook}
              calibrationHook={calibrationHook}
              showInterRaterModal={showInterRaterModal}
              setShowInterRaterModal={setShowInterRaterModal}
              handleExportCalPoolA={handleExportCalPoolA}
            />
          ) : (activeTab === 'full-execution' || activeTab.startsWith('pipeline-')) ? (
            <PipelineExecutionView
              projectsHook={projectsHook}
              showToast={showToast}
              formatBytes={formatBytes}
              pipelineHook={pipelineHook}
              manualScreeningHook={manualScreeningHook}
              preSelectedPaperIds={preSelectedPaperIds}
              setPreSelectedPaperIds={setPreSelectedPaperIds}
              activeSection={
                activeTab === 'pipeline-llm-operations' ? 'llm' :
                activeTab === 'pipeline-manual-screening' ? 'manual' :
                activeTab === 'pipeline-remote-workers' ? 'workers' :
                'acquisition'
              }
              onSectionChange={(section) => {
                setActiveTab(`pipeline-${section === 'acquisition' ? 'data-acquisition' : section === 'llm' ? 'llm-operations' : section === 'manual' ? 'manual-screening' : 'remote-workers'}`);
              }}
            />
          ) : (activeTab === 'post-validation-umbrellanizer' || activeTab === 'post-validation-rolling-batch') ? (
            <PostValidationView
              activeSubTab={activeTab === 'post-validation-umbrellanizer' ? 'umbrellanizer' : 'rolling-batch'}
              projectId={activeProjectId || ''}
              showToast={showToast}
            />
          ) : (activeTab === 'insight-export-accounting' || activeTab === 'insight-export-rigor' || activeTab === 'insight-export-cohort' || activeTab === 'insight-export-fair-data' || activeTab === 'insight-export-gold-mine') ? (
            <InsightExportView
              activeTab={activeTab}
              projectId={activeProjectId || ''}
              showToast={showToast}
              searchTerm={cohortSearchTerm}
              setSearchTerm={setCohortSearchTerm}
              showFilters={cohortShowFilters}
              setShowFilters={setCohortShowFilters}
              activeFiltersCount={cohortActiveFiltersCount}
              setActiveFiltersCount={setCohortActiveFiltersCount}
              isVisualizerOpen={isCohortVisualizerOpen}
              setIsVisualizerOpen={setIsCohortVisualizerOpen}
              isLlmContextBuilderOpen={isCohortLlmContextBuilderOpen}
              setIsLlmContextBuilderOpen={setIsCohortLlmContextBuilderOpen}
            />
          ) : activeTab === 'paper-database-ingestion' ? (
            <IngestionHubView
              setShowImport={(show) => {
                if (!show) setActiveTab('paper-database-raw');
              }}
              showToast={showToast}
              papers={papersHook.papers}
              loadPapers={loadPapers}
              activeProjectId={activeProjectId}
            />
          ) : (
            <PaperDatabaseView
              duplicatesCount={papersHook.duplicatesCount}
              setShowDuplicateModal={setShowDuplicateModal}
              searchTerm={papersHook.searchTerm}
              setSearchTerm={papersHook.setSearchTerm}
              pdfFilter={papersHook.pdfFilter}
              setPdfFilter={papersHook.setPdfFilter}
              sourceFilter={papersHook.sourceFilter}
              setSourceFilter={papersHook.setSourceFilter}
              doiStatusFilter={papersHook.doiStatusFilter}
              setDoiStatusFilter={papersHook.setDoiStatusFilter}
              pdfLinkFilter={papersHook.pdfLinkFilter}
              setPdfLinkFilter={papersHook.setPdfLinkFilter}
              pipelineStageFilter={papersHook.pipelineStageFilter}
              setPipelineStageFilter={papersHook.setPipelineStageFilter}
              pipelineStatusFilter={papersHook.pipelineStatusFilter}
              setPipelineStatusFilter={papersHook.setPipelineStatusFilter}
              ecTriggerFilter={papersHook.ecTriggerFilter}
              setEcTriggerFilter={papersHook.setEcTriggerFilter}
              poolFilter={papersHook.poolFilter}
              setPoolFilter={papersHook.setPoolFilter}
              setShowImport={(show) => {
                if (show) setActiveTab('paper-database-ingestion');
              }}
              setDeleteAllConfirm={papersHook.setDeleteAllConfirm}
              cloudName={projects.find((p: any) => String(p.id) === String(activeProjectId))?.cloud_provider === 'onedrive' ? 'OneDrive' : 'Google Drive'}
              loadingPapers={papersHook.loadingPapers}
              papers={papersHook.papers}
              totalPapers={papersHook.totalPapers}
              page={papersHook.page}
              setPage={papersHook.setPage}
              limit={papersHook.limit}
              setLimit={papersHook.setLimit}
              totalPages={papersHook.totalPages}
              handleSort={papersHook.handleSort}
              renderSortIcon={renderSortIcon}
              setPaperModal={papersHook.setPaperModal}
              setDeleteConfirm={papersHook.setDeleteConfirm}
              selectedPaperIds={selectedPaperIds}
              setSelectedPaperIds={setSelectedPaperIds}
              onRunLLMOnSelected={handleRunLLMOnSelected}
              showToast={showToast}
              loadPapers={loadPapers}
              activeProjectId={activeProjectId}
            />
          )}
        </div>
      </main>

      <MinimizedPipelineBanner
        pipelineHook={pipelineHook}
        activeTab={activeTab}
        formatBytes={formatBytes}
      />
      <FullscreenAssignModal
        projectsHook={projectsHook}
        papersHook={papersHook}
        calibrationHook={calibrationHook}
        pipelineHook={pipelineHook}
        showToast={showToast}
      />
      <FullscreenInterRaterModal
        showInterRaterModal={showInterRaterModal}
        setShowInterRaterModal={setShowInterRaterModal}
        projectsHook={projectsHook}
        papersHook={papersHook}
        calibrationHook={calibrationHook}
        showToast={showToast}
      />
      <GlobalModals
        projectsHook={{
          ...projectsHook,
          createProject: handleCreateProject,
          updateProject: handleSaveProject
        }}
        papersHook={papersHook}
        deleteProjectConfirm={deleteProjectConfirm}
        setDeleteProjectConfirm={setDeleteProjectConfirm}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        showToast={showToast}
        showDuplicateModal={showDuplicateModal}
        setShowDuplicateModal={setShowDuplicateModal}
        preSelectedPaperIds={preSelectedPaperIds}
        initialSettingsTab={initialSettingsTab}
        showCreateProjectModal={showCreateProjectModal}
        setShowCreateProjectModal={setShowCreateProjectModal}
        showEditProjectModal={showEditProjectModal}
        setShowEditProjectModal={setShowEditProjectModal}
        editingProject={editingProject}
        projectSettingsInitialTab={projectSettingsInitialTab}
        savingProject={savingProject}
        showArchiveModal={showArchiveModal}
        setShowArchiveModal={setShowArchiveModal}
        archivingProject={archivingProject}
        setArchivingProject={setArchivingProject}
        showImportModal={showImportModal || showLockScreenImportModal}
        setShowImportModal={(val) => {
          setShowImportModal(val);
          setShowLockScreenImportModal(val);
        }}
      />
      <ToastNotifications toasts={toasts} setToasts={setToasts} />
      <ProjectLockScreenModal
        isOpen={!projectsHook.loadingProjects && (projects.length === 0 || !activeProject) && !showCreateProjectModal && !showImportModal && !showLockScreenImportModal}
        onOpenCreateProject={() => setShowCreateProjectModal(true)}
        onOpenImportSLR={() => {
          if (projects.length > 0 && activeProject) {
            setActiveTab('paper-database-ingestion');
          } else {
            showToast('Please create or select an active project scope first', 'warning');
          }
        }}
        onOpenImportArchive={() => setShowImportModal(true)}
      />
    </div>
  );
}
