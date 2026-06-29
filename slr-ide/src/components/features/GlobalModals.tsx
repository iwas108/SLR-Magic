import React from 'react';
import SettingsModal from '@/components/SettingsModal';
import DuplicateReviewModal from './DuplicateReviewModal';
import ViewEditPaperModal from './modals/ViewEditPaperModal';
import DeletePaperConfirmModal from './modals/DeletePaperConfirmModal';
import DeleteProjectConfirmModal from './modals/DeleteProjectConfirmModal';
import DeleteAllPapersConfirmModal from './modals/DeleteAllPapersConfirmModal';
interface GlobalModalsProps {
  deleteProjectConfirm: any;
  setDeleteProjectConfirm: React.Dispatch<React.SetStateAction<any>>;
  loadProjects: () => Promise<any>;
  paperModal: any;
  setPaperModal: React.Dispatch<React.SetStateAction<any>>;
  hasLocalPdf: boolean;
  deleteConfirm: any;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<any>>;
  deleteAllConfirm: boolean;
  setDeleteAllConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  loadPapers: () => void;
  activeProject: any;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  showDuplicateModal: boolean;
  setShowDuplicateModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function GlobalModals({
  deleteProjectConfirm,
  setDeleteProjectConfirm,
  loadProjects,
  paperModal,
  setPaperModal,
  hasLocalPdf,
  deleteConfirm,
  setDeleteConfirm,
  deleteAllConfirm,
  setDeleteAllConfirm,
  loadPapers,
  activeProject,
  isSettingsOpen,
  setIsSettingsOpen,
  showToast,
  showDuplicateModal,
  setShowDuplicateModal
}: GlobalModalsProps) {

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
