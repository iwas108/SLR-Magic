import React from 'react';
import { Plus, Settings, RefreshCw, LayoutDashboard, Globe, ExternalLink, Sparkles } from 'lucide-react';

interface DashboardQuickActionsProps {
  activeProject: any;
  setShowCreateProjectModal: (val: boolean) => void;
  openProjectSettings: (proj: any) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function DashboardQuickActions({
  activeProject,
  setShowCreateProjectModal,
  openProjectSettings,
  showToast
}: DashboardQuickActionsProps) {
  const handleTriggerQuickSync = async () => {
    if (!activeProject) {
      showToast('No active project selected', 'warning');
      return;
    }
    showToast(`Initializing background sync for ${activeProject.name}...`, 'info');
    try {
      const res = await fetch('/api/sync/rclone', { method: 'POST' });
      if (res.ok) {
        showToast('Rclone synchronization process dispatched successfully', 'success');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to dispatch Rclone sync', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch Rclone sync', 'error');
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-md p-6 space-y-4 w-full">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="space-y-1">
          <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-primary" />
            Executive Quick Actions
          </h3>
          <p className="text-[10px] text-muted-foreground">Immediate control shortcuts for literature scoping, background sync, and protocol configuration.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        {/* Create Project Button */}
        <button
          type="button"
          onClick={() => setShowCreateProjectModal(true)}
          className="p-4 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl flex flex-col items-start gap-2.5 transition-all text-left shadow-sm hover:shadow group"
        >
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">Instantiate New Project</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
              Define a fresh systematic review scope, manifesto, RQs, and cloud sync paths.
            </p>
          </div>
        </button>

        {/* Configure Active Project Button */}
        <button
          type="button"
          onClick={() => {
            if (activeProject) {
              openProjectSettings(activeProject);
            } else {
              showToast('No active project to configure', 'warning');
            }
          }}
          className="p-4 bg-secondary/20 hover:bg-secondary/40 border border-border rounded-xl flex flex-col items-start gap-2.5 transition-all text-left shadow-sm hover:shadow group"
        >
          <div className="w-9 h-9 rounded-lg bg-secondary text-foreground flex items-center justify-center shadow-md border border-border group-hover:scale-105 transition-transform">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">Active Protocol Settings</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
              Inspect and modify active project parameters, pre-calibration targets, and prompts.
            </p>
          </div>
        </button>

        {/* Dispatch Background Sync Button */}
        <button
          type="button"
          onClick={handleTriggerQuickSync}
          className="p-4 bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-xl flex flex-col items-start gap-2.5 transition-all text-left shadow-sm hover:shadow group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-foreground group-hover:text-emerald-500 transition-colors">Force Cloud Harmonization</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
              Manually invoke Rclone background synchronizer for the active project scope.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
