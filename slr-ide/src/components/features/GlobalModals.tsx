import React from 'react';
import SettingsModal from '@/components/SettingsModal';
import DuplicateReviewModal from './DuplicateReviewModal';
import ViewEditPaperModal from './modals/ViewEditPaperModal';
import DeletePaperConfirmModal from './modals/DeletePaperConfirmModal';
import DeleteProjectConfirmModal from './modals/DeleteProjectConfirmModal';
import DeleteAllPapersConfirmModal from './modals/DeleteAllPapersConfirmModal';
interface GlobalModalsProps {
  projectsHook: {
    activeProject: any;
    loadProjects: () => Promise<any>;
  };
  papersHook: {
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
  setShowDuplicateModal
}: GlobalModalsProps) {
  const { activeProject, loadProjects } = projectsHook;
  const {
    paperModal,
    setPaperModal,
    deleteConfirm,
    setDeleteConfirm,
    deleteAllConfirm,
    setDeleteAllConfirm,
    loadPapers
  } = papersHook;

  const hasLocalPdf = !!(
    paperModal.isOpen &&
    paperModal.paper?.Local_PDF_Path &&
    ['MATCHED', 'DOWNLOADED', 'SYNCED'].includes(paperModal.paper?.Local_PDF_Status)
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

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        showToast={showToast}
      />
      <DuplicateReviewModal 
        isOpen={showDuplicateModal} 
        onClose={() => setShowDuplicateModal(false)} 
        showToast={showToast}
        loadPapers={loadPapers}
      />
    </>
  );
}
