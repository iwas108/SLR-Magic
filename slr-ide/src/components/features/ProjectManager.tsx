import React, { useState } from 'react';
import { Project } from '@/types';
import { 
  Folder, Database, CheckCircle2, TrendingUp, Layers, Plus, Calendar, 
  Trash2, Play, Settings, Edit
} from 'lucide-react';
import { useProjectForm } from '@/hooks/useProjectForm';

interface ProjectManagerProps {
  projects: Project[];
  activeProjectId: string;
  activateProject: (id: string) => Promise<void>;
  createProject: (data: any, onSuccess?: (id: string) => void) => Promise<boolean>;
  updateProject: (id: string, data: any, onSuccess?: () => void) => Promise<boolean>;
  deleteProject: (id: string, onSuccess?: () => void) => Promise<boolean>;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function ProjectManager({
  projects,
  activeProjectId,
  activateProject,
  createProject,
  updateProject,
  deleteProject,
  showToast
}: ProjectManagerProps) {
  const activeProj = projects.find(p => p.id === activeProjectId);
  const stats = (activeProj as any)?.stats || { total: 0, screened: 0, acquired: 0, synced: 0 };
  const screenedPct = stats.total > 0 ? Math.round((stats.screened / stats.total) * 100) : 0;
  const acquiredPct = stats.total > 0 ? Math.round((stats.acquired / stats.total) * 100) : 0;

  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Active Project</span>
            <h4 className="font-bold text-sm text-foreground truncate max-w-[150px]">{activeProj?.name || 'Default Project'}</h4>
          </div>
          <Folder className="w-10 h-10 text-primary/10 absolute right-3 top-3 group-hover:scale-110 group-hover:text-primary/20 transition-all z-0" />
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="space-y-1 z-10">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Total Papers</span>
            <h4 className="font-bold text-lg text-foreground font-mono">{stats.total}</h4>
          </div>
          <Database className="w-10 h-10 text-primary/10 absolute right-3 top-3 group-hover:scale-110 group-hover:text-primary/20 transition-all z-0" />
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between z-10 mb-1">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">PDF Acquisition</span>
            <TrendingUp className="w-4 h-4 text-amber-500/70" />
          </div>
          <div className="z-10 flex items-baseline gap-2">
            <h4 className="font-bold text-lg text-foreground font-mono">{stats.acquired}</h4>
            <span className="text-[10px] text-muted-foreground">/ {stats.total} ({acquiredPct}%)</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden z-10">
            <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${acquiredPct}%` }} />
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-card border border-border rounded-xl shadow-md p-6 space-y-4 w-full">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="space-y-1">
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Projects Manager
            </h3>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
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
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {projects.map((proj: any) => {
                const isActive = proj.id === activeProjectId;
                const pStats = proj.stats || { total: 0, screened: 0, acquired: 0 };
                const pScreenedPct = pStats.total > 0 ? Math.round((pStats.screened / pStats.total) * 100) : 0;
                const pAcquiredPct = pStats.total > 0 ? Math.round((pStats.acquired / pStats.total) * 100) : 0;
                const pCloud = proj.cloud_provider || 'gdrive';

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
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="text-[10px] font-semibold text-muted-foreground">
                        {pCloud}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="text-[11px] font-mono font-bold">{pStats.screened} / {pStats.total}</div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="text-[11px] font-mono font-bold">{pStats.acquired} / {pStats.total}</div>
                    </td>
                    <td className="py-3.5 px-3 text-right flex items-center justify-end gap-2">
                      {!isActive && (
                        <button onClick={() => activateProject(proj.id)} className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded text-[10px] font-bold">
                          Activate
                        </button>
                      )}
                      <button onClick={() => deleteProject(proj.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
