import React from 'react';
import SettingsModal from '@/components/SettingsModal';
import DuplicateReviewModal from './DuplicateReviewModal';
import ViewEditPaperModal from './modals/ViewEditPaperModal';
import DeletePaperConfirmModal from './modals/DeletePaperConfirmModal';
import DeleteProjectConfirmModal from './modals/DeleteProjectConfirmModal';
import DeleteAllPapersConfirmModal from './modals/DeleteAllPapersConfirmModal';
import CreateProjectModal from './modals/CreateProjectModal';
import ProjectSettingsModal from './modals/ProjectSettingsModal';
import ArchiveProjectModal from './modals/ArchiveProjectModal';
import ImportProjectModal from './modals/ImportProjectModal';

interface GlobalModalsProps {
  projectsHook: {
    projects: any[];
    activeProjectId: string;
    activeProject: any;
    loadProjects: () => Promise<any>;
    createProject: (data: any) => Promise<boolean>;
    updateProject: (id: string, data: any) => Promise<boolean>;
    deleteProject: (id: string) => Promise<boolean>;
    archiveProject?: (id: string, options: any) => Promise<boolean>;
    importProject?: (archiveData: any, onSuccess?: (newId: string) => void) => Promise<boolean>;
    handleTestProjectConnection: (provider: string, remoteName: string) => void;
    testingProjectConnection: boolean;
    projectConnectionTestResult: any;
  };
  papersHook: {
    papers: any[];
    paperModal: any;
    setPaperModal: React.Dispatch<React.SetStateAction<any>>;
    deleteConfirm: any;
    setDeleteConfirm: React.Dispatch<React.SetStateAction<any>>;
    deleteAllConfirm: boolean;
    setDeleteAllConfirm: React.Dispatch<React.SetStateAction<boolean>>;
    loadPapers: () => void;
  };
  deleteProjectConfirm: any;
  setDeleteProjectConfirm: React.Dispatch<React.SetStateAction<any>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  showDuplicateModal: boolean;
  setShowDuplicateModal: React.Dispatch<React.SetStateAction<boolean>>;
  preSelectedPaperIds?: string[];
  initialSettingsTab?: 'rclone' | 'scraper';

  // Project Modals Lifted States
  showCreateProjectModal?: boolean;
  setShowCreateProjectModal?: React.Dispatch<React.SetStateAction<boolean>>;
  showEditProjectModal?: boolean;
  setShowEditProjectModal?: React.Dispatch<React.SetStateAction<boolean>>;
  editingProject?: any;
  projectSettingsInitialTab?: 'metadata' | 'calibration' | 'sync' | 'llm';
  savingProject?: boolean;
  showArchiveModal?: boolean;
  setShowArchiveModal?: React.Dispatch<React.SetStateAction<boolean>>;
  archivingProject?: any;
  setArchivingProject?: React.Dispatch<React.SetStateAction<any>>;
  showImportModal?: boolean;
  setShowImportModal?: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function GlobalModals({
  projectsHook,
  papersHook,
  deleteProjectConfirm,
  setDeleteProjectConfirm,
  isSettingsOpen,
  setIsSettingsOpen,
  showToast,
  showDuplicateModal,
  setShowDuplicateModal,
  preSelectedPaperIds,
  initialSettingsTab,
  showCreateProjectModal = false,
  setShowCreateProjectModal = () => {},
  showEditProjectModal = false,
  setShowEditProjectModal = () => {},
  editingProject = null,
  projectSettingsInitialTab = 'metadata',
  savingProject = false,
  showArchiveModal = false,
  setShowArchiveModal = () => {},
  archivingProject = null,
  setArchivingProject = () => {},
  showImportModal = false,
  setShowImportModal = () => {}
}: GlobalModalsProps) {
  const {
    projects,
    activeProject,
    loadProjects,
    createProject,
    updateProject,
    testingProjectConnection,
    projectConnectionTestResult,
    handleTestProjectConnection,
    archiveProject,
    importProject
  } = projectsHook;

  const {
    paperModal,
    setPaperModal,
    deleteConfirm,
    setDeleteConfirm,
    deleteAllConfirm,
    setDeleteAllConfirm,
    loadPapers,
    papers
  } = papersHook;

  const hasLocalPdf = !!(
    paperModal.isOpen &&
    paperModal.paper?.Local_PDF_Path &&
    ['MATCHED', 'DOWNLOADED', 'SYNCED', 'NEEDS_REVIEW'].includes(paperModal.paper?.Local_PDF_Status)
  );

  return (
    <>
      {/* Paper View / Edit Modal */}
      <ViewEditPaperModal
        paperModal={paperModal}
        setPaperModal={setPaperModal}
        hasLocalPdf={hasLocalPdf}
        activeProject={activeProject}
        showToast={showToast}
        loadPapers={loadPapers}
        loadProjects={loadProjects}
        setDeleteConfirm={setDeleteConfirm}
        papers={papers}
      />

      {/* Delete Paper Confirmation Modal */}
      <DeletePaperConfirmModal
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        paperModal={paperModal}
        setPaperModal={setPaperModal}
        loadPapers={loadPapers}
        showToast={showToast}
      />

      {/* Delete Project Confirmation Modal */}
      <DeleteProjectConfirmModal
        deleteProjectConfirm={deleteProjectConfirm}
        setDeleteProjectConfirm={setDeleteProjectConfirm}
        loadProjects={loadProjects}
        loadPapers={loadPapers}
        showToast={showToast}
      />

      {/* Delete All Papers Confirmation Modal */}
      <DeleteAllPapersConfirmModal
        deleteAllConfirm={deleteAllConfirm}
        setDeleteAllConfirm={setDeleteAllConfirm}
        loadPapers={loadPapers}
        loadProjects={loadProjects}
        showToast={showToast}
      />

      {/* Settings Modal (Global Tools & Credentials) */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        showToast={showToast}
        activeProject={projectsHook.activeProject}
        preSelectedPaperIds={preSelectedPaperIds}
        initialTab={initialSettingsTab}
      />

      {/* Duplicate Review Modal */}
      <DuplicateReviewModal 
        isOpen={showDuplicateModal} 
        onClose={() => setShowDuplicateModal(false)} 
        showToast={showToast}
        loadPapers={loadPapers}
      />

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <CreateProjectModal
          isOpen={showCreateProjectModal}
          onClose={() => setShowCreateProjectModal(false)}
          onCreateProject={createProject}
          savingProject={savingProject}
        />
      )}

      {/* Project Settings Modal */}
      {showEditProjectModal && editingProject && (
        <ProjectSettingsModal
          isOpen={showEditProjectModal}
          onClose={() => setShowEditProjectModal(false)}
          projects={projects}
          project={editingProject}
          loadProjects={loadProjects}
          showToast={showToast}
          onSaveProject={updateProject}
          savingProject={savingProject}
          testingProjectConnection={testingProjectConnection}
          projectConnectionTestResult={projectConnectionTestResult}
          handleTestProjectConnection={handleTestProjectConnection}
          initialTab={projectSettingsInitialTab}
        />
      )}

      {/* Archive Project Modal */}
      {showArchiveModal && archivingProject && archiveProject && (
        <ArchiveProjectModal
          isOpen={showArchiveModal}
          project={archivingProject}
          onClose={() => {
            setShowArchiveModal(false);
            setArchivingProject(null);
          }}
          onArchive={archiveProject}
        />
      )}

      {/* Import Project Modal */}
      {showImportModal && importProject && (
        <ImportProjectModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={importProject}
        />
      )}
    </>
  );
}
