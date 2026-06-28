import React from 'react';
import { 
  Plus, Check, X, Layers, Calendar, CheckCircle2,
  AlertCircle, RefreshCw, Settings, Trash2, ExternalLink, Loader2
} from 'lucide-react';

import LLMConfigView from './LLMConfigView';
import PromptLibraryView from './PromptLibraryView';
import MetricSummaryCards from './dashboard/MetricSummaryCards';
import LocalPDFStatusChart from './dashboard/LocalPDFStatusChart';
import ProjectActivityLog from './dashboard/ProjectActivityLog';
import DashboardQuickActions from './dashboard/DashboardQuickActions';
import { useAppState } from '@/hooks/AppStateProvider';

export default function DashboardView() {
  const { 
    showToast, activeProject, activeProjectId, projects, activateProject, loadProjects, showCreateProjectModal, 
    setShowCreateProjectModal, showEditProjectModal, setShowEditProjectModal, handleCreateProject, 
    handleSaveProjectManifesto, runBatchExecution, pipelineStats, currentStep, openProjectSettings,
    savingProject, deletingProject, deleteProjectConfirm, setDeleteProjectConfirm, deleteProjectConfirmationText,
    setDeleteProjectConfirmationText, newProjName, setNewProjName, newProjFolder, setNewProjFolder, newProjManifesto,
    setNewProjManifesto, newProjObjective, setNewProjObjective, newProjQuestions, setNewProjQuestions, newProjQaDefinition,
    setNewProjQaDefinition, newProjExclusionCriteria, setNewProjExclusionCriteria, newProjPoolA, setNewProjPoolA,
    newProjPoolB, setNewProjPoolB, newProjPoolC, setNewProjPoolC, newProjGDriveDest, setNewProjGDriveDest,
    newProjCloudProvider, setNewProjCloudProvider, newProjRemoteName, setNewProjRemoteName, newProjPoolTags,
    setNewProjPoolTags, projectFormName, setProjectFormName, projectFormManifesto, setProjectFormManifesto,
    projectFormObjective, setProjectFormObjective, projectFormQuestions, setProjectFormQuestions, projectFormQaDefinition,
    setProjectFormQaDefinition, projectFormExclusionCriteria, setProjectFormExclusionCriteria, projectFormPoolA,
    setProjectFormPoolA, projectFormPoolB, setProjectFormPoolB, projectFormPoolC, setProjectFormPoolC,
    projectFormGDriveDest, setProjectFormGDriveDest, projectFormCloudProvider, setProjectFormCloudProvider,
    projectFormRemoteName, setProjectFormRemoteName, projectFormPoolTags, setProjectFormPoolTags, projectFormEcRules,
    setProjectFormEcRules, projectFormReasoningTemplate, setProjectFormReasoningTemplate, handleTestProjectConnection,
    testingProjectConnection, projectConnectionTestResult, handleAddPoolTag, handleUpdatePoolTag, handleRemovePoolTag,
    handleAddEcRule, handleUpdateEcRule, handleRemoveEcRule, handleAddReasoningTemplate, handleUpdateReasoningTemplate,
    handleRemoveReasoningTemplate, projectSettingsTab, setProjectSettingsTab, compressOnSync, setCompressOnSync,
    editingProjectId, setEditingProjectId, batchSteps, setBatchSteps,
    projectFormPoolBEcRules, setProjectFormPoolBEcRules, projectFormPoolBReasoningTemplate, setProjectFormPoolBReasoningTemplate,
    projectFormPoolCQaRules, setProjectFormPoolCQaRules, projectFormPoolCExtractionRules, setProjectFormPoolCExtractionRules,
    handleAddPoolBEcRule, handleUpdatePoolBEcRule, handleRemovePoolBEcRule,
    handleAddPoolBReasoningTemplate, handleUpdatePoolBReasoningTemplate, handleRemovePoolBReasoningTemplate,
    handleAddPoolCQaRule, handleUpdatePoolCQaRule, handleRemovePoolCQaRule,
    handleAddPoolCExtractionRule, handleUpdatePoolCExtractionRule, handleRemovePoolCExtractionRule
  } = useAppState();
  const [calibrationSubTab, setCalibrationSubTab] = React.useState('pool_a');

  const activeProj = projects.find((p: any) => p.id === activeProjectId) || activeProject;

  return (
    <>
      <div className="h-full flex flex-col overflow-y-auto space-y-6 animate-in fade-in duration-200">
        
        {/* TOP METRICS ROW */}
        <MetricSummaryCards activeProject={activeProj} />

        {/* LOCAL PDF STATUS DISTRIBUTION CHART */}
        <LocalPDFStatusChart activeProject={activeProj} />

        {/* PROJECT ACTIVITY & PROTOCOL LOG */}
        <ProjectActivityLog activeProject={activeProj} />

        {/* EXECUTIVE QUICK ACTIONS */}
        <DashboardQuickActions 
          activeProject={activeProj}
          setShowCreateProjectModal={setShowCreateProjectModal}
          openProjectSettings={openProjectSettings}
          showToast={showToast}
        />

        {/* Full-Page Projects Manager */}
        <div className="bg-card border border-border rounded-xl shadow-md p-6 space-y-4 w-full">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="space-y-1">
              <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Projects Manager
              </h3>
              <p className="text-[10px] text-muted-foreground">Manage systematic review scopes, cloud configurations, targets and calibration pools.</p>
            </div>
            <button
              onClick={() => setShowCreateProjectModal(true)}
              className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-[10px] font-bold uppercase rounded-lg flex items-center gap-1 transition-colors shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[9px] text-muted-foreground uppercase font-black tracking-wider bg-secondary/15 select-none">
                  <th className="py-3 px-3">Project details</th>
                  <th className="py-3 px-3">Cloud Configuration</th>
                  <th className="py-3 px-3 text-center">Screening rate</th>
                  <th className="py-3 px-3 text-center">PDF Acquisition</th>
                  <th className="py-3 px-3 text-center">Calibration Pools</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {projects.map((proj: any) => {
                  const isActive = proj.id === activeProjectId;
                  
                  // stats calculations
                  const stats = proj.stats || { total: 0, screened: 0, acquired: 0, synced: 0, pool_a_count: 0, pool_b_count: 0, pool_c_count: 0 };
                  const screenedPct = stats.total > 0 ? Math.round((stats.screened / stats.total) * 100) : 0;
                  const acquiredPct = stats.total > 0 ? Math.round((stats.acquired / stats.total) * 100) : 0;
                  
                  const projCloudProvider = proj.cloud_provider || 'gdrive';
                  const projRemote = proj.rclone_remote_name || (projCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive');
                  const projDest = proj.gdrive_dest_path || 'SLR_Magic/PDFs';

                  return (
                    <tr key={proj.id} className={`hover:bg-secondary/15 transition-colors ${isActive ? 'bg-primary/5' : ''}`}>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-foreground text-sm flex items-center gap-2">
                          {proj.name}
                          {isActive && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded text-[8px] font-black uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">slug: {proj.folder_name}</div>
                        <div className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground/40" />
                          Created: {new Date(proj.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            {projCloudProvider === 'onedrive' ? (
                              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-bold">
                                OneDrive
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-bold">
                                Google Drive
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-muted-foreground bg-secondary/35 px-1 py-0.5 rounded border border-border">
                              {projRemote}:
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-muted-foreground max-w-[200px] truncate" title={`${projDest}/${proj.folder_name}`}>
                            {projDest}/{proj.folder_name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5 min-w-[100px]">
                          <div className="text-[11px] font-mono font-bold text-foreground">
                            {stats.screened} <span className="text-muted-foreground font-normal">/ {stats.total}</span>
                          </div>
                          <div className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1 py-0.5 rounded">
                            {screenedPct}% screened
                          </div>
                          <div className="w-24 bg-secondary rounded-full h-1.5 overflow-hidden border border-border/30">
                            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${screenedPct}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5 min-w-[100px]">
                          <div className="text-[11px] font-mono font-bold text-foreground">
                            {stats.acquired} <span className="text-muted-foreground font-normal">/ {stats.total}</span>
                          </div>
                          <div className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">
                            {acquiredPct}% acquired
                          </div>
                          <div className="w-24 bg-secondary rounded-full h-1.5 overflow-hidden border border-border/30">
                            <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${acquiredPct}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-start gap-1 font-mono text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="font-bold text-foreground/80">Pool A:</span> {stats.pool_a_count} <span className="text-[9px] text-muted-foreground/50">/ {proj.pool_a_size || 50}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                            <span className="font-bold text-foreground/80">Pool B:</span> {stats.pool_b_count} <span className="text-[9px] text-muted-foreground/50">/ {proj.pool_b_size || 30}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                            <span className="font-bold text-foreground/80">Pool C:</span> {stats.pool_c_count} <span className="text-[9px] text-muted-foreground/50">/ {proj.pool_c_size || 20}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => openProjectSettings(proj)}
                            className="p-1.5 bg-secondary text-foreground hover:bg-secondary/80 border border-border rounded-lg transition-colors flex items-center justify-center"
                            title="Configure Project Settings"
                          >
                            <Settings className="w-4 h-4 text-primary" />
                          </button>
                          
                          <button
                            onClick={() => setDeleteProjectConfirm({ isOpen: true, projectId: proj.id, projectName: proj.name })}
                            className="p-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 rounded-lg transition-colors flex items-center justify-center"
                            title="Delete Project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-[9px] font-bold uppercase tracking-wider select-none">
                              <Check className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <button
                              onClick={() => activateProject(proj.id)}
                              className="px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/95 text-[10px] font-bold uppercase rounded-lg transition-all shadow-sm hover:shadow"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* NEW PROJECT MODAL OVERLAY */}
        {showCreateProjectModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/15">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-primary" />
                  Create New Project Scope
                </h3>
                <button
                  onClick={() => setShowCreateProjectModal(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Project Name *</label>
                    <input
                      type="text"
                      required
                      value={newProjName}
                      onChange={(e) => setNewProjName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                      placeholder="e.g. SLR Magic Validation"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Unique Folder Name (Slug) *</label>
                    <input
                      type="text"
                      required
                      value={newProjFolder}
                      onChange={(e) => setNewProjFolder(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
                      placeholder="e.g. slr_magic_validation"
                    />
                    <p className="text-[8px] text-muted-foreground mt-0.5">Used for specialized pdf_library/repo folder</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Destination Path</label>
                    <input
                      type="text"
                      value={newProjGDriveDest}
                      onChange={(e) => setNewProjGDriveDest(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                      placeholder="SLR_Magic/PDFs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Provider</label>
                    <select
                      value={newProjCloudProvider}
                      onChange={(e) => setNewProjCloudProvider(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
                    >
                      <option value="gdrive">Google Drive</option>
                      <option value="onedrive">Microsoft OneDrive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Remote Name</label>
                    <input
                      type="text"
                      value={newProjRemoteName}
                      onChange={(e) => setNewProjRemoteName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
                      placeholder={newProjCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Manifesto</label>
                  <textarea
                    rows={2}
                    value={newProjManifesto}
                    onChange={(e) => setNewProjManifesto(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                    placeholder="What is this systematic literature review about?"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Objective</label>
                  <textarea
                    rows={2}
                    value={newProjObjective}
                    onChange={(e) => setNewProjObjective(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                    placeholder="What are the key goals and objectives?"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Questions</label>
                  <textarea
                    rows={2}
                    value={newProjQuestions}
                    onChange={(e) => setNewProjQuestions(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
                    placeholder="RQ1: ...&#10;RQ2: ..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Quality Assurance Definition</label>
                    <textarea
                      rows={2}
                      value={newProjQaDefinition}
                      onChange={(e) => setNewProjQaDefinition(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                      placeholder="Define QA check bounds..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Exclusion Criteria</label>
                    <textarea
                      rows={2}
                      value={newProjExclusionCriteria}
                      onChange={(e) => setNewProjExclusionCriteria(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                      placeholder="What papers must be discarded?"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="block text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2">Pre-Calibration Pools Target Size</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pool A Target</label>
                      <input
                        type="number"
                        value={newProjPoolA}
                        onChange={(e) => setNewProjPoolA(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pool B Target</label>
                      <input
                        type="number"
                        value={newProjPoolB}
                        onChange={(e) => setNewProjPoolB(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pool C Target</label>
                      <input
                        type="number"
                        value={newProjPoolC}
                        onChange={(e) => setNewProjPoolC(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateProjectModal(false)}
                    className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold rounded-lg text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProject}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                  >
                    {savingProject && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT PROJECT SETTINGS MODAL OVERLAY */}
        {showEditProjectModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
              
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/15">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">
                    Project Settings: <span className="text-primary">{projectFormName}</span>
                  </h3>
                </div>
                <button
                  onClick={() => setShowEditProjectModal(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-border bg-secondary/5 px-4 select-none">
                <button
                  type="button"
                  onClick={() => setProjectSettingsTab('metadata')}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                    projectSettingsTab === 'metadata' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Research Metadata
                </button>
                <button
                  type="button"
                  onClick={() => setProjectSettingsTab('calibration')}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                    projectSettingsTab === 'calibration' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pre-Calibration Sampling
                </button>
                <button
                  type="button"
                  onClick={() => setProjectSettingsTab('sync')}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                    projectSettingsTab === 'sync' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cloud Sync Configuration
                </button>
                <button
                  type="button"
                  onClick={() => setProjectSettingsTab('llm')}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                    projectSettingsTab === 'llm' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  LLM Configuration
                </button>
                <button
                  type="button"
                  onClick={() => setProjectSettingsTab('prompts')}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
                    projectSettingsTab === 'prompts' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Project Prompts
                </button>
              </div>

              {/* Form Container */}
              <form onSubmit={handleSaveProjectManifesto} className="flex-1 overflow-y-auto flex flex-col min-h-0">
                <div className="p-6 space-y-4 flex-1">
                  
                  {/* Tab Content: Metadata */}
                  {projectSettingsTab === 'metadata' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Project Name</label>
                        <input
                          type="text"
                          value={projectFormName}
                          onChange={(e) => setProjectFormName(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                          placeholder="Enter project name..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Manifesto</label>
                        <textarea
                          rows={5}
                          value={projectFormManifesto}
                          onChange={(e) => setProjectFormManifesto(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold min-h-[120px] leading-relaxed"
                          placeholder="What is this systematic literature review about?"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Objective</label>
                        <textarea
                          rows={5}
                          value={projectFormObjective}
                          onChange={(e) => setProjectFormObjective(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold min-h-[120px] leading-relaxed"
                          placeholder="What are the key goals and objectives?"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Questions</label>
                        <textarea
                          rows={5}
                          value={projectFormQuestions}
                          onChange={(e) => setProjectFormQuestions(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono min-h-[120px] leading-relaxed"
                          placeholder="RQ1: ...&#10;RQ2: ..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Quality Assurance Definition</label>
                          <textarea
                            rows={5}
                            value={projectFormQaDefinition}
                            onChange={(e) => setProjectFormQaDefinition(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold min-h-[120px] leading-relaxed"
                            placeholder="Define QA check bounds..."
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Exclusion Criteria</label>
                          <textarea
                            rows={5}
                            value={projectFormExclusionCriteria}
                            onChange={(e) => setProjectFormExclusionCriteria(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold min-h-[120px] leading-relaxed"
                            placeholder="What papers must be discarded?"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab Content: Pre-Calibration */}
                  {projectSettingsTab === 'calibration' && (
                    <div className="space-y-4">
                      <div className="bg-secondary/15 border border-border rounded-lg p-4 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
                        <p className="font-bold text-foreground">Calibration Guidelines:</p>
                        <p>Before launching consensus screening, projects are segmented into calibration targets to test screening alignment.</p>
                        <p>Adjust target sizes and define classification tags for each pool below.</p>
                      </div>

                      {/* Pool Sub-tabs */}
                      <div className="flex border-b border-border/80 text-[10px] font-bold uppercase tracking-wider gap-4 pb-0.5 select-none">
                        {[
                          { id: 'pool_a', name: 'Pool A (Fast Filter)' },
                          { id: 'pool_b', name: 'Pool B (Consensus)' },
                          { id: 'pool_c', name: 'Pool C (Consensus + QA)' }
                        ].map((subTab) => (
                          <button
                            key={subTab.id}
                            type="button"
                            onClick={() => setCalibrationSubTab(subTab.id as any)}
                            className={`pb-2 transition-all relative ${
                              calibrationSubTab === subTab.id
                                ? 'text-foreground border-b-2 border-primary font-black'
                                : 'text-muted-foreground hover:text-foreground font-semibold'
                            }`}
                          >
                            {subTab.name}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-4 pt-1">
                        <div>
                          <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            {calibrationSubTab === 'pool_a' ? 'Pool A Target Size' : calibrationSubTab === 'pool_b' ? 'Pool B Target Size' : 'Pool C Target Size'}
                          </label>
                          <input
                            type="number"
                            value={
                              calibrationSubTab === 'pool_a' ? projectFormPoolA : calibrationSubTab === 'pool_b' ? projectFormPoolB : projectFormPoolC
                            }
                            onChange={(e) => {
                              if (calibrationSubTab === 'pool_a') setProjectFormPoolA(e.target.value);
                              else if (calibrationSubTab === 'pool_b') setProjectFormPoolB(e.target.value);
                              else setProjectFormPoolC(e.target.value);
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-mono font-bold"
                          />
                        </div>

                        {/* Sub-tab specific configurations */}
                        {(() => {
                          const isPoolA = calibrationSubTab === 'pool_a';
                          const isPoolB = calibrationSubTab === 'pool_b';
                          const isPoolC = calibrationSubTab === 'pool_c';

                          const tags = isPoolA ? projectFormPoolTags : [];
                          const ecRules = isPoolB ? projectFormPoolBEcRules : projectFormEcRules;
                          const reasoningTemplates = isPoolB ? projectFormPoolBReasoningTemplate : projectFormReasoningTemplate;

                          const onAddTag = isPoolA ? handleAddPoolTag : () => {};
                          const onUpdateTag = isPoolA ? handleUpdatePoolTag : () => {};
                          const onRemoveTag = isPoolA ? handleRemovePoolTag : () => {};

                          const onAddEcRule = isPoolB ? handleAddPoolBEcRule : handleAddEcRule;
                          const onUpdateEcRule = isPoolB ? handleUpdatePoolBEcRule : handleUpdateEcRule;
                          const onRemoveEcRule = isPoolB ? handleRemovePoolBEcRule : handleRemoveEcRule;

                          const onAddReasoningTemplate = isPoolB ? handleAddPoolBReasoningTemplate : handleAddReasoningTemplate;
                          const onUpdateReasoningTemplate = isPoolB ? handleUpdatePoolBReasoningTemplate : handleUpdateReasoningTemplate;
                          const onRemoveReasoningTemplate = isPoolB ? handleRemovePoolBReasoningTemplate : handleRemoveReasoningTemplate;

                          if (isPoolA) {
                            return (
                              <div className="pt-4 mt-4 border-t border-border/50 space-y-4">
                                <div className="flex items-center justify-between mb-1">
                                  <div>
                                    <h4 className="text-[11px] font-bold text-foreground">Classification Tags (Pool A)</h4>
                                    <p className="text-[9px] text-muted-foreground">Define custom tag labels for fast initial filtering.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={onAddTag}
                                    className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Tag
                                  </button>
                                </div>

                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                  {tags.length === 0 ? (
                                    <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                                      No tags defined. Click 'Add Tag' to create custom classifications.
                                    </div>
                                  ) : (
                                    tags.map((tag: any, idx: any) => (
                                      <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                                        <div className="w-1/3">
                                          <input
                                            type="text"
                                            value={tag.label}
                                            onChange={(e) => onUpdateTag(idx, 'label', e.target.value)}
                                            className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-bold"
                                            placeholder="Tag Label"
                                            required
                                          />
                                        </div>
                                        <div className="flex-1">
                                          <input
                                            type="text"
                                            value={tag.description}
                                            onChange={(e) => onUpdateTag(idx, 'description', e.target.value)}
                                            className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
                                            placeholder="Tag Description..."
                                            required
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => onRemoveTag(idx)}
                                          className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          } else if (isPoolB) {
                            return (
                              <div className="pt-4 mt-4 border-t border-border/50 space-y-6">
                                {/* EC Rules Section */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <h4 className="text-[11px] font-bold text-foreground">Exclusion Criteria Rules (Pool B)</h4>
                                      <p className="text-[9px] text-muted-foreground">Define explicit exclusion rule keys for consensus filtering.</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={onAddEcRule}
                                      className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Add Rule
                                    </button>
                                  </div>

                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {ecRules.length === 0 ? (
                                      <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                                        No exclusion rules defined. Click 'Add Rule' to define criteria.
                                      </div>
                                    ) : (
                                      ecRules.map((rule: any, idx: any) => (
                                        <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                                          <div className="w-1/4">
                                            <input
                                              type="text"
                                              value={rule.code}
                                              onChange={(e) => onUpdateEcRule(idx, 'code', e.target.value)}
                                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono"
                                              placeholder="Rule Code"
                                              required
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <input
                                              type="text"
                                              value={rule.description}
                                              onChange={(e) => onUpdateEcRule(idx, 'description', e.target.value)}
                                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
                                              placeholder="Rule Description..."
                                              required
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => onRemoveEcRule(idx)}
                                            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>

                                {/* Reasoning Template Section */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <h4 className="text-[11px] font-bold text-foreground">Reasoning Templates</h4>
                                      <p className="text-[9px] text-muted-foreground">Pre-defined rationale strings for review decisions.</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={onAddReasoningTemplate}
                                      className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Add Template
                                    </button>
                                  </div>

                                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                    {reasoningTemplates.length === 0 ? (
                                      <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                                        No templates defined. Click 'Add Template' to define rationales.
                                      </div>
                                    ) : (
                                      reasoningTemplates.map((tmpl: any, idx: any) => (
                                        <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                                          <div className="flex-1">
                                            <input
                                              type="text"
                                              value={tmpl}
                                              onChange={(e) => onUpdateReasoningTemplate(idx, e.target.value)}
                                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
                                              placeholder="Template text..."
                                              required
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => onRemoveReasoningTemplate(idx)}
                                            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (isPoolC) {
                            // Fetch QA questions line-by-line
                            const qaQuestions = (projectFormQaDefinition || '')
                              .split('\n')
                              .map((line: string) => line.trim())
                              .filter(Boolean);

                            // Fetch research questions line-by-line
                            const researchQuestions = (projectFormQuestions || '')
                              .split('\n')
                              .map((line: string) => line.trim())
                              .filter(Boolean);

                            return (
                              <div className="pt-4 mt-4 border-t border-border/50 space-y-6">
                                {/* QA Rules Section */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <h4 className="text-[11px] font-bold text-foreground">Quality Assessment Rules (QA Mapping)</h4>
                                      <p className="text-[9px] text-muted-foreground">Map a custom short code to a project Quality Appraisal question.</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleAddPoolCQaRule}
                                      className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Add Rule
                                    </button>
                                  </div>

                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {projectFormPoolCQaRules.length === 0 ? (
                                      <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                                        No QA mapping rules defined. Click 'Add Rule' to map code to question.
                                      </div>
                                    ) : (
                                      projectFormPoolCQaRules.map((rule: any, idx: any) => (
                                        <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                                          <div className="w-1/4">
                                            <input
                                              type="text"
                                              value={rule.code}
                                              onChange={(e) => handleUpdatePoolCQaRule(idx, 'code', e.target.value)}
                                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono"
                                              placeholder="QA Code"
                                              required
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <select
                                              value={rule.question}
                                              onChange={(e) => handleUpdatePoolCQaRule(idx, 'question', e.target.value)}
                                              className="w-full px-2 py-1.5 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
                                              required
                                            >
                                              <option value="">-- Select QA Question --</option>
                                              {qaQuestions.map((q: string, qIdx: number) => (
                                                <option key={qIdx} value={q}>{q}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0 px-2 select-none border-l border-border/50">
                                            <input
                                              type="checkbox"
                                              id={`fatal-flaw-${idx}`}
                                              checked={!!rule.is_fatal_flaw}
                                              onChange={(e) => handleUpdatePoolCQaRule(idx, 'is_fatal_flaw', e.target.checked)}
                                              className="w-3 h-3 rounded border-border text-primary bg-secondary/35 focus:ring-primary focus:ring-opacity-25 cursor-pointer"
                                            />
                                            <label htmlFor={`fatal-flaw-${idx}`} className="text-[9px] font-bold text-muted-foreground cursor-pointer uppercase tracking-wider">
                                              Fatal Flaw
                                            </label>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePoolCQaRule(idx)}
                                            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>

                                {/* Data Extraction Section */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <h4 className="text-[11px] font-bold text-foreground">Data Extraction Rules (JSON Mapping)</h4>
                                      <p className="text-[9px] text-muted-foreground">Map a target JSON key to a project Research Question.</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleAddPoolCExtractionRule}
                                      className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Add Key Map
                                    </button>
                                  </div>

                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {projectFormPoolCExtractionRules.length === 0 ? (
                                      <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                                        No extraction mapping rules defined. Click 'Add Key Map' to map JSON key to question.
                                      </div>
                                    ) : (
                                      projectFormPoolCExtractionRules.map((rule: any, idx: any) => (
                                        <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                                          <div className="w-1/4">
                                            <input
                                              type="text"
                                              value={rule.json_key}
                                              onChange={(e) => handleUpdatePoolCExtractionRule(idx, 'json_key', e.target.value)}
                                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono"
                                              placeholder="JSON Key"
                                              required
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <select
                                              value={rule.question}
                                              onChange={(e) => handleUpdatePoolCExtractionRule(idx, 'question', e.target.value)}
                                              className="w-full px-2 py-1.5 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
                                              required
                                            >
                                              <option value="">-- Select Research Question --</option>
                                              {researchQuestions.map((q: string, qIdx: number) => (
                                                <option key={qIdx} value={q}>{q}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePoolCExtractionRule(idx)}
                                            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Tab Content: Sync */}
                  {projectSettingsTab === 'sync' && (
                    <div className="space-y-4">
                      <div className="bg-secondary/15 border border-border rounded-lg p-4 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
                        <p className="font-bold text-foreground">Sync Guidelines:</p>
                        <p>Configuring these properties enables the Rclone background synchronizer to link database entries and push/pull cached resources to and from cloud storage.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Provider</label>
                          <select
                            value={projectFormCloudProvider}
                            onChange={(e) => setProjectFormCloudProvider(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
                          >
                            <option value="gdrive">Google Drive</option>
                            <option value="onedrive">Microsoft OneDrive</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Rclone Remote Name</label>
                          <input
                            type="text"
                            value={projectFormRemoteName}
                            onChange={(e) => setProjectFormRemoteName(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
                            placeholder={projectFormCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive'}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Destination Path</label>
                        <input
                          type="text"
                          value={projectFormGDriveDest}
                          onChange={(e) => setProjectFormGDriveDest(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                          placeholder="e.g. SLR_Magic/PDFs"
                          required
                        />
                      </div>

                      {/* Connection Test and Setup Help */}
                      <div className="pt-2 border-t border-border/60 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            disabled={testingProjectConnection}
                            onClick={handleTestProjectConnection}
                            className="px-3.5 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                          >
                            {testingProjectConnection ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            Test Connection
                          </button>
                          
                          {projectConnectionTestResult && (
                            <div className={`flex-1 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                              projectConnectionTestResult.success 
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
                                : 'bg-destructive/10 text-destructive border-destructive/25'
                            }`}>
                              {projectConnectionTestResult.success ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                              ) : (
                                <AlertCircle className="w-4 h-4 shrink-0" />
                              )}
                              <span className="truncate">{projectConnectionTestResult.message}</span>
                            </div>
                          )}
                        </div>

                        {projectConnectionTestResult && !projectConnectionTestResult.success && projectConnectionTestResult.details && (
                          <div className="text-[11px] font-mono bg-destructive/5 text-destructive/95 p-2.5 rounded-lg border border-destructive/10 whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {projectConnectionTestResult.details}
                          </div>
                        )}

                        <div className="bg-secondary/10 border border-border/40 rounded-lg p-3 text-[11px] text-muted-foreground leading-relaxed space-y-1">
                          <p className="font-semibold text-foreground flex items-center gap-1">
                            <span>Need help setting up?</span>
                          </p>
                          <p>To set up a cloud provider remote, install Rclone on your system, run <code className="bg-secondary/50 px-1 py-0.5 rounded font-mono text-foreground">rclone config</code> in your terminal, and create a remote named <code className="bg-secondary/50 px-1 py-0.5 rounded font-mono text-foreground">{projectFormRemoteName || (projectFormCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive')}</code>.</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 font-semibold text-primary">
                            <a 
                              href={projectFormCloudProvider === 'onedrive' ? "https://rclone.org/onedrive/" : "https://rclone.org/drive/"} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="hover:underline flex items-center gap-0.5 inline-flex"
                            >
                              <span>Rclone {projectFormCloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive'} Setup Guide</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <a 
                              href="https://rclone.org/" 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="hover:underline flex items-center gap-0.5 inline-flex"
                            >
                              <span>rclone.org</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Tab Content: LLM Configuration */}
                  {projectSettingsTab === 'llm' && (
                    <div className="flex-1 min-h-0 h-full">
                      <LLMConfigView activeProject={projects.find((p: any) => p.id === editingProjectId)} loadProjects={loadProjects} showToast={showToast} />
                    </div>
                  )}

                  {/* Tab Content: Project Prompts */}
                  {projectSettingsTab === 'prompts' && (
                    <div className="flex-1 min-h-0 h-full">
                      <PromptLibraryView projectId={editingProjectId} showToast={showToast} />
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex justify-end gap-3 bg-secondary/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowEditProjectModal(false)}
                    className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold rounded-lg text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProject}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                  >
                    {savingProject && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Save Configurations
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
