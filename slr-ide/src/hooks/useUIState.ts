import { useState } from 'react';
import { Paper } from '@/types';

export function useUIState() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [projectSubTab, setProjectSubTab] = useState<'overview' | 'ingest'>('overview');
  const [calibrationSubTab, setCalibrationSubTab] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');
  const [projectSettingsTab, setProjectSettingsTab] = useState<'metadata' | 'calibration' | 'sync'>('metadata');
  
  const [compressOnSync, setCompressOnSync] = useState(false);
  
  // Project Modals
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  
  // Project Connection & Deletion
  const [testingProjectConnection, setTestingProjectConnection] = useState(false);
  const [projectConnectionTestResult, setProjectConnectionTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ isOpen: boolean; projectId: string; projectName: string } | null>(null);
  const [deleteProjectConfirmationText, setDeleteProjectConfirmationText] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);
  
  // Paper Modals
  const [paperModal, setPaperModal] = useState<{ isOpen: boolean; mode: 'view' | 'edit'; paper: Paper | null }>({ isOpen: false, mode: 'view', paper: null });
  const [hasLocalPdf, setHasLocalPdf] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; paper: Paper | null }>({ isOpen: false, paper: null });
  const [deletingPaper, setDeletingPaper] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteAllConfirmationText, setDeleteAllConfirmationText] = useState('');
  
  // Inter-rater & Assignment Modals
  const [showInterRaterModal, setShowInterRaterModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSelectedPaper, setAssignSelectedPaper] = useState<Paper | null>(null);

  return {
    isSettingsOpen, setIsSettingsOpen,
    projectSubTab, setProjectSubTab,
    calibrationSubTab, setCalibrationSubTab,
    projectSettingsTab, setProjectSettingsTab,
    compressOnSync, setCompressOnSync,
    showCreateProjectModal, setShowCreateProjectModal,
    showEditProjectModal, setShowEditProjectModal,
    savingProject, setSavingProject,
    editingProjectId, setEditingProjectId,
    testingProjectConnection, setTestingProjectConnection,
    projectConnectionTestResult, setProjectConnectionTestResult,
    deleteProjectConfirm, setDeleteProjectConfirm,
    deleteProjectConfirmationText, setDeleteProjectConfirmationText,
    deletingProject, setDeletingProject,
    paperModal, setPaperModal,
    hasLocalPdf, setHasLocalPdf,
    deleteConfirm, setDeleteConfirm,
    deletingPaper, setDeletingPaper,
    deleteAllConfirm, setDeleteAllConfirm,
    deleteAllConfirmationText, setDeleteAllConfirmationText,
    showInterRaterModal, setShowInterRaterModal,
    showAssignModal, setShowAssignModal,
    assignSelectedPaper, setAssignSelectedPaper
  };
}
