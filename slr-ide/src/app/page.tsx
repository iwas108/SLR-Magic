'use client';
import DashboardView from '../components/features/DashboardView';
import PreCalibrationView from '../components/features/PreCalibrationView';
import IngestionHubView from '../components/features/IngestionHubView';
import PaperDatabaseView from '../components/features/PaperDatabaseView';
import PipelineExecutionView from '../components/features/PipelineExecutionView';
import { AppStateProvider } from '@/hooks/AppStateProvider';
import { useAppSync } from '@/hooks/useAppSync';


import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import GlobalModals from '../components/features/GlobalModals';
import InterRaterDashboard from '@/components/InterRaterDashboard';
import { 
  Upload, Search, FileText, Check, AlertCircle, RefreshCw, X, Play, 
  Download, FileSpreadsheet, Layers, Sparkles, AlertTriangle, ExternalLink, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Edit2, ChevronLeft, ChevronRight,
  Minus, Maximize2, LayoutDashboard, Plus, Edit, Folder, Calendar, CheckCircle2,
  TrendingUp, BarChart3, Cloud, Database, ShieldAlert, Terminal, ArrowRightLeft,
  Lock, Unlock, Loader2, Settings
} from 'lucide-react';
import { broadcastSync } from '@/lib/sync-utils';

// Types
interface Paper {
  Paper_ID: string;
  Import_Date: string;
  Import_Source: string;
  Source: string;
  DOI: string;
  Title: string;
  Abstract: string;
  Authors: string;
  Year: number | null;
  PDF_Link: string;
  Status: string;
  Local_PDF_Status: string;
  Local_PDF_Path: string | null;
  calibration_pool?: string | null;
  calibration_tag?: string | null;
  Human_Decision?: string | null;
  Human_EC_Trigger?: string | null;
  Human_Rationale?: string | null;
  Parent_Paper_ID?: string | null;
  Parent_Paper_Title?: string | null;
}

export default function DashboardPage() {
  useAppSync({
    loadProjects: () => loadProjects(),
    loadPapers: () => loadPapers(),
    loadCalPapers: () => loadCalPapers(),
    loadAssignPapers: () => loadAssignPapers(),
    loadDuplicatesCount: () => loadDuplicatesCount()
  });

  const formatBytes = (bytes: number, decimals: number = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  
  // Projects state
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('default-project');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const activeProject = projects.find(p => String(p.id) === String(activeProjectId));
  const cloudProvider = activeProject?.cloud_provider || 'gdrive';
  const cloudName = cloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive';
  const [projectSubTab, setProjectSubTab] = useState<'overview' | 'ingest'>('overview');
  const [compressOnSync, setCompressOnSync] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [savingProject, setSavingProject] = useState(false);

  // Edit project modal state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectSettingsTab, setProjectSettingsTab] = useState<'metadata' | 'calibration' | 'sync'>('metadata');
  const [testingProjectConnection, setTestingProjectConnection] = useState(false);
  const [projectConnectionTestResult, setProjectConnectionTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [calibrationSubTab, setCalibrationSubTab] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');

  // Manifesto edit form states
  const [projectFormName, setProjectFormName] = useState('');
  const [projectFormManifesto, setProjectFormManifesto] = useState('');
  const [projectFormObjective, setProjectFormObjective] = useState('');
  const [projectFormQuestions, setProjectFormQuestions] = useState('');
  const [projectFormQaDefinition, setProjectFormQaDefinition] = useState('');
  const [projectFormExclusionCriteria, setProjectFormExclusionCriteria] = useState('');
  const [projectFormPoolA, setProjectFormPoolA] = useState('50');
  const [projectFormPoolB, setProjectFormPoolB] = useState('30');
  const [projectFormPoolC, setProjectFormPoolC] = useState('20');
  const [projectFormGDriveDest, setProjectFormGDriveDest] = useState('SLR_Magic/PDFs');
  const [projectFormCloudProvider, setProjectFormCloudProvider] = useState('gdrive');
  const [projectFormRemoteName, setProjectFormRemoteName] = useState('');
  const [projectFormPoolTags, setProjectFormPoolTags] = useState<{
    pool_a: { code: string; label: string }[];
    pool_b: { code: string; label: string }[];
    pool_c: { code: string; label: string }[];
  }>({ pool_a: [], pool_b: [], pool_c: [] });
  const [projectFormEcRules, setProjectFormEcRules] = useState<{ code: string; description: string }[]>([]);
  const [projectFormReasoningTemplate, setProjectFormReasoningTemplate] = useState<string[]>([]);

  // New project modal states
  const [newProjName, setNewProjName] = useState('');
  const [newProjFolder, setNewProjFolder] = useState('');
  const [newProjManifesto, setNewProjManifesto] = useState('');
  const [newProjObjective, setNewProjObjective] = useState('');
  const [newProjQuestions, setNewProjQuestions] = useState('');
  const [newProjQaDefinition, setNewProjQaDefinition] = useState('');
  const [newProjExclusionCriteria, setNewProjExclusionCriteria] = useState('');
  const [newProjPoolA, setNewProjPoolA] = useState('50');
  const [newProjPoolB, setNewProjPoolB] = useState('30');
  const [newProjPoolC, setNewProjPoolC] = useState('20');
  const [newProjGDriveDest, setNewProjGDriveDest] = useState('SLR_Magic/PDFs');
  const [newProjCloudProvider, setNewProjCloudProvider] = useState('gdrive');
  const [newProjRemoteName, setNewProjRemoteName] = useState('');
  const [newProjPoolTags, setNewProjPoolTags] = useState<{
    pool_a: { code: string; label: string }[];
    pool_b: { code: string; label: string }[];
    pool_c: { code: string; label: string }[];
  }>({ pool_a: [], pool_b: [], pool_c: [] });

  // Project deletion state
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ isOpen: boolean; projectId: string; projectName: string } | null>(null);
  const [deleteProjectConfirmationText, setDeleteProjectConfirmationText] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);

  // CSV Ingestion states
  const [csvSource, setCsvSource] = useState('Scopus');
  const [csvImportDate, setCsvImportDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Manual Ingestion states
  const [manualSource, setManualSource] = useState('Backward Snowball');
  const [manualImportDate, setManualImportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualYear, setManualYear] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthors, setManualAuthors] = useState('');
  const [manualDoi, setManualDoi] = useState('');
  const [manualAbstract, setManualAbstract] = useState('');
  const [manualIngesting, setManualIngesting] = useState(false);
  const [manualParentPaperId, setManualParentPaperId] = useState('');
  const [manualParentSearch, setManualParentSearch] = useState('');
  const [parentPaperSuggestions, setParentPaperSuggestions] = useState<Paper[]>([]);
  const [showParentSuggestions, setShowParentSuggestions] = useState(false);
  const [selectedParentPaper, setSelectedParentPaper] = useState<Paper | null>(null);

  // Load projects from API
  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const projs = data.projects || [];
        setProjects(projs);
        const activeId = data.activeProjectId || 'default-project';
        setActiveProjectId(activeId);
        
        // Find and populate active project form fields
        const active = projs.find((p: any) => p.id === activeId);
        if (active) {
          setProjectFormName(active.name || '');
          setProjectFormManifesto(active.manifesto || '');
          setProjectFormObjective(active.objective || '');
          setProjectFormQuestions(active.questions || '');
          setProjectFormQaDefinition(active.qa_definition || '');
          setProjectFormExclusionCriteria(active.exclusion_criteria || '');
          setProjectFormPoolA(active.pool_a_size !== undefined ? String(active.pool_a_size) : '50');
          setProjectFormPoolB(active.pool_b_size !== undefined ? String(active.pool_b_size) : '30');
          setProjectFormPoolC(active.pool_c_size !== undefined ? String(active.pool_c_size) : '20');
          setProjectFormGDriveDest(active.gdrive_dest_path || 'SLR_Magic/PDFs');
          setProjectFormCloudProvider(active.cloud_provider || 'gdrive');
          setProjectFormRemoteName(active.rclone_remote_name || '');
          let parsedTags = { pool_a: [] as any[], pool_b: [] as any[], pool_c: [] as any[] };
          if (active.pool_tags) {
            try {
              parsedTags = typeof active.pool_tags === 'string' ? JSON.parse(active.pool_tags) : active.pool_tags;
            } catch (e) {
              console.error("Error parsing pool tags", e);
            }
          }
          parsedTags.pool_a = parsedTags.pool_a || [];
          parsedTags.pool_b = parsedTags.pool_b || [];
          parsedTags.pool_c = parsedTags.pool_c || [];
          setProjectFormPoolTags(parsedTags);

          let parsedRules = [];
          if (active.ec_rules) {
            try {
              parsedRules = typeof active.ec_rules === 'string' ? JSON.parse(active.ec_rules) : active.ec_rules;
            } catch (e) {
              console.error("Error parsing ec rules", e);
            }
          }
          setProjectFormEcRules(parsedRules || []);

          let parsedReasoning = [];
          if (active.reasoning_template) {
            try {
              parsedReasoning = typeof active.reasoning_template === 'string' ? JSON.parse(active.reasoning_template) : active.reasoning_template;
            } catch (e) {
              console.error("Error parsing reasoning template", e);
            }
          }
          setProjectFormReasoningTemplate(parsedReasoning || []);
        }
      } else {
        showToast('Failed to load projects list', 'error');
      }
    } catch (err: any) {
      showToast(`Error loading projects: ${err.message || err}`, 'error');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Switch active project
  const activateProject = async (id: string) => {
    try {
      const res = await fetch('/api/projects/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        showToast('Project switched successfully!', 'success');
        setActiveProjectId(id);
        await loadProjects();
        loadPapers();
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to switch active project', 'error');
      }
    } catch (err: any) {
      showToast(`Error switching active project: ${err.message || err}`, 'error');
    }
  };

  // Create project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) {
      showToast('Project name is mandatory', 'error');
      return;
    }
    if (!newProjFolder.trim()) {
      showToast('Folder name is mandatory', 'error');
      return;
    }

    setSavingProject(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjName,
          folder_name: newProjFolder,
          manifesto: newProjManifesto,
          objective: newProjObjective,
          questions: newProjQuestions,
          qa_definition: newProjQaDefinition,
          exclusion_criteria: newProjExclusionCriteria,
          pool_a_size: newProjPoolA,
          pool_b_size: newProjPoolB,
          pool_c_size: newProjPoolC,
          gdrive_dest_path: newProjGDriveDest,
          cloud_provider: newProjCloudProvider,
          rclone_remote_name: newProjRemoteName,
          pool_tags: newProjPoolTags
        })
      });

      if (res.ok) {
        const data = await res.json();
        showToast('Project created successfully!', 'success');
        setShowCreateProjectModal(false);
        // Reset states
        setNewProjName('');
        setNewProjFolder('');
        setNewProjManifesto('');
        setNewProjObjective('');
        setNewProjQuestions('');
        setNewProjQaDefinition('');
        setNewProjExclusionCriteria('');
        setNewProjPoolA('50');
        setNewProjPoolB('30');
        setNewProjPoolC('20');
        setNewProjGDriveDest('SLR_Magic/PDFs');
        setNewProjCloudProvider('gdrive');
        setNewProjRemoteName('');
        
        // Load and activate new project
        await loadProjects();
        if (data.project && data.project.id) {
          await activateProject(data.project.id);
        }
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to create project', 'error');
      }
    } catch (err: any) {
      showToast(`Error creating project: ${err.message || err}`, 'error');
    } finally {
      setSavingProject(false);
    }
  };

  // Open project configuration settings modal
  const openProjectSettings = (proj: any) => {
    setEditingProjectId(proj.id);
    setProjectFormName(proj.name || '');
    setProjectFormManifesto(proj.manifesto || '');
    setProjectFormObjective(proj.objective || '');
    setProjectFormQuestions(proj.questions || '');
    setProjectFormQaDefinition(proj.qa_definition || '');
    setProjectFormExclusionCriteria(proj.exclusion_criteria || '');
    setProjectFormPoolA(proj.pool_a_size !== undefined ? String(proj.pool_a_size) : '50');
    setProjectFormPoolB(proj.pool_b_size !== undefined ? String(proj.pool_b_size) : '30');
    setProjectFormPoolC(proj.pool_c_size !== undefined ? String(proj.pool_c_size) : '20');
    setProjectFormGDriveDest(proj.gdrive_dest_path || 'SLR_Magic/PDFs');
    setProjectFormCloudProvider(proj.cloud_provider || 'gdrive');
    setProjectFormRemoteName(proj.rclone_remote_name || '');
    let parsedTags = { pool_a: [] as any[], pool_b: [] as any[], pool_c: [] as any[] };
    if (proj.pool_tags) {
      try {
        parsedTags = typeof proj.pool_tags === 'string' ? JSON.parse(proj.pool_tags) : proj.pool_tags;
      } catch (e) {
        console.error("Error parsing pool tags", e);
      }
    }
    parsedTags.pool_a = parsedTags.pool_a || [];
    parsedTags.pool_b = parsedTags.pool_b || [];
    parsedTags.pool_c = parsedTags.pool_c || [];
    setProjectFormPoolTags(parsedTags);

    let parsedRules = [];
    if (proj.ec_rules) {
      try {
        parsedRules = typeof proj.ec_rules === 'string' ? JSON.parse(proj.ec_rules) : proj.ec_rules;
      } catch (e) {
        console.error("Error parsing ec rules", e);
      }
    }
    setProjectFormEcRules(parsedRules || []);

    let parsedReasoning = [];
    if (proj.reasoning_template) {
      try {
        parsedReasoning = typeof proj.reasoning_template === 'string' ? JSON.parse(proj.reasoning_template) : proj.reasoning_template;
      } catch (e) {
        console.error("Error parsing reasoning template", e);
      }
    }
    setProjectFormReasoningTemplate(parsedReasoning || []);

    setProjectSettingsTab('metadata');
    setProjectConnectionTestResult(null);
    setTestingProjectConnection(false);
    setShowEditProjectModal(true);
  };

  // Test Rclone cloud connection for project Settings
  const handleTestProjectConnection = async () => {
    setTestingProjectConnection(true);
    setProjectConnectionTestResult(null);
    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_provider: projectFormCloudProvider,
          rclone_remote_name: projectFormRemoteName || (projectFormCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive')
        })
      });
      const data = await res.json();
      setProjectConnectionTestResult({
        success: data.success,
        message: data.message,
        details: data.details
      });
    } catch (err: any) {
      setProjectConnectionTestResult({
        success: false,
        message: 'Network error occurred while testing connection.',
        details: err.message
      });
    } finally {
      setTestingProjectConnection(false);
    }
  };

  // Pool tags helpers for editing project
  const handleAddPoolTag = (pool: 'pool_a' | 'pool_b' | 'pool_c') => {
    setProjectFormPoolTags(prev => ({
      ...prev,
      [pool]: [...(prev[pool] || []), { code: '', label: '' }]
    }));
  };

  const handleUpdatePoolTag = (pool: 'pool_a' | 'pool_b' | 'pool_c', index: number, field: 'code' | 'label', value: string) => {
    setProjectFormPoolTags(prev => {
      const updated = [...(prev[pool] || [])];
      updated[index] = { ...updated[index], [field]: value };
      return {
        ...prev,
        [pool]: updated
      };
    });
  };

  const handleRemovePoolTag = (pool: 'pool_a' | 'pool_b' | 'pool_c', index: number) => {
    setProjectFormPoolTags(prev => {
      const updated = (prev[pool] || []).filter((_, i) => i !== index);
      return {
        ...prev,
        [pool]: updated
      };
    });
  };

  // Inter-rater blinded review config helpers
  const handleAddEcRule = () => {
    setProjectFormEcRules(prev => [...prev, { code: '', description: '' }]);
  };

  const handleUpdateEcRule = (index: number, field: 'code' | 'description', value: string) => {
    setProjectFormEcRules(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveEcRule = (index: number) => {
    setProjectFormEcRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddReasoningTemplate = () => {
    setProjectFormReasoningTemplate(prev => [...prev, '']);
  };

  const handleUpdateReasoningTemplate = (index: number, value: string) => {
    setProjectFormReasoningTemplate(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleRemoveReasoningTemplate = (index: number) => {
    setProjectFormReasoningTemplate(prev => prev.filter((_, i) => i !== index));
  };

  // Pool tags helpers for new project
  const handleAddNewProjPoolTag = (pool: 'pool_a' | 'pool_b' | 'pool_c') => {
    setNewProjPoolTags(prev => ({
      ...prev,
      [pool]: [...(prev[pool] || []), { code: '', label: '' }]
    }));
  };

  const handleUpdateNewProjPoolTag = (pool: 'pool_a' | 'pool_b' | 'pool_c', index: number, field: 'code' | 'label', value: string) => {
    setNewProjPoolTags(prev => {
      const updated = [...(prev[pool] || [])];
      updated[index] = { ...updated[index], [field]: value };
      return {
        ...prev,
        [pool]: updated
      };
    });
  };

  const handleRemoveNewProjPoolTag = (pool: 'pool_a' | 'pool_b' | 'pool_c', index: number) => {
    setNewProjPoolTags(prev => {
      const updated = (prev[pool] || []).filter((_, i) => i !== index);
      return {
        ...prev,
        [pool]: updated
      };
    });
  };

  // Helper to get active project's pool tags
  const getActiveProjectPoolTags = (poolId: string): { code: string; label: string }[] => {
    const activeProj = projects.find(p => String(p.id) === String(activeProjectId));
    if (!activeProj || !activeProj.pool_tags) return [];
    try {
      const parsed = typeof activeProj.pool_tags === 'string' ? JSON.parse(activeProj.pool_tags) : activeProj.pool_tags;
      return parsed[poolId] || [];
    } catch (e) {
      return [];
    }
  };

  const handleSaveProjectManifesto = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = editingProjectId || activeProjectId;
    setSavingProject(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetId,
          name: projectFormName,
          manifesto: projectFormManifesto,
          objective: projectFormObjective,
          questions: projectFormQuestions,
          qa_definition: projectFormQaDefinition,
          exclusion_criteria: projectFormExclusionCriteria,
          pool_a_size: projectFormPoolA,
          pool_b_size: projectFormPoolB,
          pool_c_size: projectFormPoolC,
          gdrive_dest_path: projectFormGDriveDest,
          cloud_provider: projectFormCloudProvider,
          rclone_remote_name: projectFormRemoteName,
          pool_tags: projectFormPoolTags,
          ec_rules: projectFormEcRules,
          reasoning_template: projectFormReasoningTemplate
        })
      });

      if (res.ok) {
        showToast('Project configuration updated successfully', 'success');
        setShowEditProjectModal(false);
        await loadProjects();
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update configuration', 'error');
      }
    } catch (err: any) {
      showToast(`Error updating configuration: ${err.message || err}`, 'error');
    } finally {
      setSavingProject(false);
    }
  };

  // Execute manual ingestion (snowballing)
  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      showToast('Paper title is mandatory', 'error');
      return;
    }

    setManualIngesting(true);
    try {
      const parsedYear = parseInt(manualYear, 10);
      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papers: [{
            Title: manualTitle.trim(),
            Authors: manualAuthors.trim(),
            Year: !isNaN(parsedYear) ? parsedYear : null,
            DOI: manualDoi.trim(),
            Abstract: manualAbstract.trim(),
            Source: manualSource.trim(),
            Import_Source: manualSource.trim(),
            Import_Date: manualImportDate,
            Parent_Paper_ID: manualParentPaperId || null
          }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.imported > 0) {
          showToast('Paper ingested successfully!', 'success');
          // Clear inputs
          setManualTitle('');
          setManualAuthors('');
          setManualYear('');
          setManualDoi('');
          setManualAbstract('');
          setManualParentPaperId('');
          setManualParentSearch('');
          setSelectedParentPaper(null);
          setParentPaperSuggestions([]);
          loadPapers();
          broadcastSync('SYNC_PAPERS');
        } else {
          showToast('Paper was skipped (likely a duplicate by Title/DOI)', 'warning');
        }
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to ingest paper', 'error');
      }
    } catch (err: any) {
      showToast(`Error ingesting paper: ${err.message || err}`, 'error');
    } finally {
      setManualIngesting(false);
    }
  };

  const [theme, setTheme] = useState('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Paper state
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pdfFilter, setPdfFilter] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPapers, setTotalPapers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Sorting state
  const [sortBy, setSortBy] = useState('Paper_ID');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // View / Edit / Delete Modals
  const [paperModal, setPaperModal] = useState<{ isOpen: boolean; mode: 'view' | 'edit'; paper: Paper | null }>({
    isOpen: false,
    mode: 'view',
    paper: null
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; paper: Paper | null }>({
    isOpen: false,
    paper: null
  });
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteAllConfirmationText, setDeleteAllConfirmationText] = useState('');

  // Paper hashes for full-DB duplicate checking in Import Preview
  const [existingHashes, setExistingHashes] = useState<{ DOI: string; Title: string }[]>([]);

  // Form states for View/Edit Modal
  const [savingPaper, setSavingPaper] = useState(false);
  const [deletingPaper, setDeletingPaper] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthors, setEditAuthors] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editDoi, setEditDoi] = useState('');
  const [editAbstract, setEditAbstract] = useState('');
  const [editPdfLink, setEditPdfLink] = useState('');
  const [editPdfStatus, setEditPdfStatus] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editCalPool, setEditCalPool] = useState('');
  const [editCalTag, setEditCalTag] = useState('');
  const [editParentPaperId, setEditParentPaperId] = useState('');
  const [editParentSearch, setEditParentSearch] = useState('');
  const [editParentSuggestions, setEditParentSuggestions] = useState<Paper[]>([]);
  const [showEditParentSuggestions, setShowEditParentSuggestions] = useState(false);
  const [selectedEditParentPaper, setSelectedEditParentPaper] = useState<Paper | null>(null);

  // Import wizard state
  const [showImport, setShowImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewPapers, setPreviewPapers] = useState<any[]>([]);
  const [previewStats, setPreviewStats] = useState({ total: 0, newCount: 0, dupCount: 0 });
  const [importing, setImporting] = useState(false);

  // Pre-Calibration States
  const [calActivePool, setCalActivePool] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');
  const [calStats, setCalStats] = useState({ TP: 0, TN: 0, FP: 0, FN: 0, agreementRate: 0, kappa: 'N/A', reviewedCount: 0 });
  const [calPapers, setCalPapers] = useState<Paper[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calSearchTerm, setCalSearchTerm] = useState('');
  const [calStatusFilter, setCalStatusFilter] = useState('');
  const [calPdfFilter, setCalPdfFilter] = useState('');
  const [calTagFilter, setCalTagFilter] = useState('');
  const [calPage, setCalPage] = useState(1);
  const [calLimit, setCalLimit] = useState(50);
  const [calTotalPapers, setCalTotalPapers] = useState(0);
  const [calTotalPages, setCalTotalPages] = useState(1);
  const [calSortBy, setCalSortBy] = useState('Paper_ID');
  const [calSortOrder, setCalSortOrder] = useState<'asc' | 'desc'>('asc');

  // Assign Papers modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showInterRaterModal, setShowInterRaterModal] = useState(false);
  const [activeAssignDropdown, setActiveAssignDropdown] = useState<{ paperId: string; poolId: string } | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignPoolFilter, setAssignPoolFilter] = useState('all');
  const [assignPapers, setAssignPapers] = useState<Paper[]>([]);
  const [assignSelectedPaper, setAssignSelectedPaper] = useState<Paper | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignPage, setAssignPage] = useState(1);
  const [assignLimit, setAssignLimit] = useState(25);
  const [assignTotalPapers, setAssignTotalPapers] = useState(0);
  const [assignTotalPages, setAssignTotalPages] = useState(1);
  const [assignLogs, setAssignLogs] = useState<string[]>([]);
  const [assignIsRunning, setAssignIsRunning] = useState(false);
  const [assignStatusText, setAssignStatusText] = useState('');
  const [assignProgress, setAssignProgress] = useState(0);
  const [assignWaitingLogin, setAssignWaitingLogin] = useState(false);

  // Batch Execution steps selection state
  const [batchSteps, setBatchSteps] = useState<Record<string, boolean>>({
    duplicate_scan: true,
    scan: true,
    scrape: true,
    map_publisher: true,
    sync: true
  });

  // Scraper/Sync operation states
  const [operationModal, setOperationModal] = useState<{
    isOpen: boolean;
    type: 'scan' | 'scrape' | 'sync' | null;
    title: string;
    progress: number;
    statusText: string;
    logs: string[];
    currentItem?: string;
    isExecuting?: boolean;
    isWaitingLogin?: boolean;
  }>({
    isOpen: false,
    type: null,
    title: '',
    progress: 0,
    statusText: '',
    logs: [],
    isExecuting: false,
    isWaitingLogin: false
  });

  const [isModalMinimized, setIsModalMinimized] = useState(false);
  const [currentStep, setCurrentStep] = useState<'scan' | 'duplicate_scan' | 'scrape' | 'compress' | 'sync' | 'map_publisher' | null>(null);
  const [pipelineStats, setPipelineStats] = useState({
    matched: 0,
    downloaded: 0,
    failed: 0,
    current: 0,
    total: 0,
    savedSpaceBytes: 0,
    originalSpaceBytes: 0
  });

  const [stepStartTime, setStepStartTime] = useState<number | null>(null);
  const [timeTicker, setTimeTicker] = useState(0);
  const [indexingState, setIndexingState] = useState<{
    filename: string;
    tool: string;
    current: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (operationModal.isExecuting) {
      interval = setInterval(() => {
        setTimeTicker(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [operationModal.isExecuting]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Sorting helpers
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1); // Reset page on sort change
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-primary shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary shrink-0" />
    );
  };

  const handleCalSort = (field: string) => {
    if (calSortBy === field) {
      setCalSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCalSortBy(field);
      setCalSortOrder('asc');
    }
    setCalPage(1);
  };

  const renderCalSortIcon = (field: string) => {
    if (calSortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 shrink-0" />;
    }
    return calSortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-primary shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary shrink-0" />
    );
  };

  // Handle themes
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    applyTheme(savedTheme);
    loadProjects();
  }, []);

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

  // Populate form fields when paper modal state changes
  useEffect(() => {
    if (paperModal.isOpen && paperModal.paper) {
      setEditTitle(paperModal.paper.Title || '');
      setEditAuthors(paperModal.paper.Authors || '');
      setEditYear(paperModal.paper.Year !== null ? String(paperModal.paper.Year) : '');
      setEditDoi(paperModal.paper.DOI || '');
      setEditAbstract(paperModal.paper.Abstract || '');
      setEditPdfLink(paperModal.paper.PDF_Link || '');
      setEditPdfStatus(paperModal.paper.Local_PDF_Status || 'MISSING');
      setEditStatus(paperModal.paper.Status || 'PENDING');
      setEditCalPool(paperModal.paper.calibration_pool || '');
      setEditCalTag(paperModal.paper.calibration_tag || '');
      
      const parentId = paperModal.paper.Parent_Paper_ID || '';
      const parentTitle = paperModal.paper.Parent_Paper_Title || '';
      setEditParentPaperId(parentId);
      setSelectedEditParentPaper(parentId ? { Paper_ID: parentId, Title: parentTitle } as any : null);
      setEditParentSearch('');
    }
  }, [paperModal.isOpen, paperModal.paper, paperModal.mode]);

  // Fetch suggestions when manualParentSearch changes
  useEffect(() => {
    if (!manualParentSearch.trim()) {
      setParentPaperSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/papers?search=${encodeURIComponent(manualParentSearch)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setParentPaperSuggestions(data.papers || []);
        }
      } catch (err) {
        console.error('Error fetching parent paper suggestions:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [manualParentSearch]);

  // Fetch suggestions when editParentSearch changes
  useEffect(() => {
    if (!editParentSearch.trim()) {
      setEditParentSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/papers?search=${encodeURIComponent(editParentSearch)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          const currentId = paperModal.paper?.Paper_ID;
          const filtered = (data.papers || []).filter((p: Paper) => p.Paper_ID !== currentId);
          setEditParentSuggestions(filtered);
        }
      } catch (err) {
        console.error('Error fetching edit parent paper suggestions:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [editParentSearch, paperModal.paper]);

  const handleSavePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperModal.paper) return;
    if (!editTitle.trim()) {
      showToast('Title is mandatory', 'error');
      return;
    }

    setSavingPaper(true);
    try {
      const res = await fetch(`/api/papers/${paperModal.paper.Paper_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Title: editTitle,
          Authors: editAuthors,
          Year: editYear,
          DOI: editDoi,
          Abstract: editAbstract,
          PDF_Link: editPdfLink,
          Local_PDF_Status: editPdfStatus,
          Status: editStatus,
          Parent_Paper_ID: editParentPaperId || null,
          calibration_pool: editCalPool || null,
          calibration_tag: editCalTag || null
        })
      });

      if (res.ok) {
        showToast('Paper details updated successfully', 'success');
        setPaperModal({ isOpen: false, mode: 'view', paper: null });
        loadPapers();
        loadCalPapers();
        loadProjects();
        broadcastSync('SYNC_PAPERS');
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to update paper details', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update paper details', 'error');
    } finally {
      setSavingPaper(false);
    }
  };

  const handleDeletePaper = async () => {
    if (!deleteConfirm.paper) return;
    setDeletingPaper(true);
    try {
      const res = await fetch(`/api/papers/${deleteConfirm.paper.Paper_ID}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        showToast('Paper deleted successfully', 'success');
        setDeleteConfirm({ isOpen: false, paper: null });
        if (paperModal.isOpen && paperModal.paper?.Paper_ID === deleteConfirm.paper.Paper_ID) {
          setPaperModal({ isOpen: false, mode: 'view', paper: null });
        }
        loadPapers();
        broadcastSync('SYNC_PAPERS');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to delete paper', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete paper', 'error');
    } finally {
      setDeletingPaper(false);
    }
  };

  const handleDeleteAllPapers = async () => {
    if (deleteAllConfirmationText !== 'DELETE ALL') return;
    try {
      const res = await fetch('/api/papers?confirm=DELETE_ALL', {
        method: 'DELETE'
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'All papers deleted successfully', 'success');
        setDeleteAllConfirm(false);
        setDeleteAllConfirmationText('');
        loadPapers();
        loadProjects(); // Reload projects stats
        broadcastSync('SYNC_PAPERS');
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to delete all papers', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete all papers', 'error');
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectConfirm) return;
    if (deleteProjectConfirmationText !== 'DELETE PROJECT') return;
    
    setDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${deleteProjectConfirm.projectId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Project deleted successfully', 'success');
        setDeleteProjectConfirm(null);
        setDeleteProjectConfirmationText('');
        await loadProjects();
        loadPapers();
        broadcastSync('SYNC_PROJECTS');
        broadcastSync('SYNC_PAPERS');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to delete project', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete project', 'error');
    } finally {
      setDeletingProject(false);
    }
  };

  // Fetch hashes when showImport becomes true
  useEffect(() => {
    if (showImport) {
      const loadHashes = async () => {
        try {
          const res = await fetch('/api/papers?onlyHashes=true');
          if (res.ok) {
            const data = await res.json();
            setExistingHashes(data);
          }
        } catch (err) {
          console.error('Error loading paper hashes for duplicate check:', err);
        }
      };
      loadHashes();
    } else {
      setExistingHashes([]);
    }
  }, [showImport]);

  // Fetch papers
  const loadPapers = async () => {
    setLoadingPapers(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (pdfFilter) params.append('pdfStatus', pdfFilter);
      
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await fetch(`/api/papers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPapers(data.papers || []);
        setTotalPapers(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
      await loadDuplicatesCount();
    } catch (err) {
      console.error('Error fetching papers:', err);
    } finally {
      setLoadingPapers(false);
    }
  };

  const loadDuplicatesCount = async () => {
    try {
      const res = await fetch('/api/duplicates');
      if (res.ok) {
        const data = await res.json();
        setDuplicatesCount(data.count || 0);
      }
    } catch (err) {
      console.error('Error loading duplicates count:', err);
    }
  };

  // Trigger paper load
  useEffect(() => {
    loadPapers();
  }, [searchTerm, statusFilter, pdfFilter, sortBy, sortOrder, page, limit]);

  // Reset page to 1 when filters or search terms change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, pdfFilter]);

  // Fetch calibration papers
  const loadCalPapers = async () => {
    setCalLoading(true);
    try {
      const params = new URLSearchParams();
      if (calSearchTerm) params.append('search', calSearchTerm);
      if (calStatusFilter) params.append('status', calStatusFilter);
      if (calPdfFilter) params.append('pdfStatus', calPdfFilter);
      if (calTagFilter) params.append('calibrationTag', calTagFilter);
      params.append('calibrationPool', calActivePool);
      
      params.append('sortBy', calSortBy);
      params.append('sortOrder', calSortOrder);
      params.append('page', String(calPage));
      params.append('limit', String(calLimit));

      const res = await fetch(`/api/papers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCalPapers(data.papers || []);
        setCalTotalPapers(data.total || 0);
        setCalTotalPages(data.totalPages || 1);
      }

      // Removed old calStats Kappa logic
    } catch (err) {
      console.error('Error fetching calibration papers:', err);
    } finally {
      setCalLoading(false);
    }
  };

  // Fetch papers for pool assignment
  const loadAssignPapers = async () => {
    setAssignLoading(true);
    try {
      const params = new URLSearchParams();
      if (assignSearch) params.append('search', assignSearch);
      
      if (assignPoolFilter === 'unassigned') {
        params.append('calibrationPool', 'none');
      } else if (assignPoolFilter && assignPoolFilter !== 'all') {
        params.append('calibrationPool', assignPoolFilter);
      }

      params.append('sortBy', 'Paper_ID');
      params.append('sortOrder', 'asc');
      params.append('page', String(assignPage));
      params.append('limit', String(assignLimit));

      const res = await fetch(`/api/papers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssignPapers(data.papers || []);
        setAssignTotalPapers(data.total || 0);
        setAssignTotalPages(data.totalPages || 1);
        
        if (data.papers && data.papers.length > 0) {
          const found = data.papers.find((p: any) => p.Paper_ID === assignSelectedPaper?.Paper_ID);
          if (!found) {
            setAssignSelectedPaper(data.papers[0]);
          } else {
            setAssignSelectedPaper(found);
          }
        } else {
          setAssignSelectedPaper(null);
        }
      }
    } catch (err) {
      console.error('Error fetching papers for assignment:', err);
    } finally {
      setAssignLoading(false);
    }
  };

  // Assign or unassign papers to pools
  const handleAssignPool = async (paperId: string, pool: string | null, tag: string | null = null) => {
    try {
      const paperObj = papers.find(p => p.Paper_ID === paperId) || calPapers.find(p => p.Paper_ID === paperId) || assignPapers.find(p => p.Paper_ID === paperId);
      if (!paperObj) return;

      let nextPdfStatus = paperObj.Local_PDF_Status;
      if (pool === 'pool_b' || pool === 'pool_c') {
        if (paperObj.Local_PDF_Status === 'IGNORED' || !paperObj.Local_PDF_Status) {
          nextPdfStatus = 'MISSING';
        }
      }

      const res = await fetch(`/api/papers/${paperId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Title: paperObj.Title,
          calibration_pool: pool,
          calibration_tag: tag,
          Local_PDF_Status: nextPdfStatus
        })
      });

      if (res.ok) {
        showToast(`Paper successfully ${pool ? `assigned to ${pool.replace('_', ' ')}` : 'unassigned'}.`, 'success');
        
        await loadProjects();
        if (activeTab === 'pre-calibration') {
          loadCalPapers();
        }
        if (showAssignModal) {
          loadAssignPapers();
        }
        loadPapers();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to assign pool', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to assign pool', 'error');
    }
  };

  // Single paper PDF acquisition pipeline
  const singlePipelineAbortControllerRef = useRef<AbortController | null>(null);

  const runSinglePaperPipeline = async (paperId: string) => {
    if (assignIsRunning) {
      showToast('A PDF acquisition process is already active.', 'warning');
      return;
    }

    setAssignIsRunning(true);
    setAssignLogs([]);
    setAssignProgress(0);
    setAssignStatusText('Starting single paper acquisition...');
    setAssignWaitingLogin(false);

    try {
      const abortController = new AbortController();
      singlePipelineAbortControllerRef.current = abortController;

      const res = await fetch('/api/pdf/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId }),
        signal: abortController.signal
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to run single paper matching/scraping', 'error');
        setAssignIsRunning(false);
        return;
      }

      if (!res.body) {
        showToast('Streaming response not available.', 'error');
        setAssignIsRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            
            if (parsed.event === 'log') {
              setAssignLogs(prev => [...prev, parsed.message]);
            } else if (parsed.event === 'step_start') {
              setAssignStatusText(parsed.message);
              if (parsed.step === 'scan') {
                setAssignProgress(15);
              } else if (parsed.step === 'scrape') {
                setAssignProgress(45);
              }
            } else if (parsed.event === 'step_complete') {
              setAssignStatusText(parsed.message);
            } else if (parsed.event === 'waiting_login') {
              setAssignWaitingLogin(true);
              setAssignStatusText(parsed.message);
            } else if (parsed.event === 'resume') {
              setAssignWaitingLogin(false);
            } else if (parsed.event === 'paper_success') {
              setAssignProgress(90);
              showToast('Paper PDF acquired successfully!', 'success');
            } else if (parsed.event === 'paper_fail') {
              setAssignProgress(100);
              showToast(`Scrape failed: ${parsed.error}`, 'error');
            } else if (parsed.event === 'complete') {
              setAssignProgress(100);
              setAssignStatusText(parsed.message);
              showToast(parsed.message, 'success');
            } else if (parsed.event === 'error') {
              setAssignProgress(100);
              setAssignStatusText(parsed.message);
              showToast(parsed.message, 'error');
            }
          } catch (e) {
            setAssignLogs(prev => [...prev, line]);
          }
        }
      }

      await loadProjects();
      if (activeTab === 'pre-calibration') {
        loadCalPapers();
      }
      if (showAssignModal) {
        loadAssignPapers();
      }
      loadPapers();

    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast('Pipeline cancelled by user.', 'info');
      } else {
        showToast(err.message || 'Error running pipeline', 'error');
      }
    } finally {
      setAssignIsRunning(false);
      singlePipelineAbortControllerRef.current = null;
    }
  };


  // Inter-Rater Export/Import for Pool A
  const handleExportCalPoolA = () => {
    window.open('/api/export/inter-rater?pool=pool_a', '_blank');
    showToast('Exporting Pool A blinded review file (.slr)...', 'info');
  };

  // Trigger calibration papers load
  useEffect(() => {
    if (activeTab === 'pre-calibration') {
      loadCalPapers();
    }
  }, [calActivePool, calSearchTerm, calStatusFilter, calPdfFilter, calTagFilter, calSortBy, calSortOrder, calPage, calLimit, activeTab]);

  // Trigger assignment papers load
  useEffect(() => {
    if (showAssignModal) {
      loadAssignPapers();
    }
  }, [showAssignModal, assignSearch, assignPoolFilter, assignPage, assignLimit]);

  // Reset calibration pagination when filter changes
  useEffect(() => {
    setCalPage(1);
  }, [calSearchTerm, calStatusFilter, calPdfFilter, calTagFilter, calActivePool]);

  // Reset assignment pagination when filter changes
  useEffect(() => {
    setAssignPage(1);
  }, [assignSearch, assignPoolFilter]);

  // Scroll logs to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [operationModal.logs]);

  // Check active batch pipeline on mount
  useEffect(() => {
    checkBatchStatus();
  }, []);



  // CSV Parsing
  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const result: string[][] = [];
    const lines = text.split(/\r?\n/);
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const row: string[] = [];
      let inQuotes = false;
      let cell = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(cell.trim());
          cell = '';
        } else {
          cell += char;
        }
      }
      row.push(cell.trim());
      result.push(row.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"')));
    }

    if (result.length > 0) {
      const headers = result[0];
      setCsvHeaders(headers);
      setCsvData(result.slice(1));
      
      // Auto mapping fuzzy matching
      const targetColumns = [
        'Paper_ID', 'Import_Date', 'Import_Source', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link', 'Status'
      ];
      const initialMapping: Record<string, string> = {};
      
      targetColumns.forEach(col => {
        let matched = undefined;
        
        if (col === 'PDF_Link') {
          // Empty by default for PDF Link / Cloud Link
          matched = undefined;
        } else if (col === 'Authors') {
          matched = headers.find(h => h.toLowerCase().includes('author full names')) || 
                    headers.find(h => h.toLowerCase().includes('authors') || h.toLowerCase().includes('author'));
        } else {
          matched = headers.find(h => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanC = col.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanH.includes(cleanC) || cleanC.includes(cleanH);
          });
        }
        
        if (matched) {
          initialMapping[col] = matched;
        } else {
          initialMapping[col] = '';
        }
      });
      setColumnMapping(initialMapping);
    }
  };

  // Run preview with mapped headers and check duplicates
  useEffect(() => {
    if (csvData.length === 0 || Object.keys(columnMapping).length === 0) return;

    // Get mapped index for each target column
    const headerIndices: Record<string, number> = {};
    Object.entries(columnMapping).forEach(([target, source]) => {
      headerIndices[target] = csvHeaders.indexOf(source);
    });

    const parsedPapers = csvData.map((row, idx) => {
      const p: any = {};
      Object.entries(headerIndices).forEach(([target, colIdx]) => {
        p[target] = colIdx !== -1 ? row[colIdx] : '';
      });
      
      // Ensure defaults
      if (!p.Paper_ID) p.Paper_ID = `TEMP_P_${idx + 1}`;
      if (!p.Import_Date) p.Import_Date = new Date().toISOString().split('T')[0];
      if (!p.Import_Source) p.Import_Source = csvFile?.name || 'CSV Ingestion';
      if (!p.Status) p.Status = 'PENDING';
      
      return p;
    });

    // Check duplicates against active papers database (using full hashes list)
    let newCount = 0;
    let dupCount = 0;
    
    const existingDois = new Set(existingHashes.map(ep => ep.DOI?.trim().toLowerCase()).filter(Boolean));
    const existingTitles = new Set(existingHashes.map(ep => ep.Title?.toLowerCase().replace(/\s+/g, '')).filter(Boolean));

    const checkedPapers = parsedPapers.map(p => {
      const cleanTitle = p.Title?.toLowerCase().replace(/\s+/g, '') || '';
      const doi = p.DOI?.trim().toLowerCase() || '';

      const isDuplicate = (doi && existingDois.has(doi)) || (cleanTitle && existingTitles.has(cleanTitle));

      if (isDuplicate) {
        dupCount++;
      } else {
        newCount++;
      }

      return { ...p, isDuplicate };
    });

    setPreviewPapers(checkedPapers);
    setPreviewStats({ total: parsedPapers.length, newCount, dupCount });

  }, [columnMapping, csvData, existingHashes]);

  const handleImport = async () => {
    setImporting(true);
    try {
      // Send only new papers to import API and map source details
      const newPapers = previewPapers.filter(p => !p.isDuplicate).map(p => ({
        ...p,
        Import_Source: csvSource || 'CSV Import',
        Import_Date: csvImportDate || new Date().toISOString().split('T')[0],
        Source: csvSource || 'CSV Import'
      }));
      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers: newPapers })
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`Successfully imported ${data.imported} papers! (Skipped ${data.skipped} duplicates)`, 'success');
        setShowImport(false);
        setCsvFile(null);
        setCsvHeaders([]);
        setCsvData([]);
        setPreviewPapers([]);
        loadPapers();
        broadcastSync('SYNC_PAPERS');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`Failed to import papers: ${errData.error || res.statusText || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Error importing papers: ${err.message || err}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  // PDF Operations: Scan Cache, Scrape, Sync
  // Customizable sequential batch PDF pipeline execution
  const readBatchStream = async (res: Response, controller: AbortController) => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    setOperationModal(prev => ({
      ...prev,
      isOpen: true,
      isExecuting: true
    }));

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep last partial line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.event === 'restore') {
            setOperationModal({
              isOpen: true,
              type: 'scrape',
              title: 'Batch PDF Pipeline Execution',
              progress: data.progress,
              statusText: data.statusText,
              logs: data.logs ? data.logs.slice(-500) : [],
              currentItem: data.currentItem,
              isExecuting: data.isExecuting,
              isWaitingLogin: data.isWaitingLogin
            });
            setCurrentStep(data.currentStep);
            setStepStartTime(data.stepStartTime);
            setPipelineStats(data.pipelineStats);
            setIndexingState(data.indexingState);
            if (data.indexingState && data.indexingState.current === data.indexingState.total) {
              if ((window as any).indexingTimer) {
                clearTimeout((window as any).indexingTimer);
              }
              (window as any).indexingTimer = setTimeout(() => {
                setIndexingState(null);
              }, 10000);
            }
          } else {
            handleBatchEvent(data);
          }
        } catch (e) {
          setOperationModal(prev => ({
            ...prev,
            logs: [...prev.logs, line].slice(-500)
          }));
        }
      }
    }

    setOperationModal(prev => ({
      ...prev,
      progress: 100,
      isExecuting: false
    }));
    loadPapers();
    broadcastSync('SYNC_PIPELINE');
    broadcastSync('SYNC_PAPERS');
  };

  const subscribeToBatchStream = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const res = await fetch('/api/pdf/batch?stream=true', {
        signal: controller.signal
      });
      await readBatchStream(res, controller);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast(`Failed to reconnect to batch stream: ${err.message}`, 'error');
      }
    }
  };

  const checkBatchStatus = async () => {
    try {
      const res = await fetch('/api/pdf/batch');
      if (res.ok) {
        const data = await res.json();
        if (data.isExecuting) {
          subscribeToBatchStream();
        }
      }
    } catch (e) {
      console.error('Error checking batch status:', e);
    }
  };

  // Setup Broadcast Channel for multi-tab sync using Mutable Ref pattern to prevent stale closures
  const latestLoaders = useRef({ loadPapers, loadProjects, checkBatchStatus, loadDuplicatesCount });
  useEffect(() => {
    latestLoaders.current = { loadPapers, loadProjects, checkBatchStatus, loadDuplicatesCount };
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;
    const channel = new BroadcastChannel('slr-magic-sync');
    channel.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'SYNC_PAPERS') {
        latestLoaders.current.loadPapers();
        latestLoaders.current.loadDuplicatesCount();
      } else if (type === 'SYNC_PROJECTS') {
        latestLoaders.current.loadProjects();
        latestLoaders.current.loadPapers();
        latestLoaders.current.loadDuplicatesCount();
      } else if (type === 'SYNC_PIPELINE') {
        latestLoaders.current.checkBatchStatus();
        latestLoaders.current.loadDuplicatesCount();
      }
    };
    return () => {
      channel.close();
    };
  }, []);

  // PDF Operations: Scan Cache, Scrape, Sync
  // Customizable sequential batch PDF pipeline execution
  const runBatchExecution = async () => {
    if (operationModal.isExecuting) return;
    const activeSteps = Object.keys(batchSteps).filter(k => batchSteps[k]);
    if (activeSteps.length === 0) {
      showToast('Please select at least one step to execute', 'warning');
      return;
    }

    setIsModalMinimized(false);
    setCurrentStep(null);
    setStepStartTime(null);
    setTimeTicker(0);
    setIndexingState(null);
    setPipelineStats({
      matched: 0,
      downloaded: 0,
      failed: 0,
      current: 0,
      total: 0,
      savedSpaceBytes: 0,
      originalSpaceBytes: 0
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setOperationModal({
      isOpen: true,
      type: 'scrape',
      title: 'Batch PDF Pipeline Execution',
      progress: 0,
      statusText: 'Initializing pipeline...',
      logs: [],
      isExecuting: true
    });

    try {
      // Step 1: Sequential Duplicate Scanning
      if (batchSteps.duplicate_scan) {
        setOperationModal(prev => ({
          ...prev,
          statusText: 'Starting duplicate scan...',
          logs: ['>>> Launching Duplicate Paper Detection...']
        }));
        
        const resScan = await fetch('/api/duplicates/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        broadcastSync('SYNC_PIPELINE');
        
        if (!resScan.body) throw new Error('No duplicate scan stream returned');
        await readBatchStream(resScan, controller);

        // Check if aborted/cancelled during duplicate scan
        if (controller.signal.aborted) {
          return;
        }
      }

      // Step 2: Next steps in batch execution
      const otherSteps = activeSteps.filter(k => k !== 'duplicate_scan');
      if (otherSteps.length > 0) {
        setOperationModal(prev => ({
          ...prev,
          statusText: 'Transitioning to PDF batch acquisition...',
          logs: [...prev.logs, '>>> Starting PDF Acquisition & Sync...'],
          isExecuting: true
        }));

        const res = await fetch('/api/pdf/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steps: otherSteps, compress: compressOnSync }),
          signal: controller.signal
        });

        broadcastSync('SYNC_PIPELINE');

        if (!res.body) throw new Error('No body stream returned');
        await readBatchStream(res, controller);
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setOperationModal(prev => ({
          ...prev,
          statusText: 'Pipeline execution failed.',
          logs: [...prev.logs, `[ERROR]: ${err.message}`].slice(-500),
          isExecuting: false
        }));
      }
      loadPapers();
    }
  };

  const handleBatchEvent = (data: any) => {
    // 1. Step Start/Complete markers
    if (data.event === 'step_start') {
      setCurrentStep(data.step);
      setStepStartTime(Date.now());
      setIndexingState(null);
      setPipelineStats(prev => ({
        ...prev,
        current: 0,
        total: 0,
        savedSpaceBytes: 0,
        originalSpaceBytes: 0
      }));
      setOperationModal(prev => ({
        ...prev,
        statusText: data.message,
        isWaitingLogin: false,
        logs: [...prev.logs, `>>> ${data.message}`].slice(-500)
      }));
    } else if (data.event === 'step_complete') {
      setIndexingState(null);
      setOperationModal(prev => ({
        ...prev,
        isWaitingLogin: false,
        logs: [...prev.logs, `<<< ${data.message}`].slice(-500)
      }));
    } else if (data.event === 'complete' && !data.step) {
      setIndexingState(null);
      setOperationModal(prev => ({
        ...prev,
        progress: 100,
        statusText: data.message,
        isWaitingLogin: false,
        logs: [...prev.logs, `[SUCCESS]: ${data.message}`].slice(-500),
        isExecuting: false
      }));
    } else if (data.event === 'error') {
      setIndexingState(null);
      setOperationModal(prev => ({
        ...prev,
        isWaitingLogin: false,
        logs: [...prev.logs, `[ERROR]: ${data.message}`].slice(-500),
        isExecuting: false
      }));
    } else if (data.event === 'waiting_login') {
      setOperationModal(prev => ({
        ...prev,
        isWaitingLogin: true,
        statusText: data.message,
        logs: [...prev.logs, `[ACTION REQUIRED]: ${data.message}`].slice(-500)
      }));
    } else if (data.event === 'resume') {
      setOperationModal(prev => ({
        ...prev,
        isWaitingLogin: false
      }));
    } else if (data.event === 'indexing') {
      setIndexingState({
        filename: data.filename,
        tool: data.tool,
        current: data.current,
        total: data.total
      });
      if (data.current === data.total) {
        if ((window as any).indexingTimer) {
          clearTimeout((window as any).indexingTimer);
        }
        (window as any).indexingTimer = setTimeout(() => {
          setIndexingState(null);
        }, 10000);
      }
    } else if (data.event === 'clear_indexing') {
      setIndexingState(null);
    } else if (data.event === 'log') {
      setOperationModal(prev => ({
        ...prev,
        logs: [...prev.logs, data.message].slice(-500)
      }));
    } else if (data.info) {
      setOperationModal(prev => ({
        ...prev,
        logs: [...prev.logs, `[INFO]: ${data.info}`].slice(-500)
      }));
    } else if (data.event === 'comparing') {
      setOperationModal(prev => ({
        ...prev,
        currentItem: `${prev.currentItem?.split(' | ')[0] || prev.currentItem} | Comparing: ${data.filename}`
      }));
    }
    
    // 2. Step specific events
    // Duplicate scan events
    else if (data.step === 'duplicate_scan') {
      if (data.event === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        setPipelineStats(prev => ({
          ...prev,
          current: data.current,
          total: data.total
        }));
        setOperationModal(prev => ({
          ...prev,
          progress: percent,
          currentItem: data.currentItem ? `Comparing: "${data.currentItem}"` : undefined,
          statusText: `Scanning duplicates: paper ${data.current} of ${data.total}...`
        }));
      }
    }
    // Cache Scan Matcher events
    else if (data.step === 'scan') {
      if (data.event === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        setPipelineStats(prev => ({
          ...prev,
          current: data.current,
          total: data.total
        }));
        setOperationModal(prev => ({
          ...prev,
          progress: percent,
          currentItem: `Paper: ${data.paper_id} - "${data.title}"`,
          statusText: `Matching Cache: paper ${data.current} of ${data.total}...`
        }));
      } else if (data.event === 'match') {
        setPipelineStats(prev => ({
          ...prev,
          matched: prev.matched + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✓ Matched: ${data.paper_id} - "${data.filename}" (${data.method})`].slice(-500),
          statusText: `Matched paper ${data.paper_id}...`
        }));
      }
    } 
    
    // Scraper events
    else if (data.step === 'scrape') {
      if (data.event === 'start') {
        setPipelineStats(prev => ({
          ...prev,
          total: data.total,
          current: 0
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `Scraper starting for ${data.total} papers...`].slice(-500),
          statusText: 'Launching Scraper...'
        }));
      } else if (data.event === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        setPipelineStats(prev => ({
          ...prev,
          current: data.current
        }));
        setOperationModal(prev => ({
          ...prev,
          progress: percent,
          currentItem: data.title,
          statusText: `Scraping: paper ${data.current} of ${data.total}...`,
          logs: [...prev.logs, `[Scrape ${data.current}/${data.total}] Attempting download for: "${data.title}"`].slice(-500)
        }));
      } else if (data.event === 'paper_success') {
        setPipelineStats(prev => ({
          ...prev,
          downloaded: prev.downloaded + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✓ Downloaded and saved PDF for ${data.paper_id}.`].slice(-500)
        }));
      } else if (data.event === 'paper_fail') {
        setPipelineStats(prev => ({
          ...prev,
          failed: prev.failed + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✗ Download failed for ${data.paper_id}: ${data.error}`].slice(-500)
        }));
      } else if (data.event === 'sleep') {
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `Scraper rate limit delay: sleeping for ${data.duration}s...`].slice(-500)
        }));
      }
    } 
    
    // Compressor events
    else if (data.step === 'compress') {
      if (data.event === 'start') {
        setPipelineStats(prev => ({
          ...prev,
          total: data.total,
          current: 0
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `Compressor starting for ${data.total} files...`].slice(-500),
          statusText: 'Launching Compressor...'
        }));
      } else if (data.event === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        const origSize = data.original_size || 0;
        const newSize = data.new_size || 0;
        const savedSpace = Math.max(0, origSize - newSize);

        setPipelineStats(prev => ({
          ...prev,
          current: data.current,
          originalSpaceBytes: (prev.originalSpaceBytes || 0) + (data.skipped ? 0 : origSize),
          savedSpaceBytes: (prev.savedSpaceBytes || 0) + (data.skipped ? 0 : savedSpace)
        }));

        const formatBytesLocal = (bytes: number) => {
          if (!bytes || bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const ratioText = data.skipped
          ? ` (${formatBytesLocal(origSize)}, Already Processed)`
          : (data.ratio > 0 
              ? ` (${formatBytesLocal(origSize)} -> ${formatBytesLocal(newSize)}, saved -${data.ratio}%)` 
              : ` (${formatBytesLocal(origSize)}, Direct Copy)`);

        setOperationModal(prev => ({
          ...prev,
          progress: percent,
          currentItem: `${data.paper_id}.pdf`,
          statusText: `Compressing: file ${data.current} of ${data.total}...`,
          logs: [...prev.logs, `[Compress ${data.current}/${data.total}] Processed ${data.paper_id}.pdf${ratioText}`].slice(-500)
        }));
      }
    } 
    
    // Sync events
    else if (data.step === 'sync') {
      if (data.event === 'start') {
        setPipelineStats(prev => ({
          ...prev,
          total: data.total,
          current: 0,
          failed: 0
        }));
      } else if (data.event === 'rclone_log') {
        const match = data.message.match(/INFO\s*:\s*([^:]+\.pdf):\s*(.*)/i);
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, data.message].slice(-500),
          currentItem: match ? `Syncing: ${match[1]} (${match[2]})` : prev.currentItem
        }));
      } else if (data.event === 'linking') {
        setOperationModal(prev => ({
          ...prev,
          currentItem: `Linking paper: ${data.paper_id}`
        }));
      } else if (data.event === 'link_success') {
        setPipelineStats(prev => ({
          ...prev,
          current: prev.current + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✓ ${cloudName} link generated for ${data.paper_id}: ${data.link}`].slice(-500)
        }));
      } else if (data.event === 'link_fail') {
        setPipelineStats(prev => ({
          ...prev,
          failed: prev.failed + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✗ ${cloudName} link failed for ${data.paper_id}: ${data.message}`].slice(-500)
        }));
      }
    }
  };

  const handleCancelOperation = async () => {
    try {
      const res = await fetch('/api/pdf/batch/cancel', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Pipeline cancellation requested.', 'info');
      } else {
        showToast(data.message, 'warning');
      }
    } catch (e: any) {
      showToast(`Cancellation error: ${e.message}`, 'error');
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    broadcastSync('SYNC_PIPELINE');
  };

  const handleResumeOperation = async () => {
    // Optimistically dismiss login wait state to prevent duplicate clicks
    setOperationModal(prev => ({ ...prev, isWaitingLogin: false }));
    try {
      const res = await fetch('/api/pdf/batch/resume', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Pipeline resume requested.', 'info');
      } else {
        showToast(data.message, 'warning');
        // Restore wait state on failure
        setOperationModal(prev => ({ ...prev, isWaitingLogin: true }));
      }
    } catch (e: any) {
      showToast(`Resume error: ${e.message}`, 'error');
      // Restore wait state on error
      setOperationModal(prev => ({ ...prev, isWaitingLogin: true }));
    }
  };

  const getTimeEstimates = () => {
    if (!stepStartTime || pipelineStats.current === 0 || pipelineStats.total === 0) {
      return { avgTime: 'calculating...', timeLeft: 'calculating...' };
    }
    const elapsedMs = Date.now() - stepStartTime;
    const elapsedSecs = elapsedMs / 1000;
    
    // Average time per paper (seconds)
    const avgTime = elapsedSecs / pipelineStats.current;
    
    // Remaining papers
    const remaining = pipelineStats.total - pipelineStats.current;
    if (remaining <= 0) {
      return { avgTime: `${avgTime.toFixed(2)}s`, timeLeft: '0s' };
    }
    
    // Time left (seconds)
    const timeLeftSecs = remaining * avgTime;
    
    // Format time left
    let timeLeftStr = '';
    if (timeLeftSecs > 3600) {
      const h = Math.floor(timeLeftSecs / 3600);
      const m = Math.floor((timeLeftSecs % 3600) / 60);
      timeLeftStr = `${h}h ${m}m`;
    } else if (timeLeftSecs > 60) {
      const m = Math.floor(timeLeftSecs / 60);
      const s = Math.floor(timeLeftSecs % 60);
      timeLeftStr = `${m}m ${s}s`;
    } else {
      timeLeftStr = `${Math.round(timeLeftSecs)}s`;
    }
    
    return {
      avgTime: `${avgTime.toFixed(2)}s`,
      timeLeft: timeLeftStr
    };
  };

  const hasLocalPdf = !!(paperModal.isOpen && paperModal.paper?.Local_PDF_Path && ['MATCHED', 'DOWNLOADED', 'SYNCED'].includes(paperModal.paper?.Local_PDF_Status));

  const allProps = {
    activeTab,
    setActiveTab,
    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    loadingProjects,
    setLoadingProjects,
    projectSubTab,
    setProjectSubTab,
    compressOnSync,
    setCompressOnSync,
    showCreateProjectModal,
    setShowCreateProjectModal,
    savingProject,
    setSavingProject,
    showEditProjectModal,
    setShowEditProjectModal,
    editingProjectId,
    setEditingProjectId,
    projectSettingsTab,
    setProjectSettingsTab,
    testingProjectConnection,
    setTestingProjectConnection,
    projectConnectionTestResult,
    setProjectConnectionTestResult,
    calibrationSubTab,
    setCalibrationSubTab,
    projectFormName,
    setProjectFormName,
    projectFormManifesto,
    setProjectFormManifesto,
    projectFormObjective,
    setProjectFormObjective,
    projectFormQuestions,
    setProjectFormQuestions,
    projectFormQaDefinition,
    setProjectFormQaDefinition,
    projectFormExclusionCriteria,
    setProjectFormExclusionCriteria,
    projectFormPoolA,
    setProjectFormPoolA,
    projectFormPoolB,
    setProjectFormPoolB,
    projectFormPoolC,
    setProjectFormPoolC,
    projectFormGDriveDest,
    setProjectFormGDriveDest,
    projectFormCloudProvider,
    setProjectFormCloudProvider,
    projectFormRemoteName,
    setProjectFormRemoteName,
    projectFormPoolTags,
    setProjectFormPoolTags,
    projectFormEcRules,
    setProjectFormEcRules,
    projectFormReasoningTemplate,
    setProjectFormReasoningTemplate,
    newProjName,
    setNewProjName,
    newProjFolder,
    setNewProjFolder,
    newProjManifesto,
    setNewProjManifesto,
    newProjObjective,
    setNewProjObjective,
    newProjQuestions,
    setNewProjQuestions,
    newProjQaDefinition,
    setNewProjQaDefinition,
    newProjExclusionCriteria,
    setNewProjExclusionCriteria,
    newProjPoolA,
    setNewProjPoolA,
    newProjPoolB,
    setNewProjPoolB,
    newProjPoolC,
    setNewProjPoolC,
    newProjGDriveDest,
    setNewProjGDriveDest,
    newProjCloudProvider,
    setNewProjCloudProvider,
    newProjRemoteName,
    setNewProjRemoteName,
    newProjPoolTags,
    setNewProjPoolTags,
    deleteProjectConfirm,
    setDeleteProjectConfirm,
    deleteProjectConfirmationText,
    setDeleteProjectConfirmationText,
    deletingProject,
    setDeletingProject,
    csvSource,
    setCsvSource,
    csvFile,
    setCsvFile,
    csvImportDate,
    setCsvImportDate,
    manualSource,
    setManualSource,
    manualImportDate,
    setManualImportDate,
    manualYear,
    setManualYear,
    manualTitle,
    setManualTitle,
    manualAuthors,
    setManualAuthors,
    manualDoi,
    setManualDoi,
    manualAbstract,
    setManualAbstract,
    manualIngesting,
    setManualIngesting,
    papers,
    setPapers,
    loadingPapers,
    setLoadingPapers,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    pdfFilter,
    setPdfFilter,
    deleteConfirm,
    setDeleteConfirm,
    deletingPaper,
    setDeletingPaper,
    deleteAllConfirm,
    setDeleteAllConfirm,
    isSettingsOpen,
    setIsSettingsOpen,
    toasts,
    setToasts,
    assignSelectedPaper,
    setAssignSelectedPaper,
    operationModal,
    setOperationModal,
    cloudProvider,
    cloudName,
    handleTestProjectConnection,
    handleAddPoolTag,
    handleUpdatePoolTag,
    activeProject,
    showToast,
    loadProjects,
    activateProject,
    handleCreateProject,
    handleSaveProjectManifesto,
    loadPapers,
    handleManualIngest,
    batchSteps,
    setBatchSteps,
    runBatchExecution,
    paperModal,
    setPaperModal,
    hasLocalPdf,
    showInterRaterModal,
    setShowInterRaterModal,
    showImport,
    setShowImport,
    pipelineStats,
    setPipelineStats,
    currentStep,
    setCurrentStep,
    isModalMinimized,
    setIsModalMinimized,
    formatBytes,
    getTimeEstimates,
    indexingState,
    logEndRef,
    handleResumeOperation,
    handleCancelOperation,
    renderCalSortIcon,
    handleCalSort,
    calActivePool,
    calPapers,
    calTotalPapers,
    calPage,
    calLimit,
    setCalLimit,
    setCalPage,
    calTotalPages,
    handleAssignPool,
    setSelectedParentPaper,
    setManualParentPaperId,
    setManualParentSearch,
    setShowParentSuggestions,
    showParentSuggestions,
    manualParentSearch,
    parentPaperSuggestions,
    LoaderIcon,
    handleSort,
    renderSortIcon,
    totalPapers,
    page,
    limit,
    setLimit,
    setPage,
    totalPages,
    calStats,
    setCalActivePool,
    handleExportCalPoolA,
    setShowAssignModal,
    calSearchTerm,
    setCalSearchTerm,
    calStatusFilter,
    setCalStatusFilter,
    calPdfFilter,
    setCalPdfFilter,
    calLoading,
    openProjectSettings,
    handleRemovePoolTag,
    handleAddEcRule,
    handleUpdateEcRule,
    handleRemoveEcRule,
    handleAddReasoningTemplate,
    handleUpdateReasoningTemplate,
    handleRemoveReasoningTemplate,
    handleCsvSelect,
    csvData,
    columnMapping,
    setColumnMapping,
    csvHeaders,
    previewPapers,
    previewStats,
    handleImport,
    importing,
    selectedParentPaper,
    setParentPaperSuggestions,
    showDuplicateModal,
    setShowDuplicateModal,
    duplicatesCount,
    loadDuplicatesCount,

    // Project delete handler
    handleDeleteProject,

    // Paper handlers
    handleDeletePaper,
    handleDeleteAllPapers,
    deleteAllConfirmationText,
    setDeleteAllConfirmationText,

    // Abort controller ref and handler mapping
    singlePipelineAbortControllerRef,
    handleAborPipeline: handleCancelOperation,

    // Calibration/Assignment state mapping
    activeAssignDropdown,
    setActiveAssignDropdown,
    assignSearch,
    setAssignSearch,
    assignPoolFilter,
    setAssignPoolFilter,
    assignPapers,
    setAssignPapers,
    assignLoading,
    setAssignLoading,
    assignPage,
    setAssignPage,
    assignLimit,
    setAssignLimit,
    assignTotalPapers,
    setAssignTotalPapers,
    assignTotalPages,
    setAssignTotalPages,
    assignLogs,
    setAssignLogs,
    assignIsRunning,
    setAssignIsRunning,
    assignStatusText,
    setAssignStatusText,
    assignProgress,
    setAssignProgress,
    assignWaitingLogin,
    setAssignWaitingLogin,
    loadCalPapers,
    loadAssignPapers,
    runSinglePaperPipeline
  };

  return (
    <AppStateProvider value={allProps}>
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        theme={theme} 
        setTheme={handleThemeChange}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-sm tracking-tight capitalize">
              {projects.find(p => String(p.id) === String(activeProjectId))?.name || 'Default Project'} • {activeTab.replace('-', ' ')}
            </h2>
            <p className="text-[10px] text-muted-foreground font-medium">Stage 1: Reference Ingestion & matching workflows</p>
          </div>

          {/* Data Pipeline toggles have been extracted to PipelineExecutionView in Epoch 5.4 */}
        </header>

        {/* Content Shell */}
        <div className="flex-1 overflow-hidden p-6 relative">
          
          {/* DASHBOARD VIEW */}
          {(() => { return (
            <>
            {activeTab === 'dashboard' ? (
              <DashboardView />
            ) : activeTab === 'pre-calibration' ? (
              <PreCalibrationView />
            ) : activeTab === 'full-execution' ? (
              <PipelineExecutionView />
            ) : showImport ? (
              <IngestionHubView />
            ) : (
              <PaperDatabaseView />
            )}
            </>
          );})()}
        </div>
      </main>

      {/* MINIMIZED PIPELINE BANNER (Hidden on full-execution tab) */}
      {operationModal.isOpen && isModalMinimized && activeTab !== 'full-execution' && (
        (() => {
          let statsFound = 0;
          let statsNotFound = 0;
          let statsTotal = pipelineStats.total;
          let statsCurrent = pipelineStats.current;

          if (currentStep === 'scan') {
            statsFound = pipelineStats.matched;
            statsNotFound = Math.max(0, pipelineStats.current - pipelineStats.matched);
          } else if (currentStep === 'duplicate_scan') {
            statsFound = pipelineStats.matched;
            statsNotFound = 0;
          } else if (currentStep === 'scrape') {
            statsFound = pipelineStats.downloaded;
            statsNotFound = pipelineStats.failed;
          } else if (currentStep === 'compress') {
            statsFound = pipelineStats.current;
            statsNotFound = 0;
          } else if (currentStep === 'sync') {
            statsFound = pipelineStats.current;
            statsNotFound = pipelineStats.failed;
          }

          return (
            <div className="fixed bottom-6 right-6 z-[9999] w-80 bg-card/95 border border-border rounded-xl shadow-2xl p-4 flex flex-col gap-3 backdrop-blur-lg animate-in slide-in-from-bottom-5 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-bold text-foreground">Pipeline running...</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsModalMinimized(false)}
                    className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"
                    title="Expand Window"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Expand
                  </button>
                  {!operationModal.isExecuting && (
                    <button 
                      onClick={() => {
                        setOperationModal(prev => ({ ...prev, isOpen: false }));
                        setCurrentStep(null);
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-[9px] font-bold uppercase text-muted-foreground">
                  <span className="truncate max-w-[200px]">{operationModal.statusText}</span>
                  <span>{operationModal.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-secondary border border-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 rounded-full" 
                    style={{ width: `${operationModal.progress}%` }} 
                  />
                </div>
              </div>

              {currentStep && (
                (() => {
                  if (currentStep === 'compress') {
                    const ratio = pipelineStats.originalSpaceBytes > 0 
                      ? (pipelineStats.savedSpaceBytes / pipelineStats.originalSpaceBytes) * 100 
                      : 0;
                    return (
                      <div className="grid grid-cols-3 gap-2 text-[9px] text-center select-none pt-1 border-t border-border/50">
                        <div className="flex flex-col">
                          <span className="font-semibold text-emerald-400">Processed</span>
                          <span className="font-black text-emerald-400 text-xs mt-0.5">{statsCurrent}/{statsTotal || '—'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-primary">Saved</span>
                          <span className="font-black text-primary text-xs mt-0.5">{formatBytes(pipelineStats.savedSpaceBytes)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-muted-foreground">Original</span>
                          <span className="font-black text-foreground text-xs mt-0.5">
                            {formatBytes(pipelineStats.originalSpaceBytes)} {ratio > 0 ? `(-${ratio.toFixed(1)}%)` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  if (currentStep === 'sync') {
                    const isLinking = pipelineStats.total > 0;
                    const syncStatus = isLinking ? "Linking" : "Syncing";
                    return (
                      <div className="grid grid-cols-3 gap-2 text-[9px] text-center select-none pt-1 border-t border-border/50 animate-in fade-in zoom-in duration-200">
                        <div className="flex flex-col">
                          <span className="font-semibold text-primary">Phase</span>
                          <span className="font-black text-primary text-[10px] mt-0.5">{syncStatus}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-emerald-400">Linked</span>
                          <span className="font-black text-emerald-400 text-[10px] mt-0.5">{statsFound}/{statsTotal || '—'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className={`font-semibold ${statsNotFound > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}>Failures</span>
                          <span className={`font-black text-[10px] mt-0.5 ${statsNotFound > 0 ? 'text-destructive' : 'text-foreground'}`}>{statsNotFound}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-3 gap-2 text-[9px] text-center select-none pt-1 border-t border-border/50">
                      <div className="flex flex-col">
                        <span className="font-semibold text-emerald-400">Found</span>
                        <span className="font-black text-emerald-400 text-xs mt-0.5">{statsFound}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-destructive">Not Found</span>
                        <span className="font-black text-destructive text-xs mt-0.5">{statsNotFound}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-muted-foreground">Total</span>
                        <span className="font-black text-foreground text-xs mt-0.5">{statsCurrent}/{statsTotal || '—'}</span>
                      </div>
                    </div>
                  );
                })()
              )}

              {currentStep && (
                (() => {
                  const { timeLeft } = getTimeEstimates();
                  return (
                    <div className="text-[9px] text-muted-foreground flex justify-between items-center select-none pt-1 border-t border-border/30">
                      <span>Time Remaining:</span>
                      <span className="font-bold text-primary">{timeLeft}</span>
                    </div>
                  );
                })()
              )}

              {indexingState && (
                <div className="text-[9px] text-muted-foreground flex justify-between items-center select-none pt-1 border-t border-border/30 gap-2">
                  <span className="truncate max-w-[170px] font-semibold text-primary">
                    Indexing: <span className="text-foreground">{indexingState.filename}</span>
                  </span>
                  <span className="font-bold shrink-0">
                    Tool: <span className="text-foreground uppercase bg-primary/10 text-primary px-1 rounded text-[8px]">{indexingState.tool}</span> ({indexingState.current}/{indexingState.total})
                  </span>
                </div>
              )}

              {operationModal.isExecuting && operationModal.isWaitingLogin && (
                <button
                  onClick={handleResumeOperation}
                  className="w-full py-1 text-center bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold uppercase rounded-lg transition-colors mt-1 animate-pulse"
                >
                  Resume Download
                </button>
              )}
              {operationModal.isExecuting && (
                <button
                  onClick={handleCancelOperation}
                  className="w-full py-1 text-center border border-destructive/20 hover:bg-destructive/10 text-destructive text-[9px] font-bold uppercase rounded-lg transition-colors mt-1"
                >
                  Cancel Process
                </button>
              )}
            </div>
          );
        })()
      )}

      {/* FULLSCREEN ASSIGN PAPERS TO POOLS MODAL */}
      {showAssignModal && (
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

            {/* Realtime progress bars inside header */}
            {(() => {
              const activeProj = projects.find(p => String(p.id) === String(activeProjectId));
              const targetA = activeProj?.pool_a_size || 50;
              const targetB = activeProj?.pool_b_size || 30;
              const targetC = activeProj?.pool_c_size || 20;
              const countA = activeProj?.stats?.pool_a_count || 0;
              const countB = activeProj?.stats?.pool_b_count || 0;
              const countC = activeProj?.stats?.pool_c_count || 0;
              const tagStats = activeProj?.stats?.tagStats;

              const pctA = Math.min(100, Math.round((countA / targetA) * 100));
              const pctB = Math.min(100, Math.round((countB / targetB) * 100));
              const pctC = Math.min(100, Math.round((countC / targetC) * 100));

              return (
                <div className="hidden xl:flex items-center gap-6 text-[10px] select-none">
                  <div className="w-48 space-y-1 group relative cursor-pointer">
                    <div className="flex justify-between font-bold">
                      <span className="text-indigo-400">Pool A</span>
                      <span className="text-muted-foreground">{countA} / {targetA}</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${pctA}%` }} />
                    </div>

                    {/* Floating Balloon */}
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-lg p-2.5 w-56 hidden group-hover:block z-50 text-[10px] font-semibold text-foreground space-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
                      <div className="font-bold text-primary border-b border-border/40 pb-1 flex justify-between">
                        <span>Pool A Tag Breakdown</span>
                        <span>Count</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        <div className="flex justify-between text-muted-foreground hover:text-foreground">
                          <span className="truncate max-w-[170px]">General (No Tag)</span>
                          <span className="font-mono">{tagStats?.['pool_a']?.['__general'] || 0}</span>
                        </div>
                        {getActiveProjectPoolTags('pool_a').map(tag => {
                          const cnt = tagStats?.['pool_a']?.[tag.code] || 0;
                          return (
                            <div key={tag.code} className="flex justify-between hover:text-foreground">
                              <span className="truncate max-w-[170px]" title={`${tag.code}: ${tag.label}`}>
                                <span className="font-bold text-primary mr-1">{tag.code}</span>{tag.label}
                              </span>
                              <span className="font-mono">{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="w-48 space-y-1 group relative cursor-pointer">
                    <div className="flex justify-between font-bold">
                      <span className="text-emerald-400">Pool B</span>
                      <span className="text-muted-foreground">{countB} / {targetB}</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pctB}%` }} />
                    </div>

                    {/* Floating Balloon */}
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-lg p-2.5 w-56 hidden group-hover:block z-50 text-[10px] font-semibold text-foreground space-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
                      <div className="font-bold text-primary border-b border-border/40 pb-1 flex justify-between">
                        <span>Pool B Tag Breakdown</span>
                        <span>Count</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        <div className="flex justify-between text-muted-foreground hover:text-foreground">
                          <span className="truncate max-w-[170px]">General (No Tag)</span>
                          <span className="font-mono">{tagStats?.['pool_b']?.['__general'] || 0}</span>
                        </div>
                        {getActiveProjectPoolTags('pool_b').map(tag => {
                          const cnt = tagStats?.['pool_b']?.[tag.code] || 0;
                          return (
                            <div key={tag.code} className="flex justify-between hover:text-foreground">
                              <span className="truncate max-w-[170px]" title={`${tag.code}: ${tag.label}`}>
                                <span className="font-bold text-primary mr-1">{tag.code}</span>{tag.label}
                              </span>
                              <span className="font-mono">{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="w-48 space-y-1 group relative cursor-pointer">
                    <div className="flex justify-between font-bold">
                      <span className="text-amber-400">Pool C</span>
                      <span className="text-muted-foreground">{countC} / {targetC}</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${pctC}%` }} />
                    </div>

                    {/* Floating Balloon */}
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-lg p-2.5 w-56 hidden group-hover:block z-50 text-[10px] font-semibold text-foreground space-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
                      <div className="font-bold text-primary border-b border-border/40 pb-1 flex justify-between">
                        <span>Pool C Tag Breakdown</span>
                        <span>Count</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        <div className="flex justify-between text-muted-foreground hover:text-foreground">
                          <span className="truncate max-w-[170px]">General (No Tag)</span>
                          <span className="font-mono">{tagStats?.['pool_c']?.['__general'] || 0}</span>
                        </div>
                        {getActiveProjectPoolTags('pool_c').map(tag => {
                          const cnt = tagStats?.['pool_c']?.[tag.code] || 0;
                          return (
                            <div key={tag.code} className="flex justify-between hover:text-foreground">
                              <span className="truncate max-w-[170px]" title={`${tag.code}: ${tag.label}`}>
                                <span className="font-bold text-primary mr-1">{tag.code}</span>{tag.label}
                              </span>
                              <span className="font-mono">{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
            {/* Left Panel: Searchable paper list */}
            <div className="w-96 border-r border-border bg-card/30 flex flex-col overflow-hidden shrink-0">
              {/* Search and pool filter */}
              <div className="p-4 border-b border-border space-y-3 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground/70 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search papers..."
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    className="w-full bg-secondary/40 border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary placeholder-muted-foreground/60 transition-colors font-semibold"
                  />
                </div>

                {/* mini sub-filter for pool assignment */}
                <div className="grid grid-cols-5 gap-1 bg-secondary/50 p-0.5 rounded-lg border border-border text-[9px] font-bold text-center uppercase tracking-wide">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'unassigned', label: 'Un' },
                    { id: 'pool_a', label: 'A' },
                    { id: 'pool_b', label: 'B' },
                    { id: 'pool_c', label: 'C' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setAssignPoolFilter(f.id)}
                      className={`py-1 rounded-md transition-colors ${
                        assignPoolFilter === f.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title={`Show ${f.id === 'unassigned' ? 'Unassigned' : f.id.toUpperCase()} papers`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Papers List */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                {assignLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span>Loading papers database...</span>
                  </div>
                ) : assignPapers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">
                    No papers found matching filters.
                  </div>
                ) : (
                  assignPapers.map((paper) => {
                    const isSelected = assignSelectedPaper?.Paper_ID === paper.Paper_ID;
                    return (
                      <div
                        key={paper.Paper_ID}
                        onClick={() => {
                          if (!assignIsRunning) {
                            setAssignSelectedPaper(paper);
                            setAssignLogs([]);
                            setAssignProgress(0);
                            setAssignStatusText('');
                          } else {
                            showToast('Please wait or cancel the running acquisition process first.', 'warning');
                          }
                        }}
                        className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1 border-l-2 select-none ${
                          isSelected
                            ? 'bg-secondary/40 border-primary'
                            : paper.calibration_pool === 'pool_a'
                            ? 'border-indigo-500 hover:bg-secondary/10'
                            : paper.calibration_pool === 'pool_b'
                            ? 'border-emerald-500 hover:bg-secondary/10'
                            : paper.calibration_pool === 'pool_c'
                            ? 'border-amber-500 hover:bg-secondary/10'
                            : 'border-transparent hover:bg-secondary/10'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-mono text-[9px] font-bold text-muted-foreground shrink-0">{paper.Paper_ID}</span>
                          {paper.calibration_pool && (
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded ${
                              paper.calibration_pool === 'pool_a' ? 'bg-indigo-500/10 text-indigo-400' :
                              paper.calibration_pool === 'pool_b' ? 'bg-emerald-500/10 text-emerald-400' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>
                              {paper.calibration_pool.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-relaxed">{paper.Title}</h4>
                        <p className="text-[9px] text-muted-foreground truncate">{paper.Authors || 'Unknown Author'} • {paper.Year || '—'}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* sticky bottom page controls inside list */}
              <div className="p-3 border-t border-border bg-secondary/10 flex items-center justify-between shrink-0 select-none">
                <span className="text-[9px] text-muted-foreground font-semibold">Total: {assignTotalPapers}</span>
                <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg p-0.5">
                  <button
                    disabled={assignPage === 1 || assignIsRunning}
                    onClick={() => setAssignPage(prev => Math.max(1, prev - 1))}
                    className="p-1 hover:bg-background rounded text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[9px] font-bold px-1.5">{assignPage} / {assignTotalPages}</span>
                  <button
                    disabled={assignPage === assignTotalPages || assignIsRunning}
                    onClick={() => setAssignPage(prev => Math.min(assignTotalPages, prev + 1))}
                    className="p-1 hover:bg-background rounded text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Panel: Detailed view and assignment controls */}
            <div className="flex-1 bg-background p-6 overflow-y-auto flex flex-col space-y-6">
              {!assignSelectedPaper ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                  <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <h4 className="font-bold text-sm mb-1 text-foreground">No paper selected</h4>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    Select a literature reference from the left panel list to inspect its metadata and assign it to a calibration pool.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 w-full pb-8">
                  
                  {/* Paper Info Section */}
                  <div className="bg-card border border-border p-5 rounded-xl space-y-3 shrink-0 shadow-sm">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="font-mono text-xs font-bold text-muted-foreground/80 block uppercase">Paper Identification: {assignSelectedPaper.Paper_ID}</span>
                        <h2 className="font-bold text-lg xl:text-xl text-foreground leading-snug mt-0.5">{assignSelectedPaper.Title}</h2>
                      </div>
                      {/* Assignment buttons inside Detail View */}
                      <div className="flex flex-col gap-1.5 shrink-0 select-none">
                        <span className="text-[8px] text-muted-foreground uppercase font-black tracking-wider text-right block mb-0.5">Quick Actions</span>
                        <div className="flex items-center gap-1.5 bg-secondary/35 p-1 rounded-lg border border-border">
                          {[
                            { id: 'pool_a', label: 'Pool A', color: 'hover:bg-indigo-500/10 hover:text-indigo-400' },
                            { id: 'pool_b', label: 'Pool B', color: 'hover:bg-emerald-500/10 hover:text-emerald-400' },
                            { id: 'pool_c', label: 'Pool C', color: 'hover:bg-amber-500/10 hover:text-amber-400' }
                          ].map((pool) => {
                            const isAssigned = assignSelectedPaper.calibration_pool === pool.id;
                            const currentTag = isAssigned ? assignSelectedPaper.calibration_tag : null;
                            const tags = getActiveProjectPoolTags(pool.id);
                            const hasTags = tags.length > 0;
                            const showDropdown = activeAssignDropdown?.paperId === assignSelectedPaper.Paper_ID && activeAssignDropdown?.poolId === pool.id;

                            return (
                              <div key={pool.id} className="relative">
                                <button
                                  type="button"
                                  disabled={assignIsRunning}
                                  onClick={() => {
                                    if (tags.length > 0) {
                                      if (showDropdown) {
                                        setActiveAssignDropdown(null);
                                      } else {
                                        setActiveAssignDropdown({ paperId: assignSelectedPaper.Paper_ID, poolId: pool.id });
                                      }
                                    } else {
                                      handleAssignPool(assignSelectedPaper.Paper_ID, pool.id, null);
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all duration-200 flex items-center gap-1 ${
                                    isAssigned
                                      ? pool.id === 'pool_a' ? 'bg-indigo-50 text-indigo-foreground shadow-sm' :
                                        pool.id === 'pool_b' ? 'bg-emerald-500 text-emerald-foreground shadow-sm' :
                                        'bg-amber-500 text-amber-foreground shadow-sm'
                                      : `text-muted-foreground hover:bg-secondary ${pool.color}`
                                  }`}
                                >
                                  <span>{pool.label}</span>
                                  {currentTag && (
                                    <span className="bg-background/20 px-1 rounded text-[8px] font-bold border border-foreground/10">
                                      {currentTag}
                                    </span>
                                  )}
                                </button>

                                {showDropdown && hasTags && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-40 bg-transparent" 
                                      onClick={() => setActiveAssignDropdown(null)} 
                                    />
                                    <div className="absolute top-full mt-1.5 right-0 bg-popover/95 border border-border shadow-2xl rounded-lg py-1.5 z-50 w-48 text-[10px] font-semibold text-foreground flex flex-col shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
                                      <div className="px-2 pb-1 text-[8px] uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1">
                                        Select Pool Tag
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleAssignPool(assignSelectedPaper.Paper_ID, pool.id, null);
                                          setActiveAssignDropdown(null);
                                        }}
                                        className="px-2.5 py-1.5 text-left hover:bg-secondary transition-colors"
                                      >
                                        No Tag (General)
                                      </button>
                                      {tags.map((tag) => (
                                        <button
                                          key={tag.code}
                                          type="button"
                                          onClick={() => {
                                            handleAssignPool(assignSelectedPaper.Paper_ID, pool.id, tag.code);
                                            setActiveAssignDropdown(null);
                                          }}
                                          className="px-2.5 py-1.5 text-left hover:bg-secondary transition-colors border-t border-border/30"
                                        >
                                          <span className="font-bold text-primary mr-1">{tag.code}</span> - {tag.label}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                          {assignSelectedPaper.calibration_pool && (
                            <button
                              disabled={assignIsRunning}
                              onClick={() => handleAssignPool(assignSelectedPaper.Paper_ID, null)}
                              className="px-2.5 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md text-[9px] font-bold uppercase transition-all duration-200"
                              title="Unassign Paper"
                            >
                              Unassign
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground font-semibold leading-relaxed">
                      Authors: <span className="text-foreground">{assignSelectedPaper.Authors || '—'}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground font-semibold">
                      <p>Year: <span className="text-foreground">{assignSelectedPaper.Year || '—'}</span></p>
                      <p>DOI: <span className="text-foreground font-mono">{assignSelectedPaper.DOI || '—'}</span></p>
                    </div>

                    {assignSelectedPaper.Abstract && (
                      <div className="pt-2 border-t border-border/60">
                        <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block mb-1">Abstract</span>
                        <p className="text-xs xl:text-sm text-foreground font-medium leading-relaxed select-text pt-1">{assignSelectedPaper.Abstract}</p>
                      </div>
                    )}
                  </div>

                  {/* PDF Viewer or Acquisition Panel */}
                  <div className="bg-card border border-border rounded-xl shadow-sm relative shrink-0 overflow-hidden">
                    {/* Pool A: PDF is not required */}
                    {assignSelectedPaper.calibration_pool === 'pool_a' ? (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                        <CheckCircle2 className="w-12 h-12 text-indigo-400 mb-3 animate-bounce" />
                        <h4 className="font-bold text-sm mb-1 text-foreground font-semibold">Paper Assigned to Pool A</h4>
                        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                          Pool A only screens Title and Abstract. Full text PDF file matching is not required for this calibration cohort.
                        </p>
                      </div>
                    ) : (assignSelectedPaper.Local_PDF_Status === 'MATCHED' || assignSelectedPaper.Local_PDF_Status === 'DOWNLOADED' || assignSelectedPaper.Local_PDF_Status === 'SYNCED') && assignSelectedPaper.Local_PDF_Path ? (
                      /* Embed PDF Viewer */
                      <div className="h-[600px] flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-border bg-secondary/15 flex items-center justify-between shrink-0 select-none">
                          <span className="text-[9px] text-emerald-400 uppercase font-black tracking-wider flex items-center gap-1.5 font-bold">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                            PDF Available Inline
                          </span>
                          <a
                            href={`/api/pdf/serve?path=${encodeURIComponent(assignSelectedPaper.Local_PDF_Path)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] font-bold text-primary hover:text-primary/80 transition-colors p-0.5 rounded ml-1 shrink-0"
                            title={`Open ${cloudName} File`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex-1 bg-secondary/20 h-[550px]">
                          <iframe
                            src={`/api/pdf/serve?path=${encodeURIComponent(assignSelectedPaper.Local_PDF_Path)}`}
                            className="w-full h-full border-0"
                            title="Embedded PDF Viewer"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Get PDF Acquisition Area */
                      <div className="border border-border rounded-xl bg-card p-6 select-none flex flex-col min-h-[350px] shrink-0 shadow-sm">
                        <div className={`flex flex-col items-center justify-center text-center py-4 ${assignIsRunning ? 'border-b border-border/40 pb-4 shrink-0' : 'flex-1'}`}>
                          <AlertTriangle className="w-12 h-12 text-amber-500 mb-3 animate-pulse" />
                          <h4 className="font-bold text-sm mb-1 text-foreground">Local PDF Not Found</h4>
                          <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-4">
                            Pool B and Pool C require full-text screening. Trigger PDF matching and crawler scraping specifically for this paper now.
                          </p>
                          
                          <div className="flex flex-wrap items-center justify-center gap-3">
                            <button
                              onClick={() => runSinglePaperPipeline(assignSelectedPaper.Paper_ID)}
                              disabled={assignIsRunning}
                              className={`px-4 py-2 font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wide text-[10px] ${
                                assignIsRunning 
                                  ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50 shadow-none' 
                                  : 'bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-lg'
                              }`}
                            >
                              {assignIsRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                              {assignIsRunning ? 'Acquiring PDF...' : 'Get PDF via Cache Matching & Scraping'}
                            </button>

                            {assignIsRunning && (
                              <button
                                onClick={async () => {
                                  singlePipelineAbortControllerRef.current?.abort();
                                  await fetch('/api/pdf/batch/cancel', { method: 'POST' });
                                }}
                                className="px-4 py-2 border border-border text-[10px] font-bold uppercase rounded-lg hover:bg-secondary text-foreground transition-colors shrink-0"
                              >
                                Cancel
                              </button>
                            )}

                            {assignIsRunning && assignWaitingLogin && (
                              <button
                                onClick={async () => {
                                  setAssignWaitingLogin(false);
                                  await fetch('/api/pdf/batch/resume', { method: 'POST' });
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase rounded-lg text-[10px] tracking-wide shadow-md flex items-center gap-1.5 animate-pulse transition-all hover:scale-105 shrink-0"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                Resume Download
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Real-time single-run console log widget */}
                        {assignIsRunning && (
                          <div className="mt-4 h-64 border border-border/80 rounded-lg bg-black text-emerald-400 font-mono text-[9px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 shadow-inner select-text">
                            {/* console header */}
                            <div className="p-2 border-b border-border/40 bg-zinc-900/60 flex items-center justify-between shrink-0 select-none">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                                Single PDF Pipeline: {assignStatusText}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-emerald-400">{assignProgress}%</span>
                                {assignWaitingLogin && (
                                  <button
                                    onClick={async () => {
                                      await fetch('/api/pdf/batch/resume', { method: 'POST' });
                                    }}
                                    className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase rounded text-[7px]"
                                  >
                                    Resume Login
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    singlePipelineAbortControllerRef.current?.abort();
                                    await fetch('/api/pdf/batch/cancel', { method: 'POST' });
                                  }}
                                  className="px-1.5 py-0.5 bg-destructive hover:bg-destructive/80 text-white font-bold uppercase rounded text-[7px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            {/* logs body */}
                            <div className="flex-1 p-3 overflow-y-auto space-y-1.5">
                              {assignLogs.length === 0 ? (
                                <span className="text-zinc-600 block italic">Spawning subprocess connection...</span>
                              ) : (
                                assignLogs.map((log, index) => (
                                  <div key={index} className="leading-normal whitespace-pre-wrap">{log}</div>
                                ))
                              )}
                              <div ref={logEndRef} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN INTER-RATER DASHBOARD MODAL */}
      {showInterRaterModal && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
          {/* Header */}
          <div className="h-16 px-6 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-5 h-5 text-primary animate-pulse" />
              <div>
                <h3 className="font-bold text-sm">Inter-Rater Dashboard</h3>
                <p className="text-[10px] text-muted-foreground font-medium">Evaluate consensus, reconcile conflicts, and generate blinded calibration reviews</p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowInterRaterModal(false);
                loadCalPapers();
                loadPapers();
              }}
              className="p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fullscreen Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <InterRaterDashboard
              activeProjectId={activeProjectId}
              activeProject={projects.find(p => String(p.id) === String(activeProjectId))}
              showToast={showToast}
              loadCalPapers={loadCalPapers}
              setCalActivePool={setCalActivePool}
            />
          </div>
        </div>
      )}

      <GlobalModals />

      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full select-none pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.4)] border border-border border-l-4 flex gap-3 items-start animate-in slide-in-from-top-5 fade-in duration-300 pointer-events-auto bg-card/95 backdrop-blur-lg text-foreground transition-all duration-300 ${
              toast.type === 'success' ? 'border-l-emerald-500 shadow-emerald-500/5' :
              toast.type === 'error' ? 'border-l-destructive shadow-destructive/5' :
              toast.type === 'warning' ? 'border-l-amber-500 shadow-amber-500/5' :
              'border-l-primary shadow-primary/5'
            }`}
          >
            {toast.type === 'success' && <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-destructive mt-0.5" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />}
            {toast.type === 'info' && <AlertCircle className="w-4 h-4 shrink-0 text-primary mt-0.5" />}
            <div className="flex-1 text-xs font-semibold leading-relaxed pr-2 select-text">
              {toast.message}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="p-1 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
    </AppStateProvider>
  );
}

function LoaderIcon() {
  return (
    <svg className="w-6 h-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
