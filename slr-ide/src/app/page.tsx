'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

import Sidebar from '@/components/Sidebar';
import DashboardView from '../components/features/DashboardView';
import PreCalibrationView from '../components/features/PreCalibrationView';
import IngestionHubView from '../components/features/IngestionHubView';
import PaperDatabaseView from '../components/features/PaperDatabaseView';
import PipelineExecutionView from '../components/features/PipelineExecutionView';
import FullscreenAssignModal from '../components/features/modals/FullscreenAssignModal';
import FullscreenInterRaterModal from '../components/features/modals/FullscreenInterRaterModal';
import MinimizedPipelineBanner from '../components/features/dashboard/MinimizedPipelineBanner';
import ToastNotifications from '../components/features/dashboard/ToastNotifications';
import GlobalModals from '../components/features/GlobalModals';

import { useAppSync } from '@/hooks/useAppSync';
import { useProjects } from '@/hooks/useProjects';
import { useProjectForm } from '@/hooks/useProjectForm';
import { usePapers } from '@/hooks/usePapers';
import { useIngestion } from '@/hooks/useIngestion';
import { usePipeline } from '@/hooks/usePipeline';
import { useCalibration } from '@/hooks/useCalibration';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showImport, setShowImport] = useState(false);
  const [showInterRaterModal, setShowInterRaterModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }[]>([]);

  // Project Modals & Operations States
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectSettingsTab, setProjectSettingsTab] = useState<'metadata' | 'calibration' | 'sync'>('metadata');
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ isOpen: boolean; projectId: string; projectName: string } | null>(null);
  const [deleteProjectConfirmationText, setDeleteProjectConfirmationText] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [compressOnSync, setCompressOnSync] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Instantiating hook: Projects
  const projectsHook = useProjects(showToast);
  const {
    projects,
    activeProjectId,
    activeProject,
    loadingProjects,
    testingProjectConnection,
    projectConnectionTestResult,
    loadProjects,
    activateProject,
    createProject,
    updateProject,
    deleteProject,
    handleTestProjectConnection
  } = projectsHook;

  // Instantiating hook: Project Form (Shared between create & edit)
  const projectFormHook = useProjectForm();

  // Instantiating hook: Papers
  const papersHook = usePapers(showToast, loadProjects);
  const { loadPapers, handleSort, loadDuplicatesCount } = papersHook;

  // Instantiating hook: Ingestion
  const ingestionHook = useIngestion(showToast, papersHook.papers, loadPapers);

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

  // Register multi-tab synchronization BroadcastChannel handler
  useAppSync({
    loadProjects,
    loadPapers,
    loadCalPapers: calibrationHook.loadCalPapers,
    loadAssignPapers: calibrationHook.loadAssignPapers,
    loadDuplicatesCount
  });

  // Theme application logic
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    applyTheme(savedTheme);
    loadProjects();
  }, [loadProjects]);

  const applyTheme = (t: string) => {
    const root = document.documentElement;
    if (t === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.className = systemDark ? 'dark' : 'light';
    } else {
      root.className = t;
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  // Project Settings Modal Open Controller
  const openProjectSettings = (proj: any) => {
    projectFormHook.populateForm(proj);
    setEditingProjectId(proj.id);
    setShowEditProjectModal(true);
  };

  // Create Project handler
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectFormHook.name.trim()) {
      showToast('Project name is mandatory', 'error');
      return;
    }
    if (!projectFormHook.folderName.trim()) {
      showToast('Folder name is mandatory', 'error');
      return;
    }
    setSavingProject(true);
    const success = await createProject({
      name: projectFormHook.name,
      folder_name: projectFormHook.folderName,
      manifesto: projectFormHook.manifesto,
      objective: projectFormHook.objective,
      questions: projectFormHook.questions,
      qa_definition: projectFormHook.qaDefinition,
      exclusion_criteria: projectFormHook.exclusionCriteria,
      pool_a_size: projectFormHook.poolA,
      pool_b_size: projectFormHook.poolB,
      pool_c_size: projectFormHook.poolC,
      gdrive_dest_path: projectFormHook.gdriveDest,
      cloud_provider: projectFormHook.cloudProvider,
      rclone_remote_name: projectFormHook.remoteName,
      pool_tags: projectFormHook.poolTags
    });
    setSavingProject(false);
    if (success) {
      setShowCreateProjectModal(false);
      projectFormHook.resetForm();
    }
  };

  // Update Project/Manifesto handler
  const handleSaveProjectManifesto = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = editingProjectId || activeProjectId;
    if (!targetId) return;
    setSavingProject(true);
    const success = await updateProject(targetId, {
      name: projectFormHook.name,
      manifesto: projectFormHook.manifesto,
      objective: projectFormHook.objective,
      questions: projectFormHook.questions,
      qa_definition: projectFormHook.qaDefinition,
      exclusion_criteria: projectFormHook.exclusionCriteria,
      pool_a_size: projectFormHook.poolA,
      pool_b_size: projectFormHook.poolB,
      pool_c_size: projectFormHook.poolC,
      gdrive_dest_path: projectFormHook.gdriveDest,
      cloud_provider: projectFormHook.cloudProvider,
      rclone_remote_name: projectFormHook.remoteName,
      pool_tags: projectFormHook.poolTags,
      ec_rules: projectFormHook.ecRules,
      reasoning_template: projectFormHook.reasoningTemplate,
      pool_b_ec_rules: projectFormHook.poolBEcRules,
      pool_b_reasoning_template: projectFormHook.poolBReasoningTemplate,
      pool_c_qa_rules: projectFormHook.poolCQaRules,
      pool_c_extraction_rules: projectFormHook.poolCExtractionRules
    });
    setSavingProject(false);
    if (success) {
      setShowEditProjectModal(false);
    }
  };

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

  const renderCalSortIcon = (field: string) => {
    if (calibrationHook.calSortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 shrink-0" />;
    }
    return calibrationHook.calSortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-primary shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary shrink-0" />
    );
  };

  // Direct blinded .slr export trigger
  const handleExportCalPoolA = () => {
    window.open(`/api/export/inter-rater?pool=${calibrationHook.calActivePool}`, '_blank');
    showToast(`Exporting ${calibrationHook.calActivePool.replace('_', ' ').toUpperCase()} blinded review file (.slr)...`, 'info');
  };

  // Helper values
  const hasLocalPdf = !!(
    papersHook.paperModal.isOpen &&
    papersHook.paperModal.paper?.Local_PDF_Path &&
    ['MATCHED', 'DOWNLOADED', 'SYNCED'].includes(papersHook.paperModal.paper?.Local_PDF_Status)
  );

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
              activeProject={activeProject}
              activeProjectId={activeProjectId}
              projects={projects}
              activateProject={activateProject}
              loadProjects={loadProjects}
              showCreateProjectModal={showCreateProjectModal}
              setShowCreateProjectModal={setShowCreateProjectModal}
              showEditProjectModal={showEditProjectModal}
              setShowEditProjectModal={setShowEditProjectModal}
              handleCreateProject={handleCreateProject}
              handleSaveProjectManifesto={handleSaveProjectManifesto}
              openProjectSettings={openProjectSettings}
              savingProject={savingProject}
              deletingProject={deletingProject}
              deleteProjectConfirm={deleteProjectConfirm}
              setDeleteProjectConfirm={setDeleteProjectConfirm}
              deleteProjectConfirmationText={deleteProjectConfirmationText}
              setDeleteProjectConfirmationText={setDeleteProjectConfirmationText}
              newProjName={projectFormHook.name}
              setNewProjName={projectFormHook.setName}
              newProjFolder={projectFormHook.folderName}
              setNewProjFolder={projectFormHook.setFolderName}
              newProjManifesto={projectFormHook.manifesto}
              setNewProjManifesto={projectFormHook.setManifesto}
              newProjObjective={projectFormHook.objective}
              setNewProjObjective={projectFormHook.setObjective}
              newProjQuestions={projectFormHook.questions}
              setNewProjQuestions={projectFormHook.setQuestions}
              newProjQaDefinition={projectFormHook.qaDefinition}
              setNewProjQaDefinition={projectFormHook.setQaDefinition}
              newProjExclusionCriteria={projectFormHook.exclusionCriteria}
              setNewProjExclusionCriteria={projectFormHook.setExclusionCriteria}
              newProjPoolA={projectFormHook.poolA}
              setNewProjPoolA={projectFormHook.setPoolA}
              newProjPoolB={projectFormHook.poolB}
              setNewProjPoolB={projectFormHook.setPoolB}
              newProjPoolC={projectFormHook.poolC}
              setNewProjPoolC={projectFormHook.setPoolC}
              newProjGDriveDest={projectFormHook.gdriveDest}
              setNewProjGDriveDest={projectFormHook.setGdriveDest}
              newProjCloudProvider={projectFormHook.cloudProvider}
              setNewProjCloudProvider={projectFormHook.setCloudProvider}
              newProjRemoteName={projectFormHook.remoteName}
              setNewProjRemoteName={projectFormHook.setRemoteName}
              newProjPoolTags={projectFormHook.poolTags}
              setNewProjPoolTags={projectFormHook.setPoolTags}
              projectFormName={projectFormHook.name}
              setProjectFormName={projectFormHook.setName}
              projectFormManifesto={projectFormHook.manifesto}
              setProjectFormManifesto={projectFormHook.setManifesto}
              projectFormObjective={projectFormHook.objective}
              setProjectFormObjective={projectFormHook.setObjective}
              projectFormQuestions={projectFormHook.questions}
              setProjectFormQuestions={projectFormHook.setQuestions}
              projectFormQaDefinition={projectFormHook.qaDefinition}
              setProjectFormQaDefinition={projectFormHook.setQaDefinition}
              projectFormExclusionCriteria={projectFormHook.exclusionCriteria}
              setProjectFormExclusionCriteria={projectFormHook.setExclusionCriteria}
              projectFormPoolA={projectFormHook.poolA}
              setProjectFormPoolA={projectFormHook.setPoolA}
              projectFormPoolB={projectFormHook.poolB}
              setProjectFormPoolB={projectFormHook.setPoolB}
              projectFormPoolC={projectFormHook.poolC}
              setProjectFormPoolC={projectFormHook.setPoolC}
              projectFormGDriveDest={projectFormHook.gdriveDest}
              setProjectFormGDriveDest={projectFormHook.setGdriveDest}
              projectFormCloudProvider={projectFormHook.cloudProvider}
              setProjectFormCloudProvider={projectFormHook.setCloudProvider}
              projectFormRemoteName={projectFormHook.remoteName}
              setProjectFormRemoteName={projectFormHook.setRemoteName}
              projectFormPoolTags={projectFormHook.poolTags}
              setProjectFormPoolTags={projectFormHook.setPoolTags}
              projectFormEcRules={projectFormHook.ecRules}
              setProjectFormEcRules={projectFormHook.setEcRules}
              projectFormReasoningTemplate={projectFormHook.reasoningTemplate}
              setProjectFormReasoningTemplate={projectFormHook.setReasoningTemplate}
              projectFormPoolBEcRules={projectFormHook.poolBEcRules}
              setProjectFormPoolBEcRules={projectFormHook.setPoolBEcRules}
              projectFormPoolBReasoningTemplate={projectFormHook.poolBReasoningTemplate}
              setProjectFormPoolBReasoningTemplate={projectFormHook.setPoolBReasoningTemplate}
              projectFormPoolCQaRules={projectFormHook.poolCQaRules}
              setProjectFormPoolCQaRules={projectFormHook.setPoolCQaRules}
              projectFormPoolCExtractionRules={projectFormHook.poolCExtractionRules}
              setProjectFormPoolCExtractionRules={projectFormHook.setPoolCExtractionRules}
              handleAddPoolTag={projectFormHook.handleAddPoolTag}
              handleUpdatePoolTag={projectFormHook.handleUpdatePoolTag}
              handleRemovePoolTag={projectFormHook.handleRemovePoolTag}
              handleAddEcRule={projectFormHook.handleAddEcRule}
              handleUpdateEcRule={projectFormHook.handleUpdateEcRule}
              handleRemoveEcRule={projectFormHook.handleRemoveEcRule}
              handleAddReasoningTemplate={projectFormHook.handleAddReasoningTemplate}
              handleUpdateReasoningTemplate={projectFormHook.handleUpdateReasoningTemplate}
              handleRemoveReasoningTemplate={projectFormHook.handleRemoveReasoningTemplate}
              handleAddPoolBEcRule={projectFormHook.handleAddPoolBEcRule}
              handleUpdatePoolBEcRule={projectFormHook.handleUpdatePoolBEcRule}
              handleRemovePoolBEcRule={projectFormHook.handleRemovePoolBEcRule}
              handleAddPoolBReasoningTemplate={projectFormHook.handleAddPoolBReasoningTemplate}
              handleUpdatePoolBReasoningTemplate={projectFormHook.handleUpdatePoolBReasoningTemplate}
              handleRemovePoolBReasoningTemplate={projectFormHook.handleRemovePoolBReasoningTemplate}
              handleAddPoolCQaRule={projectFormHook.handleAddPoolCQaRule}
              handleUpdatePoolCQaRule={projectFormHook.handleUpdatePoolCQaRule}
              handleRemovePoolCQaRule={projectFormHook.handleRemovePoolCQaRule}
              handleAddPoolCExtractionRule={projectFormHook.handleAddPoolCExtractionRule}
              handleUpdatePoolCExtractionRule={projectFormHook.handleUpdatePoolCExtractionRule}
              handleRemovePoolCExtractionRule={projectFormHook.handleRemovePoolCExtractionRule}
              editingProjectId={editingProjectId}
              handleTestProjectConnection={handleTestProjectConnection}
              testingProjectConnection={testingProjectConnection}
              projectConnectionTestResult={projectConnectionTestResult}
            />
          ) : activeTab === 'pre-calibration' ? (
            <PreCalibrationView
              showToast={showToast}
              activeProject={activeProject}
              projects={projects}
              activeProjectId={activeProjectId}
              paperModal={papersHook.paperModal}
              setPaperModal={papersHook.setPaperModal}
              calActivePool={calibrationHook.calActivePool}
              setCalActivePool={calibrationHook.setCalActivePool}
              calStats={calibrationHook.calStats}
              calPapers={calibrationHook.calPapers}
              calLoading={calibrationHook.calLoading}
              calSearchTerm={calibrationHook.calSearchTerm}
              setCalSearchTerm={calibrationHook.setCalSearchTerm}
              calStatusFilter={calibrationHook.calStatusFilter}
              setCalStatusFilter={calibrationHook.setCalStatusFilter}
              calPdfFilter={calibrationHook.calPdfFilter}
              setCalPdfFilter={calibrationHook.setCalPdfFilter}
              calPage={calibrationHook.calPage}
              setCalPage={calibrationHook.setCalPage}
              calLimit={calibrationHook.calLimit}
              setCalLimit={calibrationHook.setCalLimit}
              calTotalPapers={calibrationHook.calTotalPapers}
              calTotalPages={calibrationHook.calTotalPages}
              calSortBy={calibrationHook.calSortBy}
              calSortOrder={calibrationHook.calSortOrder}
              showAssignModal={calibrationHook.showAssignModal}
              setShowAssignModal={calibrationHook.setShowAssignModal}
              showInterRaterModal={showInterRaterModal}
              setShowInterRaterModal={setShowInterRaterModal}
              assignIsRunning={calibrationHook.assignIsRunning}
              setAssignIsRunning={calibrationHook.setAssignIsRunning}
              assignStatusText={calibrationHook.assignStatusText}
              setAssignStatusText={calibrationHook.setAssignStatusText}
              setAssignLogs={calibrationHook.setAssignLogs}
              handleCalSort={calibrationHook.handleCalSort}
              handleAssignPool={calibrationHook.handleAssignPool}
              handleExportCalPoolA={handleExportCalPoolA}
              loadCalPapers={calibrationHook.loadCalPapers}
              loadAssignPapers={calibrationHook.loadAssignPapers}
            />
          ) : activeTab === 'full-execution' ? (
            <PipelineExecutionView
              activeProject={activeProject}
              loadProjects={loadProjects}
              showToast={showToast}
              batchSteps={pipelineHook.batchSteps}
              setBatchSteps={pipelineHook.setBatchSteps}
              operationModal={pipelineHook.operationModal}
              runBatchExecution={pipelineHook.runBatchExecution}
              cloudProvider={projectsHook.projects.find((p: any) => String(p.id) === String(projectsHook.activeProjectId))?.cloud_provider || 'gdrive'}
              cloudName={projectsHook.projects.find((p: any) => String(p.id) === String(projectsHook.activeProjectId))?.cloud_provider === 'onedrive' ? 'OneDrive' : 'Google Drive'}
              pipelineStats={pipelineHook.pipelineStats}
              currentStep={pipelineHook.currentStep}
              setCurrentStep={pipelineHook.setCurrentStep}
              formatBytes={formatBytes}
              getTimeEstimates={pipelineHook.getTimeEstimates}
              indexingState={pipelineHook.indexingState}
              logEndRef={pipelineHook.logEndRef}
              handleResumeOperation={pipelineHook.handleResumeOperation}
              handleCancelOperation={pipelineHook.handleCancelOperation}
              setOperationModal={pipelineHook.setOperationModal}
            />
          ) : showImport ? (
            <IngestionHubView
              setShowImport={setShowImport}
              csvFile={ingestionHook.csvFile}
              setCsvFile={ingestionHook.setCsvFile}
              csvHeaders={ingestionHook.csvHeaders}
              csvData={ingestionHook.csvData}
              csvSource={ingestionHook.csvSource}
              setCsvSource={ingestionHook.setCsvSource}
              csvImportDate={ingestionHook.csvImportDate}
              setCsvImportDate={ingestionHook.setCsvImportDate}
              columnMapping={ingestionHook.columnMapping}
              setColumnMapping={ingestionHook.setColumnMapping}
              previewPapers={ingestionHook.previewPapers}
              previewStats={ingestionHook.previewStats}
              importing={ingestionHook.importing}
              handleCsvSelect={ingestionHook.handleCsvSelect}
              handleImport={ingestionHook.handleImport}
              manualSource={ingestionHook.manualSource}
              setManualSource={ingestionHook.setManualSource}
              manualImportDate={ingestionHook.manualImportDate}
              setManualImportDate={ingestionHook.setManualImportDate}
              manualYear={ingestionHook.manualYear}
              setManualYear={ingestionHook.setManualYear}
              manualTitle={ingestionHook.manualTitle}
              setManualTitle={ingestionHook.setManualTitle}
              manualAuthors={ingestionHook.manualAuthors}
              setManualAuthors={ingestionHook.setManualAuthors}
              manualDoi={ingestionHook.manualDoi}
              setManualDoi={ingestionHook.setManualDoi}
              manualAbstract={ingestionHook.manualAbstract}
              setManualAbstract={ingestionHook.setManualAbstract}
              manualIngesting={ingestionHook.manualIngesting}
              manualParentPaperId={ingestionHook.manualParentPaperId}
              setManualParentPaperId={ingestionHook.setManualParentPaperId}
              manualParentSearch={ingestionHook.manualParentSearch}
              setManualParentSearch={ingestionHook.setManualParentSearch}
              showParentSuggestions={ingestionHook.showParentSuggestions}
              setShowParentSuggestions={ingestionHook.setShowParentSuggestions}
              parentPaperSuggestions={ingestionHook.parentPaperSuggestions}
              setParentPaperSuggestions={ingestionHook.setParentPaperSuggestions}
              selectedParentPaper={ingestionHook.selectedParentPaper}
              setSelectedParentPaper={ingestionHook.setSelectedParentPaper}
              handleManualIngest={ingestionHook.handleManualIngest}
            />
          ) : (
            <PaperDatabaseView
              duplicatesCount={papersHook.duplicatesCount}
              setShowDuplicateModal={setShowDuplicateModal}
              searchTerm={papersHook.searchTerm}
              setSearchTerm={papersHook.setSearchTerm}
              statusFilter={papersHook.statusFilter}
              setStatusFilter={papersHook.setStatusFilter}
              pdfFilter={papersHook.pdfFilter}
              setPdfFilter={papersHook.setPdfFilter}
              setShowImport={setShowImport}
              setDeleteAllConfirm={papersHook.setDeleteAllConfirm}
              operationModal={pipelineHook.operationModal}
              setOperationModal={pipelineHook.setOperationModal}
              currentStep={pipelineHook.currentStep}
              setCurrentStep={pipelineHook.setCurrentStep}
              pipelineStats={pipelineHook.pipelineStats}
              indexingState={pipelineHook.indexingState}
              logEndRef={pipelineHook.logEndRef}
              formatBytes={formatBytes}
              getTimeEstimates={pipelineHook.getTimeEstimates}
              handleResumeOperation={pipelineHook.handleResumeOperation}
              handleCancelOperation={pipelineHook.handleCancelOperation}
              cloudName={projectsHook.projects.find((p: any) => String(p.id) === String(projectsHook.activeProjectId))?.cloud_provider === 'onedrive' ? 'OneDrive' : 'Google Drive'}
              isModalMinimized={pipelineHook.isModalMinimized}
              setIsModalMinimized={pipelineHook.setIsModalMinimized}
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
            />
          )}
        </div>
      </main>

      <MinimizedPipelineBanner
        operationModal={pipelineHook.operationModal}
        setOperationModal={pipelineHook.setOperationModal}
        isModalMinimized={pipelineHook.isModalMinimized}
        setIsModalMinimized={pipelineHook.setIsModalMinimized}
        activeTab={activeTab}
        pipelineStats={pipelineHook.pipelineStats}
        currentStep={pipelineHook.currentStep}
        setCurrentStep={pipelineHook.setCurrentStep}
        formatBytes={formatBytes}
        getTimeEstimates={pipelineHook.getTimeEstimates}
        indexingState={pipelineHook.indexingState}
        handleResumeOperation={pipelineHook.handleResumeOperation}
        handleCancelOperation={pipelineHook.handleCancelOperation}
      />
      <FullscreenAssignModal
        showAssignModal={calibrationHook.showAssignModal}
        setShowAssignModal={calibrationHook.setShowAssignModal}
        loadCalPapers={calibrationHook.loadCalPapers}
        loadPapers={papersHook.loadPapers}
        projects={projects}
        activeProjectId={activeProjectId}
        assignSearch={calibrationHook.assignSearch}
        setAssignSearch={calibrationHook.setAssignSearch}
        assignPoolFilter={calibrationHook.assignPoolFilter}
        setAssignPoolFilter={calibrationHook.setAssignPoolFilter}
        assignLoading={calibrationHook.assignLoading}
        assignPapers={calibrationHook.assignPapers}
        assignSelectedPaper={calibrationHook.assignSelectedPaper}
        setAssignSelectedPaper={calibrationHook.setAssignSelectedPaper}
        assignTotalPapers={calibrationHook.assignTotalPapers}
        assignPage={calibrationHook.assignPage}
        setAssignPage={calibrationHook.setAssignPage}
        assignTotalPages={calibrationHook.assignTotalPages}
        showToast={showToast}
        assignIsRunning={calibrationHook.assignIsRunning}
        assignLogs={calibrationHook.assignLogs}
        setAssignLogs={calibrationHook.setAssignLogs}
        assignProgress={calibrationHook.assignProgress}
        setAssignProgress={calibrationHook.setAssignProgress}
        assignStatusText={calibrationHook.assignStatusText}
        setAssignStatusText={calibrationHook.setAssignStatusText}
        activeAssignDropdown={calibrationHook.activeAssignDropdown}
        setActiveAssignDropdown={calibrationHook.setActiveAssignDropdown}
        handleAssignPool={calibrationHook.handleAssignPool}
        cloudName={projectsHook.projects.find((p: any) => String(p.id) === String(projectsHook.activeProjectId))?.cloud_provider === 'onedrive' ? 'OneDrive' : 'Google Drive'}
        runSinglePaperPipeline={calibrationHook.runSinglePaperPipeline}
        assignWaitingLogin={calibrationHook.assignWaitingLogin}
        setAssignWaitingLogin={calibrationHook.setAssignWaitingLogin}
        singlePipelineAbortControllerRef={calibrationHook.singlePipelineAbortControllerRef}
        logEndRef={pipelineHook.logEndRef}
      />
      <FullscreenInterRaterModal
        showInterRaterModal={showInterRaterModal}
        setShowInterRaterModal={setShowInterRaterModal}
        loadCalPapers={calibrationHook.loadCalPapers}
        loadPapers={papersHook.loadPapers}
        activeProjectId={activeProjectId}
        projects={projects}
        showToast={showToast}
        setCalActivePool={calibrationHook.setCalActivePool}
      />
      <GlobalModals
        deleteProjectConfirm={deleteProjectConfirm}
        setDeleteProjectConfirm={setDeleteProjectConfirm}
        loadProjects={loadProjects}
        paperModal={papersHook.paperModal}
        setPaperModal={papersHook.setPaperModal}
        hasLocalPdf={hasLocalPdf}
        deleteConfirm={papersHook.deleteConfirm}
        setDeleteConfirm={papersHook.setDeleteConfirm}
        deleteAllConfirm={papersHook.deleteAllConfirm}
        setDeleteAllConfirm={papersHook.setDeleteAllConfirm}
        loadPapers={papersHook.loadPapers}
        activeProject={activeProject}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        showToast={showToast}
        showDuplicateModal={showDuplicateModal}
        setShowDuplicateModal={setShowDuplicateModal}
      />
      <ToastNotifications toasts={toasts} setToasts={setToasts} />
    </div>
  );
}
