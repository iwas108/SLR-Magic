'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

import Sidebar from '@/components/Sidebar';
import DashboardView from '../components/features/DashboardView';
import PreCalibrationView from '../components/features/PreCalibrationView';
import IngestionHubView from '../components/features/IngestionHubView';
import PaperDatabaseView from '../components/features/PaperDatabaseView';
import PipelineExecutionView from '../components/features/PipelineExecutionView';
import PostValidationView from '../components/features/PostValidationView';
import FullscreenAssignModal from '../components/features/modals/FullscreenAssignModal';
import FullscreenInterRaterModal from '../components/features/modals/FullscreenInterRaterModal';
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
  const [showImport, setShowImport] = useState(false);
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
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ isOpen: boolean; projectId: string; projectName: string } | null>(null);
  const [deleteProjectConfirmationText, setDeleteProjectConfirmationText] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [compressOnSync, setCompressOnSync] = useState(false);

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
    activeTab
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
    if (activeTab !== 'full-execution') {
      setPreSelectedPaperIds([]);
    }
  }, [activeProjectId, activeTab]);

  const handleRunLLMOnSelected = useCallback((paperIds: string[]) => {
    setPreSelectedPaperIds(paperIds);
    setActiveTab('full-execution');
  }, []);

  const handleThemeChange = useCallback((newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  // Project Settings Modal Open Controller
  const openProjectSettings = useCallback((proj: any) => {
    setEditingProject(proj);
    setShowEditProjectModal(true);
  }, []);

  // Multi-Tab Synchronization: Automatically update the active form data if modified in another tab
  useEffect(() => {
    if (editingProject && showEditProjectModal) {
      const updatedProj = projects.find((p: any) => String(p.id) === String(editingProject.id));
      if (updatedProj && JSON.stringify(updatedProj) !== JSON.stringify(editingProject)) {
        setEditingProject(updatedProj);
        showToast('Project settings were updated in another session. Form data refreshed.', 'info');
      }
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
        </header>

        <div className="flex-1 overflow-hidden p-6 relative">
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
              projectsHook={{
                ...projectsHook,
                createProject: handleCreateProject,
                updateProject: handleSaveProject
              }}
            />
          ) : activeTab === 'pre-calibration' ? (
            <PreCalibrationView
              showToast={showToast}
              projectsHook={projectsHook}
              papersHook={papersHook}
              calibrationHook={calibrationHook}
              showInterRaterModal={showInterRaterModal}
              setShowInterRaterModal={setShowInterRaterModal}
              handleExportCalPoolA={handleExportCalPoolA}
            />
          ) : activeTab === 'full-execution' ? (
            <PipelineExecutionView
              projectsHook={projectsHook}
              showToast={showToast}
              formatBytes={formatBytes}
              pipelineHook={pipelineHook}
              manualScreeningHook={manualScreeningHook}
              preSelectedPaperIds={preSelectedPaperIds}
              setPreSelectedPaperIds={setPreSelectedPaperIds}
            />
          ) : activeTab === 'post-validation' ? (
            <PostValidationView
              projectId={activeProjectId || ''}
              showToast={showToast}
            />
          ) : showImport ? (
            <IngestionHubView
              setShowImport={setShowImport}
              showToast={showToast}
              papers={papersHook.papers}
              loadPapers={loadPapers}
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
              setShowImport={setShowImport}
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
        projectsHook={projectsHook}
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
      />
      <ToastNotifications toasts={toasts} setToasts={setToasts} />
    </div>
  );
}
