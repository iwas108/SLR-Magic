import React from 'react';
import SettingsModal from '@/components/SettingsModal';
import AssignPapersModal from '@/components/features/AssignPapersModal';
import InterRaterModal from '@/components/features/InterRaterModal';
import DuplicateReviewModal from './DuplicateReviewModal';
import ViewEditPaperModal from './modals/ViewEditPaperModal';
import DeletePaperConfirmModal from './modals/DeletePaperConfirmModal';
import DeleteProjectConfirmModal from './modals/DeleteProjectConfirmModal';
import DeleteAllPapersConfirmModal from './modals/DeleteAllPapersConfirmModal';
import { useAppState } from '@/hooks/AppStateProvider';

export default function GlobalModals() {
  const allProps = useAppState();
  const {
    // Project Delete State
    deleteProjectConfirm, setDeleteProjectConfirm, loadProjects,
    
    // Paper State
    paperModal, setPaperModal, hasLocalPdf, deleteConfirm, setDeleteConfirm,
    deleteAllConfirm, setDeleteAllConfirm, loadPapers,
    
    // Project State
    activeProject,
    
    isSettingsOpen, setIsSettingsOpen, showToast
  } = allProps;

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
      <AssignPapersModal
        projects={allProps.projects}
        activeProjectId={allProps.activeProjectId}
        activeProject={allProps.activeProject}
        assignSearch={allProps.assignSearch}
        setAssignSearch={allProps.setAssignSearch}
        assignPoolFilter={allProps.assignPoolFilter}
        setAssignPoolFilter={allProps.setAssignPoolFilter}
        assignPapers={allProps.assignPapers}
        assignTotalPapers={allProps.assignTotalPapers}
        assignPage={allProps.assignPage}
        setAssignPage={allProps.setAssignPage}
        assignTotalPages={allProps.assignTotalPages}
        assignLoading={allProps.assignLoading}
        assignSelectedPaper={allProps.assignSelectedPaper}
        setAssignSelectedPaper={allProps.setAssignSelectedPaper}
        activeAssignDropdown={allProps.activeAssignDropdown}
        setActiveAssignDropdown={allProps.setActiveAssignDropdown}
        handleAssignPool={allProps.handleAssignPool}
        showAssignModal={allProps.showAssignModal}
        setShowAssignModal={allProps.setShowAssignModal}
        loadCalPapers={allProps.loadCalPapers}
        loadPapers={allProps.loadPapers}
        showToast={showToast}
        cloudName={allProps.cloudName}
        assignIsRunning={allProps.assignIsRunning}
        assignLogs={allProps.assignLogs}
        setAssignLogs={allProps.setAssignLogs}
        assignProgress={allProps.assignProgress}
        setAssignProgress={allProps.setAssignProgress}
        assignStatusText={allProps.assignStatusText}
        assignWaitingLogin={allProps.assignWaitingLogin}
        setAssignWaitingLogin={allProps.setAssignWaitingLogin}
        singlePipelineAbortControllerRef={allProps.singlePipelineAbortControllerRef}
        runSinglePaperPipeline={allProps.runSinglePaperPipeline}
      />
      <InterRaterModal allProps={allProps} />
      <DuplicateReviewModal 
        isOpen={allProps.showDuplicateModal} 
        onClose={() => allProps.setShowDuplicateModal(false)} 
        showToast={showToast}
        loadPapers={allProps.loadPapers}
      />
    </>
  );
}
