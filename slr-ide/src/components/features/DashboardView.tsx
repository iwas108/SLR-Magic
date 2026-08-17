import React, { useState } from 'react';
import { 
  Plus, Settings, Trash2, Layers, Calendar, Check, Archive, UploadCloud, 
  Search, Play, Sparkles, Folder, DollarSign, Database, HardDrive, ShieldCheck, ChevronRight
} from 'lucide-react';

import MetricSummaryCards from './dashboard/MetricSummaryCards';
import LocalPDFStatusChart from './dashboard/LocalPDFStatusChart';
import ProjectActivityLog from './dashboard/ProjectActivityLog';

interface DashboardViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  showCreateProjectModal: boolean;
  setShowCreateProjectModal: React.Dispatch<React.SetStateAction<boolean>>;
  showEditProjectModal: boolean;
  setShowEditProjectModal: React.Dispatch<React.SetStateAction<boolean>>;
  openProjectSettings: (proj: any) => void;
  savingProject: boolean;
  deletingProject: string | null;
  deleteProjectConfirm: any;
  setDeleteProjectConfirm: React.Dispatch<React.SetStateAction<any>>;
  deleteProjectConfirmationText: string;
  setDeleteProjectConfirmationText: React.Dispatch<React.SetStateAction<string>>;
  
  editingProject: any;
  projectSettingsInitialTab?: 'metadata' | 'calibration' | 'sync' | 'llm';
  setActiveTab: (tab: string) => void;
  setShowImportModal?: (val: boolean) => void;
  onOpenArchive?: (proj: any) => void;
  projectsHook: {
    projects: any[];
    activeProjectId: string;
    activeProject: any;
    activateProject: (id: string) => Promise<void>;
    loadProjects: () => Promise<any>;
    createProject: (data: any) => Promise<boolean>;
    updateProject: (id: string, data: any) => Promise<boolean>;
    deleteProject: (id: string) => Promise<boolean>;
    archiveProject?: (id: string, options: any) => Promise<boolean>;
    importProject?: (archiveData: any, onSuccess?: (newId: string) => void) => Promise<boolean>;
    handleTestProjectConnection: (provider: string, remoteName: string) => Promise<void>;
    testingProjectConnection: boolean;
    projectConnectionTestResult: any;
  };
}

export default function DashboardView({
  showToast,
  setShowCreateProjectModal,
  openProjectSettings,
  setDeleteProjectConfirm,
  setActiveTab,
  setShowImportModal = () => {},
  onOpenArchive,
  projectsHook
}: DashboardViewProps) {
  const {
    projects,
    activeProjectId,
    activeProject,
    activateProject
  } = projectsHook;

  const [projectSearchTerm, setProjectSearchTerm] = useState('');

  React.useEffect(() => {
    if (projectsHook?.loadProjects) {
      projectsHook.loadProjects();
    }
  }, []);

  const activeProj = projects.find((p: any) => String(p.id) === String(activeProjectId)) || activeProject;

  // Active Project Metric Calculations
  const stats = activeProj?.stats || { total: 0, screened: 0, acquired: 0, synced: 0, duplicates: 0 };
  const screenedPct = stats.total > 0 ? Math.round((stats.screened / stats.total) * 100) : 0;
  const acquiredPct = stats.total > 0 ? Math.round((stats.acquired / stats.total) * 100) : 0;
  
  const budgetLimit = activeProj?.project_budget_limit || 0;
  const currentSpend = activeProj?.project_current_spend || 0;
  const spendPct = budgetLimit > 0 ? Math.round((currentSpend / budgetLimit) * 100) : 0;

  // Filtered Projects for Data Table
  const filteredProjects = projects.filter((p: any) => {
    if (!projectSearchTerm.trim()) return true;
    const term = projectSearchTerm.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.folder_name && p.folder_name.toLowerCase().includes(term)) ||
      (p.cloud_provider && p.cloud_provider.toLowerCase().includes(term))
    );
  });

  return (
    <div className="h-full flex flex-col overflow-y-auto space-y-6 animate-in fade-in duration-200">
      
      {/* 1. EXECUTIVE HERO COMMAND BANNER */}
      <div className="relative bg-card border border-border/80 rounded-2xl shadow-xl overflow-hidden p-6 backdrop-blur-xl">
        {/* Top Decorative Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Active Project Identification */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Review Scope
              </span>
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded border border-border/60">
                slug: {activeProj?.folder_name || 'none'}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded border border-border/60 capitalize">
                {activeProj?.cloud_provider === 'onedrive' ? 'OneDrive' : 'Google Drive'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              {activeProj?.name || 'No Active Project Selected'}
            </h2>

            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed line-clamp-2">
              {activeProj?.manifesto || 'No manifesto defined. Use project settings to configure literature review parameters and exclusion criteria.'}
            </p>
          </div>

          {/* Quick Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                if (activeProj) openProjectSettings(activeProj);
                else showToast('No active project to configure', 'warning');
              }}
              className="px-3.5 py-2 bg-secondary/80 hover:bg-secondary text-foreground border border-border font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <Settings className="w-3.5 h-3.5 text-primary" />
              Settings
            </button>

            <button
              onClick={() => setActiveTab('pipeline-data-acquisition')}
              className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5" />
              Acquisition Pipeline
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2 bg-secondary/80 hover:bg-secondary text-foreground border border-border font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <UploadCloud className="w-3.5 h-3.5 text-primary" />
              Import Archive
            </button>

            <button
              onClick={() => setShowCreateProjectModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>

        {/* High-Level Overview Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border/60">
          <div className="bg-secondary/15 p-3 rounded-xl border border-border/50">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Total Ingested Papers</span>
            <div className="text-lg font-mono font-bold text-foreground">{stats.total}</div>
            <span className="text-[9px] text-muted-foreground">{stats.duplicates > 0 ? `(${stats.duplicates} duplicates excluded)` : 'Unique literature cohort'}</span>
          </div>

          <div className="bg-secondary/15 p-3 rounded-xl border border-border/50">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Screening Progression</span>
            <div className="text-lg font-mono font-bold text-emerald-500">{screenedPct}%</div>
            <span className="text-[9px] text-muted-foreground">{stats.screened} of {stats.total} screened</span>
          </div>

          <div className="bg-secondary/15 p-3 rounded-xl border border-border/50">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">PDF Asset Acquisition</span>
            <div className="text-lg font-mono font-bold text-blue-500">{acquiredPct}%</div>
            <span className="text-[9px] text-muted-foreground">{stats.acquired} local PDFs cached</span>
          </div>

          <div className="bg-secondary/15 p-3 rounded-xl border border-border/50">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Budget Spent</span>
            <div className="text-lg font-mono font-bold text-foreground" title={`$${currentSpend.toFixed(4)}`}>
              ${currentSpend < 1 && currentSpend > 0 ? currentSpend.toFixed(4) : currentSpend.toFixed(2)}
            </div>
            <span className="text-[9px] text-muted-foreground">of ${budgetLimit.toFixed(2)} limit ({spendPct}%)</span>
          </div>
        </div>
      </div>

      {/* 2. 4-STAGE PIPELINE FUNNEL BREAKDOWN */}
      <MetricSummaryCards activeProject={activeProj} />

      {/* 3. STORAGE & CLOUD MIRROR TELEMETRY */}
      <LocalPDFStatusChart activeProject={activeProj} />

      {/* 4. PROTOCOL MANIFESTO & ACTIVE SCOPE LOG */}
      <ProjectActivityLog activeProject={activeProj} />

      {/* 5. PROJECTS MANAGER REPOSITORY TABLE */}
      <div className="bg-card border border-border/80 rounded-2xl shadow-md p-6 space-y-4 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Projects Repository Manager
              <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">Manage systematic review scopes, cloud configurations, targets and calibration pools.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Project Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={projectSearchTerm}
                onChange={(e) => setProjectSearchTerm(e.target.value)}
                placeholder="Search projects by name, slug..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-xl text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium placeholder:text-muted-foreground/70 shadow-inner"
              />
            </div>

            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 bg-secondary text-foreground hover:bg-secondary/80 border border-border/80 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 text-primary" />
              Import
            </button>
            <button
              onClick={() => setShowCreateProjectModal(true)}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Project
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 text-[9px] text-muted-foreground uppercase font-black tracking-wider bg-secondary/20 select-none">
                <th className="py-3 px-3">Project Scope</th>
                <th className="py-3 px-3">Cloud Configuration</th>
                <th className="py-3 px-3 text-center">Screening Rate</th>
                <th className="py-3 px-3 text-center">PDF Acquisition</th>
                <th className="py-3 px-3 text-center">Calibration Pools</th>
                <th className="py-3 px-3 text-center">Budget Spent</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground italic text-xs">
                    {projectSearchTerm ? 'No projects match your search criteria.' : 'No projects available. Click New Project to create one.'}
                  </td>
                </tr>
              ) : (
                filteredProjects.map((proj: any) => {
                  const isActive = String(proj.id) === String(activeProjectId);
                  
                  // stats calculations
                  const pStats = proj.stats || { total: 0, screened: 0, acquired: 0, synced: 0, pool_a_count: 0, pool_b_count: 0, pool_c_count: 0 };
                  const pScreenedPct = pStats.total > 0 ? Math.round((pStats.screened / pStats.total) * 100) : 0;
                  const pAcquiredPct = pStats.total > 0 ? Math.round((pStats.acquired / pStats.total) * 100) : 0;
                  
                  const projCloudProvider = proj.cloud_provider || 'gdrive';
                  const projRemote = proj.rclone_remote_name || (projCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive');
                  const projDest = proj.gdrive_dest_path || 'SLR_Magic/PDFs';

                  const pBudgetLimit = proj.project_budget_limit || 0;
                  const pCurrentSpend = proj.project_current_spend || 0;
                  const pSpendPct = pBudgetLimit > 0 ? Math.round((pCurrentSpend / pBudgetLimit) * 100) : 0;

                  return (
                    <tr key={proj.id} className={`hover:bg-secondary/20 transition-colors ${isActive ? 'bg-primary/5' : ''}`}>
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
                        <div className="text-[9px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground/50" />
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
                            <span className="text-[10px] font-mono text-muted-foreground bg-secondary/50 px-1 py-0.5 rounded border border-border/60">
                              {projRemote}:
                            </span>
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground max-w-[200px] truncate" title={`${projDest}/${proj.folder_name}`}>
                            {projDest}/{proj.folder_name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5 min-w-[100px]">
                          <div className="text-[11px] font-mono font-bold text-foreground">
                            {pStats.screened} <span className="text-muted-foreground font-normal">/ {pStats.total}</span>
                          </div>
                          <div className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {pScreenedPct}% screened
                          </div>
                          <div className="w-24 bg-secondary rounded-full h-1.5 overflow-hidden border border-border/30">
                            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pScreenedPct}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5 min-w-[100px]">
                          <div className="text-[11px] font-mono font-bold text-foreground">
                            {pStats.acquired} <span className="text-muted-foreground font-normal">/ {pStats.total}</span>
                          </div>
                          <div className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            {pAcquiredPct}% acquired
                          </div>
                          <div className="w-24 bg-secondary rounded-full h-1.5 overflow-hidden border border-border/30">
                            <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pAcquiredPct}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-start gap-1 font-mono text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="font-bold text-foreground/80">Pool A:</span> {pStats.pool_a_count} <span className="text-[9px] text-muted-foreground/50">/ {proj.pool_a_size || 50}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                            <span className="font-bold text-foreground/80">Pool B:</span> {pStats.pool_b_count} <span className="text-[9px] text-muted-foreground/50">/ {proj.pool_b_size || 30}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                            <span className="font-bold text-foreground/80">Pool C:</span> {pStats.pool_c_count} <span className="text-[9px] text-muted-foreground/50">/ {proj.pool_c_size || 20}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5 min-w-[100px]">
                          <div className="text-[11px] font-mono font-bold text-foreground" title={`$${pCurrentSpend.toFixed(4)}`}>
                            ${pCurrentSpend < 1 && pCurrentSpend > 0 ? pCurrentSpend.toFixed(4) : pCurrentSpend.toFixed(2)} <span className="text-muted-foreground font-normal">/ ${pBudgetLimit.toFixed(2)}</span>
                          </div>
                          <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pSpendPct > 90 ? 'text-red-500 bg-red-500/10' : 'text-indigo-500 bg-indigo-500/10'}`}>
                            {pSpendPct}% spent
                          </div>
                          <div className="w-24 bg-secondary rounded-full h-1.5 overflow-hidden border border-border/30">
                            <div className={`h-1.5 rounded-full transition-all duration-300 ${pSpendPct > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(pSpendPct, 100)}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openProjectSettings(proj)}
                            className="p-1.5 bg-secondary text-foreground hover:bg-secondary/80 border border-border rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                            title="Configure Project Settings"
                          >
                            <Settings className="w-3.5 h-3.5 text-primary" />
                          </button>

                          <button
                            onClick={() => {
                              if (onOpenArchive) onOpenArchive(proj);
                            }}
                            className="p-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                            title="Archive & Offboard Project"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => setDeleteProjectConfirm({ isOpen: true, projectId: proj.id, projectName: proj.name })}
                            className="p-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                            title="Delete Project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-[9px] font-bold uppercase tracking-wider select-none">
                              <Check className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <button
                              onClick={() => activateProject(proj.id)}
                              className="px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/95 text-[10px] font-bold uppercase rounded-lg transition-all shadow-sm hover:shadow cursor-pointer"
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
