import React from 'react';
import { 
  Plus, CheckCircle2, AlertCircle, RefreshCw, Settings, Trash2, Layers, Calendar, Check
} from 'lucide-react';

import MetricSummaryCards from './dashboard/MetricSummaryCards';
import LocalPDFStatusChart from './dashboard/LocalPDFStatusChart';
import ProjectActivityLog from './dashboard/ProjectActivityLog';
import DashboardQuickActions from './dashboard/DashboardQuickActions';
import CreateProjectModal from './modals/CreateProjectModal';
import ProjectSettingsModal from './modals/ProjectSettingsModal';
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
  projectsHook: {
    projects: any[];
    activeProjectId: string;
    activeProject: any;
    activateProject: (id: string) => Promise<void>;
    loadProjects: () => Promise<any>;
    createProject: (data: any) => Promise<boolean>;
    updateProject: (id: string, data: any) => Promise<boolean>;
    handleTestProjectConnection: (provider: string, remoteName: string) => Promise<void>;
    testingProjectConnection: boolean;
    projectConnectionTestResult: any;
  };
}

export default function DashboardView({
  showToast,
  showCreateProjectModal,
  setShowCreateProjectModal,
  showEditProjectModal,
  setShowEditProjectModal,
  openProjectSettings,
  savingProject,
  deletingProject,
  deleteProjectConfirm,
  setDeleteProjectConfirm,
  deleteProjectConfirmationText,
  setDeleteProjectConfirmationText,
  editingProject,
  projectsHook
}: DashboardViewProps) {
  const {
    projects,
    activeProjectId,
    activeProject,
    activateProject,
    loadProjects,
    createProject,
    updateProject,
    handleTestProjectConnection,
    testingProjectConnection,
    projectConnectionTestResult
  } = projectsHook;

  const activeProj = projects.find((p: any) => String(p.id) === String(activeProjectId)) || activeProject;

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

        <CreateProjectModal
          isOpen={showCreateProjectModal}
          onClose={() => setShowCreateProjectModal(false)}
          onCreateProject={createProject}
          savingProject={savingProject}
        />

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
        />

      </div>
    </>
  );
}
